const express = require('express');
const serverless = require('serverless-http');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

// Configure Neon for serverless
neonConfig.webSocketConstructor = ws;

const app = express();
app.use(express.json());

// Add routing middleware for database operations
app.use((req, res, next) => {
  if (req.body && req.body.endpoint) {
    req.url = req.body.endpoint;
    delete req.body.endpoint;
  }
  next();
});
// Database connection with error handling
let pool;
try {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
} catch (error) {
  console.error('Database connection error:', error);
}

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

// SERVER-SIDE ASSESSMENT QUESTIONS (Moved from frontend for security)
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
      de: 'Wie stellen Sie sich die langfristige Rolle von KI in Ihrem Unternehmen vor?',
      en: 'How do you envision the long-term role of AI in your company?'
    }
  }
];

// SERVER-SIDE TRANSLATIONS (Moved from frontend for security)
const translations = {
  de: {
    questionPrefix: 'Frage',
    followUpPrefix: 'Nachfrage',
    welcomeMsg1: 'Willkommen zum KI-Readiness Assessment!',
    welcomeMsg2: 'Ich werde Ihnen einige Fragen stellen, um Ihre KI-Bereitschaft zu bewerten.',
    completionMsg: 'Vielen Dank! Ihr Assessment ist abgeschlossen.',
    analysisIntro: 'Basierend auf Ihren Antworten:'
  },
  en: {
    questionPrefix: 'Question',
    followUpPrefix: 'Follow-up',
    welcomeMsg1: 'Welcome to the AI Readiness Assessment!',
    welcomeMsg2: 'I will ask you some questions to evaluate your AI readiness.',
    completionMsg: 'Thank you! Your assessment is complete.',
    analysisIntro: 'Based on your answers:'
  }
};

// AI Analysis function with improved error handling
async function analyzeResponse(questionId, questionText, userResponse, language) {
  const isFollowUp = questionId.includes('_followup');
  
  const prompt = `You are a supportive AI Readiness Assessment expert helping businesses discover their potential. Your role is to encourage and identify opportunities, not discourage.

Question: ${questionText}
User Response: ${userResponse}

Instructions:
1. If this is a follow-up question (${isFollowUp}), focus on deep analysis based on the additional context.
2. For initial responses that are vague, brief (under 15 words), or lack specific details, ask a relevant follow-up question to gather more context.
3. Score from 3-5 based on readiness level: 3=Basic, 4=Good, 5=Advanced.
4. Be encouraging and identify strengths and opportunities.
5. Respond in ${language === 'de' ? 'German' : 'English'}.

Return JSON with:
{
  "explanation": "encouraging analysis of their response",
  "analysis": "brief assessment of readiness level",
  "score": 3-5,
  "needsFollowUp": boolean,
  "followUpQuestion": "specific follow-up question if needed"
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CONFIG.AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: CONFIG.AI_TEMPERATURE,
        max_tokens: CONFIG.AI_MAX_TOKENS
      })
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
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
      analysis.score = Math.max(3, Math.min(5, analysis.score));
      
      return analysis;
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return {
        needsFollowUp: false,
        explanation: language === 'de' 
          ? 'Danke für Ihre Antwort. Lassen Sie uns zur nächsten Frage übergehen.'
          : 'Thank you for your response. Let\'s move to the next question.',
        analysis: 'Response received',
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
    '3': 15, // IT infrastructure
    '4': 15, // Data quality
    '5': 10, // Data compliance
    '6': 10, // Process optimization
    '7': 10, // Team readiness
    '8': 10, // Management support
    '9': 5,  // Risk awareness
    '10': 0, // Timeline (not scored)
  };

  let totalScore = 0;
  let maxPossibleScore = 0;

  Object.entries(weights).forEach(([questionId, weight]) => {
    if (weight === 0) return;
    
    maxPossibleScore += weight;
    const response = responses[questionId];
    
    if (response && response.score) {
      totalScore += (response.score / 5) * weight;
    }
  });

  if (maxPossibleScore === 0) return 0;
  
  const percentage = (totalScore / maxPossibleScore) * 100;
  return Math.min(CONFIG.MAX_REALISTIC_SCORE, Math.round(percentage));
}

// Create or get assessment session
app.post('/api/assessment/session', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId, language = 'de' } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID required' });
    }

    // Check if session exists
    const existingSession = await pool.query(
      'SELECT * FROM assessment_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (existingSession.rows.length > 0) {
      return res.json(existingSession.rows[0]);
    }

    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assessment_sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        language VARCHAR(10) DEFAULT 'de',
        current_step INTEGER DEFAULT 0,
        responses JSONB DEFAULT '{}',
        contact_info JSONB,
        consent_data JSONB,
        readiness_score INTEGER,
        is_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create new session
    const newSession = await pool.query(
      'INSERT INTO assessment_sessions (session_id, language) VALUES ($1, $2) RETURNING *',
      [sessionId, language]
    );

    res.json(newSession.rows[0]);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ message: 'Failed to create session' });
  }
});

// Get assessment session
app.get('/api/assessment/session/:sessionId', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId } = req.params;
    
    const session = await pool.query(
      'SELECT * FROM assessment_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json(session.rows[0]);
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ message: 'Failed to get session' });
  }
});

// Save consent data
app.post('/api/assessment/consent', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId, consentDataProcessing, consentContactPermission } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID required' });
    }

    const consentData = {
      dataProcessing: consentDataProcessing,
      contactPermission: consentContactPermission,
      timestamp: new Date().toISOString()
    };

    await pool.query(
      'UPDATE assessment_sessions SET consent_data = $1, updated_at = NOW() WHERE session_id = $2',
      [JSON.stringify(consentData), sessionId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving consent:', error);
    res.status(500).json({ message: 'Failed to save consent' });
  }
});

// Save contact information
app.post('/api/assessment/contact', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId, contactName, email, companyName, employeeNumber } = req.body;
    
    if (!sessionId || !contactName || !email || !companyName) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const contactData = {
      name: contactName,
      email,
      company: companyName,
      employees: employeeNumber,
      timestamp: new Date().toISOString()
    };

    await pool.query(
      'UPDATE assessment_sessions SET contact_info = $1, updated_at = NOW() WHERE session_id = $2',
      [JSON.stringify(contactData), sessionId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving contact:', error);
    res.status(500).json({ message: 'Failed to save contact' });
  }
});

// Save chat message for conversation logging
app.post('/api/assessment/chat-message', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId, messageType, content, questionId } = req.body;
    
    if (!sessionId || !messageType || !content) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Create chat_messages table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        message_type VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        question_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insert chat message
    await pool.query(
      'INSERT INTO chat_messages (session_id, message_type, content, question_id) VALUES ($1, $2, $3, $4)',
      [sessionId, messageType, content, questionId || null]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving chat message:', error);
    res.status(500).json({ message: 'Failed to save chat message' });
  }
});

// Initialize assessment - Get first question (SECURE)
app.post('/api/assessment/initialize', async (req, res) => {
  try {
    const { sessionId, language = 'de' } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID required' });
    }

    const t = translations[language];
    const firstQuestion = assessmentQuestions[0];
    
    res.json({
      success: true,
      messages: [
        { type: 'bot', content: t.welcomeMsg1 },
        { type: 'bot', content: t.welcomeMsg2 },
        { type: 'bot', content: `(${t.questionPrefix} 1) ${firstQuestion.text[language]}` }
      ],
      currentQuestionId: firstQuestion.id,
      currentQuestionIndex: 0
    });
  } catch (error) {
    console.error('Error initializing assessment:', error);
    res.status(500).json({ message: 'Failed to initialize assessment' });
  }
});

// Analyze response with AI (SECURE)
app.post('/api/assessment/analyze', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId, questionId, userResponse, currentQuestionIndex, language, isFollowUp } = req.body;
    
    if (!sessionId || !questionId || !userResponse || typeof currentQuestionIndex !== 'number' || !language) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Get question text from server-side array (SECURE)
    const question = assessmentQuestions[currentQuestionIndex];
    if (!question) {
      return res.status(400).json({ message: 'Invalid question index' });
    }
    const questionText = question.text[language];
    
    // Analyze response with AI
    const analysis = await analyzeResponse(questionId, questionText, userResponse, language);
    
    // Store response in database
    await pool.query(`
      UPDATE assessment_sessions 
      SET responses = COALESCE(responses, '{}'::jsonb) || $1::jsonb,
          current_step = $2,
          updated_at = NOW()
      WHERE session_id = $3
    `, [
      JSON.stringify({[questionId]: {
        question: questionText,
        answer: userResponse,
        analysis: analysis.analysis,
        score: analysis.score
      }}),
      currentQuestionIndex + 1,
      sessionId
    ]);

    const t = translations[language];
    
    // Check if follow-up is needed
    if (analysis.needsFollowUp && !isFollowUp) {
      res.json({
        success: true,
        analysis: {
          explanation: analysis.explanation,
          score: analysis.score,
          needsFollowUp: true,
          followUpQuestion: analysis.followUpQuestion
        },
        waitingForFollowUp: true,
        sessionUpdated: true
      });
    } else {
      // Move to next question or complete
      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex < assessmentQuestions.length) {
        const nextQuestion = assessmentQuestions[nextIndex];
        res.json({
          success: true,
          analysis: {
            explanation: analysis.explanation,
            score: analysis.score,
            needsFollowUp: false
          },
          nextQuestion: `(${t.questionPrefix} ${nextIndex + 1}) ${nextQuestion.text[language]}`,
          questionId: nextQuestion.id,
          sessionUpdated: true
        });
      } else {
        res.json({
          success: true,
          analysis: {
            explanation: analysis.explanation,
            score: analysis.score,
            needsFollowUp: false
          },
          isComplete: true,
          sessionUpdated: true
        });
      }
    }
  } catch (error) {
    console.error('Error analyzing response:', error);
    res.status(500).json({ message: 'Failed to analyze response' });
  }
});

// Complete assessment (SECURE)
app.post('/api/assessment/complete', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId, language = 'de' } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID required' });
    }

    // Get session with responses
    const sessionResult = await pool.query(
      'SELECT * FROM assessment_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessionResult.rows[0];
    const responses = session.responses || {};
    
    // Calculate final score (SECURE SERVER-SIDE)
    const readinessScore = calculateReadinessScore(responses);
    
    // Update session with final score
    await pool.query(
      'UPDATE assessment_sessions SET readiness_score = $1, is_completed = true, updated_at = NOW() WHERE session_id = $2',
      [readinessScore, sessionId]
    );

    const t = translations[language];
    
    res.json({
      success: true,
      readinessScore: readinessScore,
      message: {
        content: `${t.completionMsg} ${t.analysisIntro} ${readinessScore}% KI-Readiness.`
      },
      sessionComplete: true
    });
  } catch (error) {
    console.error('Error completing assessment:', error);
    res.status(500).json({ message: 'Failed to complete assessment' });
  }
});

// Update assessment session
app.patch('/api/assessment/session/:sessionId', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId } = req.params;
    const updates = req.body;
    
    // Build dynamic update query
    const setClause = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'sessionId') {
        setClause.push(`${key} = $${paramCount}`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
        paramCount++;
      }
    });

    if (setClause.length === 0) {
      return res.status(400).json({ message: 'No valid updates provided' });
    }

    setClause.push('updated_at = NOW()');
    values.push(sessionId);

    const query = `UPDATE assessment_sessions SET ${setClause.join(', ')} WHERE session_id = $${paramCount} RETURNING *`;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ message: 'Failed to update session' });
  }
});

module.exports.handler = serverless(app);
