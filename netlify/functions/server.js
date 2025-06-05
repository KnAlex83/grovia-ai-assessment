const express = require('express');
const serverless = require('serverless-http');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

// Configure Neon for serverless
neonConfig.webSocketConstructor = ws;

const app = express();
app.use(express.json());

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

  // Check if OpenRouter API key is available
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
        'HTTP-Referer': 'https://ai-assessment.grovia-digital.com',
        'X-Title': 'AI Readiness Assessment'
      },
      body: JSON.stringify({
        model: CONFIG.AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: CONFIG.AI_MAX_TOKENS,
        temperature: CONFIG.AI_TEMPERATURE
      })
    });

    if (!response.ok) {
      console.error(`OpenRouter API error: ${response.status} - ${response.statusText}`);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const aiResponse = JSON.parse(content);
    
    if (aiResponse.score < CONFIG.MIN_QUESTION_SCORE) {
      aiResponse.score = CONFIG.MIN_QUESTION_SCORE;
    }
    
    return aiResponse;
  } catch (error) {
    console.error('Error analyzing response:', error);
    
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

// Calculate readiness score
function calculateReadinessScore(responses) {
  const scores = Object.values(responses)
    .map(r => r.score || 3)
    .filter(score => typeof score === 'number');
  
  if (scores.length === 0) return 65;
  
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const percentage = Math.round((average / 5) * 100);
  
  return Math.max(CONFIG.MIN_OVERALL_SCORE, Math.min(percentage, CONFIG.MAX_REALISTIC_SCORE));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    database: pool ? 'connected' : 'not configured',
    openrouter: process.env.OPENROUTER_API_KEY ? 'configured' : 'not configured'
  });
});

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

    // Check if session already exists
    const existingResult = await pool.query(
      'SELECT * FROM assessment_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (existingResult.rows.length > 0) {
      return res.json(existingResult.rows[0]);
    }
    
    // Create new session
    const result = await pool.query(
      'INSERT INTO assessment_sessions (session_id, language, responses, current_step, consent_data_processing, consent_contact_permission, is_completed, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [sessionId, language, '{}', 1, false, false, false, new Date()]
    );
    
    res.json(result.rows[0]);
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
    const result = await pool.query(
      'SELECT * FROM assessment_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ message: 'Failed to get session' });
  }
});

// Analyze response endpoint
app.post('/api/assessment/analyze', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId, questionId, questionText, userResponse, language } = req.body;
    
    if (!sessionId || !questionId || !questionText || !userResponse || !language) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Get current session
    const sessionResult = await pool.query(
      'SELECT * FROM assessment_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    const session = sessionResult.rows[0];
    
    // Analyze response with AI
    const aiAnalysis = await analyzeResponse(questionId, questionText, userResponse, language);
    
    // Update session with new response
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

// Update assessment session
app.patch('/api/assessment/session/:sessionId', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId } = req.params;
    const updates = req.body;
    
    const fields = [];
    const values = [];
    let paramCounter = 1;
    
    // Convert camelCase to snake_case for database fields
    Object.entries(updates).forEach(([key, value]) => {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${dbKey} = $${paramCounter}`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      paramCounter++;
    });
    
    if (fields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    
    values.push(sessionId);
    const query = `UPDATE assessment_sessions SET ${fields.join(', ')} WHERE session_id = $${paramCounter} RETURNING *`;
    
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

// Complete assessment
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
