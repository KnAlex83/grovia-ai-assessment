// Complete Enhanced Server.js with Chat Logging for netlify/functions/server.js

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

// Database connection
let pool;
try {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
} catch (error) {
  console.error('Database connection error:', error);
}

// Initialize chat_messages table
async function initializeChatTable() {
  if (pool) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id SERIAL PRIMARY KEY,
          session_id TEXT NOT NULL,
          message_type VARCHAR(20) NOT NULL,
          content TEXT NOT NULL,
          question_id TEXT,
          is_follow_up BOOLEAN DEFAULT FALSE,
          ai_analysis JSONB,
          timestamp TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (error) {
      console.error('Error creating chat_messages table:', error);
    }
  }
}
initializeChatTable();

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

// AI Analysis function
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
2. ${isFollowUp ? 'Since this is a follow-up response, set needsFollowUp to false to proceed to next question' : 'Determine if a follow-up question would help uncover more opportunities and strengths'}
3. ${isFollowUp ? 'Provide encouraging summary and excitement for the next topic' : 'If needed, generate ONE curious follow-up question to explore their strengths and opportunities further'}
4. Provide encouraging explanation that builds confidence
5. Score generously from 3-5 (3=good foundation with potential, 4=strong position for AI adoption, 5=excellent readiness)

Respond in JSON format:
{
  "needsFollowUp": ${isFollowUp ? 'false' : 'boolean'},
  "followUpQuestion": "string (only if needsFollowUp is true)",
  "explanation": "encouraging explanation in ${language === 'de' ? 'German' : 'English'}",
  "analysis": "positive analysis focusing on strengths and potential",
  "score": number
}

Keep explanations under 80 words and overwhelmingly positive. Focus on building confidence and excitement about AI potential.`;

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY not configured');
    return {
      needsFollowUp: false,
      explanation: language === 'de' 
        ? 'Danke für Ihre Antwort. Lassen Sie uns zur nächsten Frage übergehen.'
        : 'Thank you for your response. Let\'s move to the next question.',
      analysis: 'Response received',
      score: 3
    };
  }

  try {
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

    try {
      const analysis = JSON.parse(content);
      
      if (typeof analysis.needsFollowUp !== 'boolean' || 
          typeof analysis.explanation !== 'string' ||
          typeof analysis.score !== 'number') {
        throw new Error('Invalid AI response format');
      }
      
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

// Scoring algorithm
function calculateReadinessScore(responses) {
  const weights = {
    '1': 15, '2': 10, '3': 15, '4': 15, '5': 10,
    '6': 10, '7': 10, '8': 10, '9': 5, '10': 0
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

// EXISTING ENDPOINTS (session, consent, contact, analyze, etc.)
app.post('/api/assessment/session', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId, language = 'de' } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID required' });
    }
    
    const existingSession = await pool.query(
      'SELECT * FROM assessment_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (existingSession.rows.length > 0) {
      return res.json(existingSession.rows[0]);
    }
    
    const result = await pool.query(
      'INSERT INTO assessment_sessions (session_id, language, current_step, responses, consent_data_processing, consent_contact_permission, is_completed) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [sessionId, language, 1, JSON.stringify({}), false, false, false]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ message: 'Failed to create session' });
  }
});

app.post('/api/assessment/consent', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId, consentDataProcessing, consentContactPermission } = req.body;
    
    if (!sessionId || typeof consentDataProcessing !== 'boolean') {
      return res.status(400).json({ message: 'Missing required consent data' });
    }

    await pool.query(
      'UPDATE assessment_sessions SET consent_data_processing = $1, consent_contact_permission = $2 WHERE session_id = $3',
      [consentDataProcessing, consentContactPermission || false, sessionId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving consent:', error);
    res.status(500).json({ message: 'Failed to save consent' });
  }
});

app.post('/api/assessment/contact', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId, contactName, email, companyName, employeeNumber } = req.body;
    
    if (!sessionId || !contactName || !email || !companyName) {
      return res.status(400).json({ message: 'Missing required contact information' });
    }

    await pool.query(
      'UPDATE assessment_sessions SET contact_name = $1, email = $2, company_name = $3, employee_number = $4 WHERE session_id = $5',
      [contactName, email, companyName, employeeNumber, sessionId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving contact info:', error);
    res.status(500).json({ message: 'Failed to save contact information' });
  }
});

// NEW: Save individual chat messages for complete conversation logging
app.post('/api/chat/message', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId, messageType, content, questionId, aiAnalysis } = req.body;
    
    if (!sessionId || !messageType || !content) {
      return res.status(400).json({ message: 'Missing required message data' });
    }

    const isFollowUp = questionId && questionId.includes('_followup');
    
    await pool.query(
      'INSERT INTO chat_messages (session_id, message_type, content, question_id, is_follow_up, ai_analysis) VALUES ($1, $2, $3, $4, $5, $6)',
      [sessionId, messageType, content, questionId, isFollowUp, aiAnalysis ? JSON.stringify(aiAnalysis) : null]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving chat message:', error);
    res.status(500).json({ message: 'Failed to save chat message' });
  }
});

// NEW: Get complete conversation for report generation
app.get('/api/chat/conversation/:sessionId', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId } = req.params;
    
    const messagesResult = await pool.query(
      'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY timestamp ASC',
      [sessionId]
    );
    
    const sessionResult = await pool.query(
      'SELECT * FROM assessment_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    res.json({
      session: sessionResult.rows[0],
      conversation: messagesResult.rows,
      totalMessages: messagesResult.rows.length
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ message: 'Failed to get conversation' });
  }
});

// NEW: Generate comprehensive assessment report with complete conversation
app.post('/api/assessment/generate-report', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId } = req.body;
    
    const sessionResult = await pool.query(
      'SELECT * FROM assessment_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    const conversationResult = await pool.query(
      'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY timestamp ASC',
      [sessionId]
    );
    
    const session = sessionResult.rows[0];
    const conversation = conversationResult.rows;
    
    // Generate comprehensive report with all data
    const report = {
      sessionInfo: {
        sessionId: session.session_id,
        contactName: session.contact_name,
        email: session.email,
        companyName: session.company_name,
        employeeNumber: session.employee_number,
        language: session.language,
        completedAt: session.completed_at,
        readinessScore: session.readiness_score
      },
      consentData: {
        dataProcessing: session.consent_data_processing,
        contactPermission: session.consent_contact_permission
      },
      assessmentResults: session.responses || {},
      completeConversation: conversation.map(msg => ({
        type: msg.message_type,
        content: msg.content,
        questionId: msg.question_id,
        isFollowUp: msg.is_follow_up,
        timestamp: msg.timestamp,
        aiAnalysis: msg.ai_analysis
      })),
      conversationSummary: {
        totalMessages: conversation.length,
        userResponses: conversation.filter(m => m.message_type === 'user').length,
        botMessages: conversation.filter(m => m.message_type === 'bot').length,
        followUpQuestions: conversation.filter(m => m.is_follow_up).length,
        questionsAnswered: [...new Set(conversation.filter(m => m.question_id && !m.is_follow_up).map(m => m.question_id))].length
      },
      generatedAt: new Date().toISOString()
    };
    
    res.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ message: 'Failed to generate report' });
  }
});

// Continue with existing endpoints...
app.post('/api/assessment/analyze', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId, questionId, questionText, userResponse, language } = req.body;
    
    if (!sessionId || !questionId || !questionText || !userResponse || !language) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const sessionResult = await pool.query(
      'SELECT * FROM assessment_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessionResult.rows[0];
    const aiAnalysis = await analyzeResponse(questionId, questionText, userResponse, language);
    
    const currentResponses = session.responses || {};
    currentResponses[questionId] = {
      userResponse,
      questionText,
      ...aiAnalysis,
      timestamp: new Date().toISOString()
    };

    await pool.query(
      'UPDATE assessment_sessions SET responses = $1 WHERE session_id = $2',
      [JSON.stringify(currentResponses), sessionId]
    );

    res.json({
      analysis: aiAnalysis,
      sessionUpdated: true
    });
  } catch (error) {
    console.error('Error analyzing response:', error);
    res.status(500).json({ message: 'Failed to analyze response' });
  }
});

// Continue with remaining endpoints (complete, send-report, export-data)...
app.post('/api/assessment/complete', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID required' });
    }
    
    const sessionResult = await pool.query(
      'SELECT * FROM assessment_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    const session = sessionResult.rows[0];
    const readinessScore = calculateReadinessScore(session.responses || {});
    
    await pool.query(
      'UPDATE assessment_sessions SET readiness_score = $1, is_completed = $2, completed_at = $3 WHERE session_id = $4',
      [readinessScore, true, new Date(), sessionId]
    );
    
    res.json({
      readinessScore,
      completed: true
    });
  } catch (error) {
    console.error('Error completing assessment:', error);
    res.status(500).json({ message: 'Failed to complete assessment' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

module.exports.handler = serverless(app);
