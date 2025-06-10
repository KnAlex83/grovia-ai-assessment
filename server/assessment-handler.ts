import { Request, Response } from 'express';
import { storage } from './storage';
import { nanoid } from 'nanoid';

// Assessment questions data - moved from client
const assessmentQuestions = [
  {
    id: '1',
    text: {
      de: 'Was ist das Hauptziel Ihres Unternehmens bei der Einführung von KI?',
      en: 'What is your company\'s main goal when introducing AI?'
    }
  },
  {
    id: '2',
    text: {
      de: 'Beschreiben Sie Ihre bisherigen Erfahrungen mit digitalen Technologien und Automatisierung in Ihrem Unternehmen.',
      en: 'Describe your previous experiences with digital technologies and automation in your company.'
    }
  },
  {
    id: '3',
    text: {
      de: 'Wie bewerten Sie Ihre aktuelle IT-Infrastruktur und Datenqualität für KI-Anwendungen?',
      en: 'How do you assess your current IT infrastructure and data quality for AI applications?'
    }
  },
  {
    id: '4',
    text: {
      de: 'Welche konkreten Geschäftsprobleme oder Ineffizienzen möchten Sie mit KI lösen?',
      en: 'What specific business problems or inefficiencies would you like to solve with AI?'
    }
  },
  {
    id: '5',
    text: {
      de: 'Wie gehen Sie mit Datenschutz und Compliance um?',
      en: 'How do you handle data protection and compliance?'
    }
  },
  {
    id: '6',
    text: {
      de: 'Wie schätzen Sie die KI-Bereitschaft und Lernfähigkeit Ihres Teams ein?',
      en: 'How do you assess your team\'s AI readiness and learning capability?'
    }
  },
  {
    id: '7',
    text: {
      de: 'Welche Unterstützung erhalten Sie von der Geschäftsführung für digitale Innovationen und welches Budget steht für KI-Projekte zur Verfügung?',
      en: 'What support do you receive from management for digital innovations and what budget is available for AI projects?'
    }
  },
  {
    id: '8',
    text: {
      de: 'Was sind Ihre größten Bedenken oder Hindernisse bei der KI-Einführung?',
      en: 'What are your biggest concerns or obstacles in implementing AI?'
    }
  },
  {
    id: '9',
    text: {
      de: 'Welche Erfolgskriterien würden Sie für eine KI-Initiative definieren?',
      en: 'What success criteria would you define for an AI initiative?'
    }
  },
  {
    id: '10',
    text: {
      de: 'In welchem Zeitrahmen und mit welchen Ressourcen planen Sie die KI-Einführung?',
      en: 'In what timeframe and with what resources do you plan to implement AI?'
    }
  }
];

// Language translations - moved from client
const translations = {
  de: {
    welcomeMsg1: 'Hallo! Willkommen zum GROVIA AI Readiness Assessment. Ich bin Ihr persönlicher KI-Berater und helfe Ihnen dabei, die KI-Bereitschaft Ihres Unternehmens zu bewerten.',
    welcomeMsg2: 'Das Assessment dauert nur 5-10 Minuten und basiert auf modernster KI-Technologie. Am Ende erhalten Sie einen detaillierten, personalisierten Report per E-Mail.',
    consentThanks: 'Vielen Dank für Ihr Vertrauen! Bevor wir mit dem Assessment beginnen, benötigen wir einige Kontaktdaten für die Übermittlung Ihres persönlichen Reports.',
    assessmentStart: 'Perfekt! Lassen Sie uns nun mit dem Assessment beginnen. Ich werde Ihnen 10 intelligente Fragen stellen, die Ihre digitale Reife erfassen.',
    questionPrefix: 'Frage',
    followUpPrefix: 'Nachfrage',
    completionText: 'Vielen Dank für Ihre Teilnahme! Sie erhalten in Kürze einen detaillierten Bericht mit personalisierten Empfehlungen per E-Mail.',
    scoreLabel: 'AI Readiness Score',
    errorMsg: 'Entschuldigung, es gab einen Fehler. Bitte versuchen Sie es erneut.'
  },
  en: {
    welcomeMsg1: 'Hello! Welcome to the GROVIA AI Readiness Assessment. I am your personal AI consultant and will help you evaluate your company\'s AI readiness.',
    welcomeMsg2: 'The assessment takes only 5-10 minutes and is based on state-of-the-art AI technology. At the end, you will receive a detailed, personalized report via email.',
    consentThanks: 'Thank you for your trust! Before we begin the assessment, we need some contact information for transmitting your personalized report.',
    assessmentStart: 'Perfect! Let\'s now begin the assessment. I will ask you 10 intelligent questions that capture your digital maturity.',
    questionPrefix: 'Question',
    followUpPrefix: 'Follow-up Question',
    completionText: 'Thank you for your participation! You will receive a detailed report with personalized recommendations via email shortly.',
    scoreLabel: 'AI Readiness Score',
    errorMsg: 'Sorry, there was an error. Please try again.'
  }
};

// AI Analysis function - moved from client
async function analyzeResponse(questionId: string, questionText: string, userResponse: string, language: string) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'system',
            content: `You are an AI readiness assessment expert. Analyze the user's response to provide insights and a score (1-10). Also determine if a follow-up question is needed for clarification. Respond in ${language === 'de' ? 'German' : 'English'}.

Response format (JSON):
{
  "analysis": "Brief analysis of the response",
  "score": 7,
  "followUpQuestion": "Follow-up question if needed (or null)"
}`
          },
          {
            role: 'user',
            content: `Question: ${questionText}\nUser Response: ${userResponse}`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      analysis: 'Analysis temporarily unavailable.',
      score: 5,
      followUpQuestion: null
    };
  }
}

// Webhook function - moved from client
async function sendCompleteAssessmentToN8n(sessionId: string, score: number) {
  try {
    console.log('Preparing webhook for session:', sessionId);
    await new Promise(resolve => setTimeout(resolve, 5000));

    const webhookUrl = 'https://grovia.app.n8n.cloud/webhook/ai-assessment-complete';
    
    // Get complete assessment data
    const session = await storage.getAssessmentSession(sessionId);
    if (!session) {
      console.error('Session not found for webhook');
      return;
    }

    const hasEmail = session.email;
    const hasResponses = session.responses && Object.keys(session.responses).length > 0;
    const hasConsent = session.consentDataProcessing !== undefined;

    if (!hasEmail || !hasResponses || !hasConsent) {
      console.error('Incomplete session data detected:', {
        hasEmail,
        hasResponses,
        hasConsent
      });
      return;
    }

    console.log('Data validation passed, sending to n8n...');
    
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contact: {
          email: session.email,
          name: session.contactName,
          company: session.companyName,
          employees: session.employeeNumber
        },
        assessment: {
          responses: session.responses,
          readiness_score: score,
          language: session.language
        },
        consent: {
          data_processing: session.consentDataProcessing,
          contact_permission: session.consentContactPermission
        }
      })
    });

    if (webhookResponse.ok) {
      console.log('✅ Webhook sent successfully to n8n');
    } else {
      const errorText = await webhookResponse.text();
      console.error('❌ N8N webhook failed:', webhookResponse.status, errorText);
    }
  } catch (error) {
    console.error('Webhook error:', error);
  }
}

// Calculate readiness score
function calculateReadinessScore(responses: Record<string, any>): number {
  if (!responses || Object.keys(responses).length === 0) {
    return 0;
  }

  const scores = Object.values(responses).map((r: any) => r.score || 5);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.round(average * 10);
}

// Server-side handlers
export const assessmentHandlers = {
  // Initialize assessment session
  initializeSession: async (req: Request, res: Response) => {
    try {
      const { sessionId, language = 'de' } = req.body;
      
      let session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        session = await storage.createAssessmentSession({
          sessionId,
          language
        });
      }

      const t = translations[language as keyof typeof translations];
      
      res.json({
        success: true,
        sessionId: session.sessionId,
        messages: [
          { type: 'bot', content: t.welcomeMsg1 },
          { type: 'bot', content: t.welcomeMsg2 }
        ]
      });
    } catch (error) {
      console.error('Error initializing session:', error);
      res.status(500).json({ error: 'Failed to initialize session' });
    }
  },

  // Handle consent submission
  submitConsent: async (req: Request, res: Response) => {
    try {
      const { sessionId, consentDataProcessing, consentContactPermission } = req.body;
      
      const session = await storage.updateAssessmentSession(sessionId, {
        consentDataProcessing,
        consentContactPermission
      });

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const t = translations[session.language as keyof typeof translations];
      
      res.json({
        success: true,
        message: { type: 'bot', content: t.consentThanks }
      });
    } catch (error) {
      console.error('Error saving consent:', error);
      res.status(500).json({ error: 'Failed to save consent' });
    }
  },

  // Handle contact information submission
  submitContact: async (req: Request, res: Response) => {
    try {
      const { sessionId, contactName, email, companyName, employeeNumber } = req.body;
      
      const session = await storage.updateAssessmentSession(sessionId, {
        contactName,
        email,
        companyName,
        employeeNumber,
        currentStep: 2
      });

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const t = translations[session.language as keyof typeof translations];
      const firstQuestion = assessmentQuestions[0];
      
      res.json({
        success: true,
        messages: [
          { type: 'bot', content: `Vielen Dank, ${contactName}! ${t.assessmentStart}` },
          { type: 'bot', content: `(${t.questionPrefix} 1) ${firstQuestion.text[session.language as keyof typeof firstQuestion.text]}` }
        ],
        nextStep: 'questions'
      });
    } catch (error) {
      console.error('Error saving contact:', error);
      res.status(500).json({ error: 'Failed to save contact' });
    }
  },

  // Handle question response submission
  submitResponse: async (req: Request, res: Response) => {
    try {
      const { sessionId, questionId, response, currentQuestionIndex, language } = req.body;
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const question = assessmentQuestions[currentQuestionIndex];
      const questionText = question.text[language as keyof typeof question.text];
      
      // Analyze response with AI
      const analysis = await analyzeResponse(questionId, questionText, response, language);
      
      // Update session with response
      const responses = session.responses || {};
      responses[questionId] = {
        question: questionText,
        answer: response,
        analysis: analysis.analysis,
        score: analysis.score
      };

      await storage.updateAssessmentSession(sessionId, { responses });

      const t = translations[language as keyof typeof translations];
      const messages = [];

      if (analysis.followUpQuestion) {
        messages.push({
          type: 'bot',
          content: `(${t.followUpPrefix} ${currentQuestionIndex + 1}) ${analysis.followUpQuestion}`
        });
      } else {
        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex < assessmentQuestions.length) {
          const nextQuestion = assessmentQuestions[nextIndex];
          messages.push({
            type: 'bot',
            content: `(${t.questionPrefix} ${nextIndex + 1}) ${nextQuestion.text[language as keyof typeof nextQuestion.text]}`
          });
        }
      }

      res.json({
        success: true,
        analysis: analysis.analysis,
        score: analysis.score,
        followUpQuestion: analysis.followUpQuestion,
        messages,
        isComplete: !analysis.followUpQuestion && currentQuestionIndex >= assessmentQuestions.length - 1
      });
    } catch (error) {
      console.error('Error submitting response:', error);
      res.status(500).json({ error: 'Failed to submit response' });
    }
  },

  // Complete assessment
  completeAssessment: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const readinessScore = calculateReadinessScore(session.responses || {});
      
      await storage.updateAssessmentSession(sessionId, {
        readinessScore,
        isCompleted: true,
        completedAt: new Date()
      });

      const t = translations[session.language as keyof typeof translations];
      
      // Trigger webhook
      await sendCompleteAssessmentToN8n(sessionId, readinessScore);

      res.json({
        success: true,
        readinessScore,
        message: {
          type: 'bot',
          content: `${t.completionText} ${t.scoreLabel}: ${readinessScore}%`
        }
      });
    } catch (error) {
      console.error('Error completing assessment:', error);
      res.status(500).json({ error: 'Failed to complete assessment' });
    }
  }
};
