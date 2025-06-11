const { Pool } = require('pg');

// Database configuration
let pool = null;

async function initializeDatabase() {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Test connection
    const client = await pool.connect();
    console.log('Database connected successfully');
    
    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS assessment_sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        user_data JSONB,
        responses JSONB DEFAULT '{}',
        chat_data JSONB DEFAULT '[]',
        consent_data JSONB,
        current_step VARCHAR(50) DEFAULT 'consent',
        readiness_score INTEGER,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    client.release();
    return pool;
  } catch (error) {
    console.error('Database connection error:', error);
    return null;
  }
}
// Ensure database connection for each request
// Ensure database connection for each request
async function getPool() {
  if (!pool) {
    pool = await initializeDatabase();
  }
  return pool;
}

// AI Service configuration

// AI Service configuration
const CONFIG = {
  AI_MODEL: process.env.AI_MODEL || 'anthropic/claude-3.5-sonnet:beta',
  AI_TEMPERATURE: parseFloat(process.env.AI_TEMPERATURE || '0.8'),
  AI_MAX_TOKENS: parseInt(process.env.AI_MAX_TOKENS || '800'),
  MIN_QUESTION_SCORE: parseInt(process.env.MIN_QUESTION_SCORE || '3'),
  MIN_OVERALL_SCORE: parseInt(process.env.MIN_OVERALL_SCORE || '50'),
  MAX_REALISTIC_SCORE: parseInt(process.env.MAX_REALISTIC_SCORE || '85'),
  CONSULTATION_SWEET_SPOT_MIN: parseInt(process.env.CONSULTATION_MIN || '60'),
  CONSULTATION_SWEET_SPOT_MAX: parseInt(process.env.CONSULTATION_MAX || '75')
};


// Assessment questions data
const assessmentQuestions = [
  {
    id: 1,
    text: {
      de: "Was ist Ihr Hauptziel bei der Einführung von KI in Ihrem Unternehmen?",
      en: "What is your main goal in implementing AI in your company?"
    }
  },
  {
    id: 2,
    text: {
      de: "Welche Erfahrungen haben Sie bereits mit KI-Technologien gemacht?",
      en: "What experience do you already have with AI technologies?"
    }
  },
  {
    id: 3,
    text: {
      de: "Wie bewerten Sie die digitale Infrastruktur Ihres Unternehmens?",
      en: "How would you rate your company's digital infrastructure?"
    }
  },
  {
    id: 4,
    text: {
      de: "Wie ist die Einstellung Ihrer Mitarbeiter gegenüber neuen Technologien?",
      en: "What is your employees' attitude towards new technologies?"
    }
  },
  {
    id: 5,
    text: {
      de: "Welche Bereiche Ihres Unternehmens könnten am meisten von KI profitieren?",
      en: "Which areas of your business could benefit most from AI?"
    }
  },
  {
    id: 6,
    text: {
      de: "Wie gehen Sie derzeit mit Datensammlung und -analyse um?",
      en: "How do you currently handle data collection and analysis?"
    }
  },
  {
    id: 7,
    text: {
      de: "Welche Bedenken haben Sie bezüglich der KI-Implementierung?",
      en: "What concerns do you have regarding AI implementation?"
    }
  },
  {
    id: 8,
    text: {
      de: "Wie hoch ist Ihr Budget für KI-Initiativen?",
      en: "What is your budget for AI initiatives?"
    }
  },
  {
    id: 9,
    text: {
      de: "Welche Zeitrahmen stellen Sie sich für die KI-Implementierung vor?",
      en: "What timeframe do you envision for AI implementation?"
    }
  },
  {
    id: 10,
    text: {
      de: "Wie messen Sie den Erfolg von Technologie-Investitionen?",
      en: "How do you measure the success of technology investments?"
    }
  }
];

// Translations
const translations = {
  de: {
    welcome: 'Willkommen zum GROVIA KI-Readiness Assessment! Ich bin Ihr digitaler Berater.',
    intro: 'Ich werde Ihnen einige Fragen stellen, um die KI-Bereitschaft Ihres Unternehmens zu bewerten.',
    readyToStart: 'Sind Sie bereit zu beginnen?',
    thankYou: 'Vielen Dank für Ihre Teilnahme!',
    processing: 'Ich analysiere Ihre Antworten...',
    nextQuestion: 'Lassen Sie uns zur nächsten Frage übergehen.',
    completion: 'Das Assessment ist abgeschlossen. Ihr Readiness-Score wird berechnet...',
    scoreCalculated: 'Ihr KI-Readiness-Score wurde berechnet!',
    recommendations: 'Basierend auf Ihren Antworten habe ich personalisierte Empfehlungen für Sie.',
    contactForDetails: 'Für detaillierte Beratung kontaktieren Sie uns.',
    downloadReport: 'Detaillierten Bericht herunterladen',
    scheduleConsultation: 'Beratungsgespräch vereinbaren',
    scoreLabel: 'KI-Readiness Score',
    errorMsg: 'Entschuldigung, es gab einen Fehler. Bitte versuchen Sie es erneut.'
  },
  en: {
    welcome: 'Welcome to the GROVIA AI Readiness Assessment! I am your digital consultant.',
    intro: 'I will ask you several questions to evaluate your company\'s AI readiness.',
    readyToStart: 'Are you ready to begin?',
    thankYou: 'Thank you for your participation!',
    processing: 'I am analyzing your responses...',
    nextQuestion: 'Let\'s move on to the next question.',
    completion: 'The assessment is complete. Your readiness score is being calculated...',
    scoreCalculated: 'Your AI Readiness Score has been calculated!',
    recommendations: 'Based on your answers, I have personalized recommendations for you.',
    contactForDetails: 'For detailed consultation, please contact us.',
    downloadReport: 'Download Detailed Report',
    scheduleConsultation: 'Schedule Consultation',
    scoreLabel: 'AI Readiness Score',
    errorMsg: 'Sorry, there was an error. Please try again.'
  }
};
// AI Analysis function with improved error handling
async function analyzeResponse(questionId, questionText, userResponse, language) {
  const isFollowUp = questionId.includes('_followup');
  
  const prompt = `You are a supportive AI Readiness Assessment expert helping businesses discover their potential. Your role is to encourage and identify opportunities, not discourage.

Question: ${questionText}
User Response: ${userResponse}
Language: ${language}
Is Follow-up Response: ${isFollowUp}

CRITICAL TONE GUIDELINES:
- ALWAYS start with positive acknowledgment of what they're doing well
- Focus on opportunities and potential, not gaps or deficiencies
- Use encouraging language like "This shows excellent foundation for..." or "Building on your existing strengths..."
- NEVER use discouraging words like "missing", "lacking", "insufficient", "but", "however", "unfortunately"
- Frame any challenges as "next opportunities" or "areas for growth" rather than problems
- Every response should make the user feel confident and excited about their AI journey
- Be generous with praise and recognition

Your task:
1. Acknowledge the positive aspects of their response first
2. Provide encouraging analysis that builds confidence
3. Assign a score from 1-5 (be generous, aim for 3+ unless clearly inadequate)
4. Decide if a follow-up question would help uncover more opportunities
5. If follow-up needed, ask a specific, supportive question

Return ONLY valid JSON:
{
  "needsFollowUp": boolean,
  "explanation": "Encouraging explanation acknowledging their strengths first",
  "analysis": "Detailed positive analysis of their response",
  "score": number (1-5),
  "followUpQuestion": "Specific follow-up question (only if needsFollowUp is true)"
}`;

  try {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL || 'https://ai-assessment.grovia-digital.com',
      'X-Title': 'AI Readiness Assessment'
    },
    body: JSON.stringify({
      model: CONFIG.AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: CONFIG.AI_TEMPERATURE,
      max_tokens: CONFIG.AI_MAX_TOKENS,
      stream: false,
      timeout: 20000 // Add explicit timeout
    }),
    signal: controller.signal
  });
  
  clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid API response structure');
    }
    
    const content = data.choices[0].message.content;
    
    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse JSON response with fallback
    try {
      const analysis = JSON.parse(content);
      
      // Validate required fields
      if (typeof analysis.needsFollowUp !== 'boolean' || 
          typeof analysis.explanation !== 'string' ||
          typeof analysis.score !== 'number') {
        throw new Error('Invalid AI response format');
      }
      
      // Ensure score is within valid range
      analysis.score = Math.max(1, Math.min(5, analysis.score));
      
      return analysis;
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback response
      return {
        needsFollowUp: false,
        explanation: language === 'de' 
          ? 'Vielen Dank für Ihre detaillierte Antwort. Das zeigt bereits ein gutes Verständnis für die Thematik.'
          : 'Thank you for your detailed response. This already shows a good understanding of the topic.',
        analysis: 'Response shows engagement with AI readiness concepts',
        score: 3
      };
    }
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      needsFollowUp: false,
      explanation: language === 'de' 
        ? 'Danke für Ihre Antwort. Lassen Sie uns zur nächsten Frage übergehen.'
        : 'Thank you for your response. Let\'s move to the next question.',
      analysis: 'Response received',
      score: 3
    };
  }
}

// Simple scoring algorithm
function calculateReadinessScore(responses) {
  const weights = {
    '1': 15, // Main goal clarity
    '2': 10, // AI experience
    '3': 12, // Infrastructure
    '4': 8,  // Employee attitude
    '5': 10, // Business areas
    '6': 12, // Data handling
    '7': 8,  // Concerns
    '8': 10, // Budget
    '9': 8,  // Timeline
    '10': 7  // Success metrics
  };
  
  let totalScore = 0;
  let totalWeight = 0;
  
  Object.keys(responses).forEach(questionId => {
    const baseId = questionId.replace('_followup', '');
    if (weights[baseId] && responses[questionId].score) {
      totalScore += responses[questionId].score * weights[baseId];
      totalWeight += weights[baseId];
    }
  });
  
  if (totalWeight === 0) return 50; // Default fallback
  
  const rawScore = (totalScore / totalWeight) * 20; // Convert to 0-100 scale
  
  // Apply realistic bounds
  return Math.max(
    CONFIG.MIN_OVERALL_SCORE, 
    Math.min(CONFIG.MAX_REALISTIC_SCORE, Math.round(rawScore))
  );
}

// N8n webhook integration
async function sendCompleteAssessmentToN8n(sessionId, readinessScore) {
  if (!process.env.N8N_WEBHOOK_URL) {
    console.log('N8n webhook URL not configured, skipping notification');
    return;
  }

  try {
    await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'assessment_completed',
        sessionId,
        readinessScore,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Failed to notify N8n:', error);
  }
}

// Main serverless function
exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const pool = await getPool();
  if (!pool) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Database connection failed' })
    };
  }

  try {
    const path = event.path.replace('/.netlify/functions/server', '');
    const body = event.body ? JSON.parse(event.body) : {};
    const { sessionId, language = 'de' } = body;

    console.log(`Processing request: ${event.httpMethod} ${path}`);

    // Handle different API endpoints
    if (path === '/api/assessment/initialize' || path === '/api/assessment/session') {
      // Create or get session
      let sessionResult = await pool.query(
        'SELECT * FROM assessment_sessions WHERE session_id = $1',
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        await pool.query(
          'INSERT INTO assessment_sessions (session_id, created_at, updated_at) VALUES ($1, NOW(), NOW())',
          [sessionId]
        );
        sessionResult = await pool.query(
          'SELECT * FROM assessment_sessions WHERE session_id = $1',
          [sessionId]
        );
      }

      const t = translations[language];
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          sessionId,
          messages: [
            { type: 'bot', content: t.welcome },
            { type: 'bot', content: t.intro },
            { type: 'bot', content: t.readyToStart }
          ],
          ...sessionResult.rows[0]
        })
      };
    }

    if (path === '/api/assessment/consent') {
      const { consentDataProcessing, consentContactPermission } = body;
      
      await pool.query(
        'UPDATE assessment_sessions SET consent_data = $1, current_step = $2, updated_at = NOW() WHERE session_id = $3',
        [JSON.stringify({ dataProcessing: consentDataProcessing, contactPermission: consentContactPermission }), 'contact', sessionId]
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    if (path === '/api/assessment/contact') {
      const { contactName, email, companyName, employeeNumber } = body;
      
      await pool.query(
        'UPDATE assessment_sessions SET user_data = $1, current_step = $2, updated_at = NOW() WHERE session_id = $3',
        [JSON.stringify({ name: contactName, email, company: companyName, employees: employeeNumber }), 'questions', sessionId]
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    if (path === '/api/assessment/start') {
      const firstQuestion = assessmentQuestions[0];
      const t = translations[language];
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          firstQuestion: `(Frage 1 von ${assessmentQuestions.length}) ${firstQuestion.text[language]}`
        })
      };
    }

    if (path === '/api/assessment/analyze') {
      const { questionId, userResponse } = body;
      const currentQuestionIndex = parseInt(questionId) - 1;
      
      if (currentQuestionIndex < 0 || currentQuestionIndex >= assessmentQuestions.length) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid question ID' })
        };
      }

      const question = assessmentQuestions[currentQuestionIndex];
      const questionText = question.text[language];
      
      // Get session
      const sessionResult = await pool.query(
        'SELECT * FROM assessment_sessions WHERE session_id = $1',
        [sessionId]
      );
      
      if (sessionResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Session not found' })
        };
      }

      const session = sessionResult.rows[0];

      // Analyze response with AI - Enhanced error handling
      let aiAnalysis;
      try {
        aiAnalysis = await analyzeResponse(questionId, questionText, userResponse, language);
        if (!aiAnalysis || typeof aiAnalysis !== 'object') {
          throw new Error('Invalid AI analysis response');
        }
      } catch (analysisError) {
        console.error('AI Analysis failed:', analysisError);
        aiAnalysis = {
          needsFollowUp: false,
          explanation: language === 'de' 
            ? 'Vielen Dank für Ihre Antwort. Lassen Sie uns zur nächsten Frage übergehen.'
            : 'Thank you for your answer. Let\'s move to the next question.',
          analysis: 'Response processed successfully',
          score: 3
        };
      }
      
      // Update session with new response
      const currentResponses = session.responses || {};
      currentResponses[questionId] = {
        userResponse,
        questionText,
        ...aiAnalysis,
        timestamp: new Date().toISOString()
      };

      // Update session
      await pool.query(
        'UPDATE assessment_sessions SET responses = $1 WHERE session_id = $2',
        [JSON.stringify(currentResponses), sessionId]
      );

          // Determine next action based on question flow
      const totalQuestions = assessmentQuestions.length;
      const currentIndex = parseInt(questionId) - 1;

      let responseData = {
        analysis: aiAnalysis,
        isComplete: false,
        nextQuestion: null
      };

      // Check if this is the last question
      if (currentIndex >= totalQuestions - 1) {
        responseData.isComplete = true;
      } else {
        // Provide next question
        const nextQuestionIndex = currentIndex + 1;
        const nextQuestion = assessmentQuestions[nextQuestionIndex];
        responseData.nextQuestion = `(Frage ${nextQuestionIndex + 1} von ${totalQuestions}) ${nextQuestion.text[language]}`;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(responseData)
      };
    }

    if (path === '/api/assessment/complete') {
      // Get session and calculate final score
      const sessionResult = await pool.query(
        'SELECT * FROM assessment_sessions WHERE session_id = $1',
        [sessionId]
      );
      
      if (sessionResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Session not found' })
        };
      }

      const session = sessionResult.rows[0];
      const responses = session.responses || {};
      
      const readinessScore = calculateReadinessScore(responses);
      
      // Update session with completion
      await pool.query(
        'UPDATE assessment_sessions SET readiness_score = $1, completed_at = NOW(), current_step = $2 WHERE session_id = $3',
        [readinessScore, 'completed', sessionId]
      );

      // Send to N8n if configured
      await sendCompleteAssessmentToN8n(sessionId, readinessScore);

      const t = translations[language];
      
      // Generate completion message based on score
      let completionMessage = '';
      if (readinessScore >= CONFIG.CONSULTATION_SWEET_SPOT_MIN && readinessScore <= CONFIG.CONSULTATION_SWEET_SPOT_MAX) {
        completionMessage = language === 'de' 
          ? `Herzlichen Glückwunsch! Ihr Unternehmen zeigt eine sehr gute KI-Bereitschaft mit einem Score von ${readinessScore}%. Sie sind in einer idealen Position, um von einer professionellen KI-Beratung zu profitieren und Ihre digitale Transformation voranzutreiben.`
          : `Congratulations! Your company shows excellent AI readiness with a score of ${readinessScore}%. You are in an ideal position to benefit from professional AI consulting and advance your digital transformation.`;
      } else if (readinessScore >= 70) {
        completionMessage = language === 'de'
          ? `Ausgezeichnet! Mit einem Score von ${readinessScore}% ist Ihr Unternehmen sehr gut für KI-Technologien aufgestellt. Sie können bereits mit der Implementierung beginnen.`
          : `Excellent! With a score of ${readinessScore}%, your company is very well positioned for AI technologies. You can already begin implementation.`;
      } else if (readinessScore >= 50) {
        completionMessage = language === 'de'
          ? `Guter Start! Ihr Score von ${readinessScore}% zeigt solides Potenzial. Mit einigen strategischen Verbesserungen können Sie Ihre KI-Bereitschaft deutlich steigern.`
          : `Good start! Your score of ${readinessScore}% shows solid potential. With some strategic improvements, you can significantly increase your AI readiness.`;
      } else {
        completionMessage = language === 'de'
          ? `Vielen Dank für Ihre Teilnahme! Ihr Score von ${readinessScore}% zeigt, dass noch Vorbereitungsarbeit nötig ist. Eine professionelle Beratung kann Ihnen dabei helfen, die richtigen Schritte zu planen.`
          : `Thank you for participating! Your score of ${readinessScore}% indicates that some preparation work is still needed. Professional consulting can help you plan the right steps.`;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          readinessScore,
          message: { content: completionMessage },
          recommendations: 'Detailed recommendations will be included in your report.'
        })
      };
    }

    // Default response for unknown endpoints
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Endpoint not found' })
    };

  } catch (error) {
    console.error('Server error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};
