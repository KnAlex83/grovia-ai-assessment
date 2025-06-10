const express = require('express');
const serverless = require('serverless-http');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

// Configure Neon for serverless
neonConfig.webSocketConstructor = ws;

const app = express();
app.use(express.json());

// Add routing middleware for Netlify Functions
app.use((req, res, next) => {
  const originalUrl = req.originalUrl || req.url;
  if (originalUrl.startsWith('/.netlify/functions/server')) {
    req.url = originalUrl.replace('/.netlify/functions/server', '');
  }
  next();
});

// Database connection with error handling
// Enhanced Neon database connection for serverless
let pool;

async function initializeDatabase() {
  try {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL environment variable is not set');
      return null;
    }
    
    pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 0,
      connectionTimeoutMillis: 0,
    });
    
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('Database connected successfully');
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

// Translations
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
// Initialize assessment session - SECURE ENDPOINT
app.post('/api/assessment/initialize', async (req, res) => {
  try {
    const { sessionId, language = 'de' } = req.body;
    
    // Ensure database connection
    const dbPool = await getPool();
    
    if (dbPool) {
      try {
        // Ensure table exists with all required columns
        await dbPool.query(`
          CREATE TABLE IF NOT EXISTS assessment_sessions (
            id SERIAL PRIMARY KEY,
            session_id VARCHAR(255) UNIQUE NOT NULL,
            language VARCHAR(10) DEFAULT 'de',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            current_step INTEGER DEFAULT 0,
            consent_data_processing BOOLEAN DEFAULT FALSE,
            consent_contact_permission BOOLEAN DEFAULT FALSE,
            contact_name VARCHAR(255),
            email VARCHAR(255),
            company_name VARCHAR(255),
            employee_number VARCHAR(50),
            responses JSONB DEFAULT '{}'::jsonb,
            readiness_score INTEGER,
            is_completed BOOLEAN DEFAULT FALSE,
            completed_at TIMESTAMP
          )
        `);
        
        // Create session if it doesn't exist
        await dbPool.query(`
          INSERT INTO assessment_sessions (
            session_id, language, created_at, current_step, 
            consent_data_processing, consent_contact_permission, 
            contact_name, email, company_name, employee_number,
            responses, readiness_score, is_completed
          )
          VALUES ($1, $2, NOW(), 0, false, false, null, null, null, null, '{}'::jsonb, null, false)
          ON CONFLICT (session_id) DO NOTHING
        `, [sessionId, language]);
      } catch (dbError) {
        console.log('Session might already exist:', dbError.message);
      }
    }

    const t = translations[language];
    
    res.json({
      success: true,
      sessionId: sessionId,
      messages: [
        { type: 'bot', content: t.welcomeMsg1 },
        { type: 'bot', content: t.welcomeMsg2 }
      ]
    });
  } catch (error) {
    console.error('Error initializing session:', error);
    res.status(500).json({ error: 'Failed to initialize session' });
  }
});

// Handle question submission and analysis - SECURE ENDPOINT
app.post('/api/assessment/submit', async (req, res) => {
  try {
    const { sessionId, questionId, response, currentQuestionIndex, language, isFollowUp } = req.body;
    
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const question = assessmentQuestions[currentQuestionIndex];
    const questionText = question.text[language];
    
    // Analyze response with AI
    const analysis = await analyzeResponse(questionId, questionText, response, language);
    
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
        answer: response,
        analysis: analysis.analysis,
        score: analysis.score
      }}),
      currentQuestionIndex + 1,
      sessionId
    ]);

    const t = translations[language];
    const messages = [];

    // Check if follow-up is needed
    if (analysis.needsFollowUp && !isFollowUp) {
      messages.push({
        type: 'bot',
        content: `(${t.followUpPrefix} ${currentQuestionIndex + 1}) ${analysis.followUpQuestion}`
      });
      
      res.json({
        success: true,
        analysis: {
          explanation: analysis.explanation,
          score: analysis.score,
          needsFollowUp: true,
          followUpQuestion: `(Nachfrage ${currentQuestionIndex + 1}) ${analysis.followUpQuestion}`
        },
        waitingForFollowUp: true,
        sessionUpdated: true
      });
    } else {
      // Move to next question or complete
      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex < assessmentQuestions.length) {
        const nextQuestion = assessmentQuestions[nextIndex];
        messages.push({
          type: 'bot',
          content: `(${t.questionPrefix} ${nextIndex + 1}) ${nextQuestion.text[language]}`
        });
        
        res.json({
          success: true,
          analysis: {
            explanation: analysis.explanation,
            score: analysis.score,
            needsFollowUp: false
          },
          nextQuestion: `(Frage ${nextIndex + 1}) ${nextQuestion.text[language]}`,
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
          analysis: analysis.explanation,
          score: analysis.score,
          isComplete: true
        });
      }
    }
  } catch (error) {
    console.error('Error submitting response:', error);
    res.status(500).json({ error: 'Failed to submit response' });
  }
});
// Create or get assessment session
app.post('/api/assessment/consent', async (req, res) => {
  try {
    const { sessionId, consentDataProcessing, consentContactPermission, language = 'de' } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const dbPool = await getPool();
    if (!dbPool) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    await dbPool.query(`
      UPDATE assessment_sessions SET
        consent_data_processing = $1,
        consent_contact_permission = $2,
        current_step = 1
      WHERE session_id = $3
    `, [consentDataProcessing, consentContactPermission, sessionId]);

    const t = translations[language] || translations['de'];
    
    res.json({
      success: true,
      message: { type: 'bot', content: t.consentThanks }
    });
    
  } catch (error) {
    console.error('Consent endpoint error:', error);
    res.status(500).json({ error: 'Failed to save consent' });
  }
});

    try {
      const client = await connectionPool.connect();
      
      // Simple upsert without referencing updated_at column
      await client.query(`
        INSERT INTO assessment_sessions (
          session_id, language, consent_data_processing, 
          consent_contact_permission, current_step, created_at
        )
        VALUES ($1, $2, $3, $4, 1, NOW())
        ON CONFLICT (session_id) DO UPDATE SET
          consent_data_processing = $3,
          consent_contact_permission = $4,
          current_step = 1
      `, [sessionId, language, consentDataProcessing, consentContactPermission]);

      client.release();
      
      const t = translations[language] || translations['de'];
      
      res.json({
        success: true,
        message: { type: 'bot', content: t.consentThanks || 'Vielen Dank für Ihre Einverständniserklärung!' }
      });
      
    } finally {
      await connectionPool.end();
    }
    
  } catch (error) {
    console.error('Consent endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to save consent',
      details: error.message 
    });
  }
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
    
    // Check if session exists
    const existingSession = await pool.query(
      'SELECT * FROM assessment_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (existingSession.rows.length > 0) {
      return res.json(existingSession.rows[0]);
    }
    
    // Create new session
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

// Save contact information - NEW ENDPOINT
app.post('/api/assessment/contact', async (req, res) => {
  try {
    const { sessionId, contactName, email, companyName, employeeNumber, language = 'de' } = req.body;
    
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    await pool.query(`
      UPDATE assessment_sessions 
      SET contact_name = $1,
          email = $2,
          company_name = $3,
          employee_number = $4,
          current_step = 2
      WHERE session_id = $5
    `, [contactName, email, companyName, employeeNumber, sessionId]);

    const t = translations[language];
    const firstQuestion = assessmentQuestions[0];
    
    res.json({
      success: true,
      messages: [
        { type: 'bot', content: `Vielen Dank, ${contactName}! ${t.assessmentStart}` },
        { type: 'bot', content: `(${t.questionPrefix} 1) ${firstQuestion.text[language]}` }
      ],
      nextQuestion: firstQuestion,
      nextStep: 'questions'
    });
  } catch (error) {
    console.error('Error saving contact:', error);
    res.status(500).json({ error: 'Failed to save contact' });
  }
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
    
    // Check if session exists
    const existingSession = await pool.query(
      'SELECT * FROM assessment_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (existingSession.rows.length > 0) {
      return res.json(existingSession.rows[0]);
    }
    
    // Create new session
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
// Analyze response with AI
app.post('/api/assessment/analyze', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

      const { sessionId, questionId, userResponse, language } = req.body;

      // Look up question text from server-side array
      const question = assessmentQuestions.find(q => q.id === questionId);
      if (!question) {
        return res.status(400).json({ message: 'Invalid question ID' });
      }
      const questionText = question.text[language] || question.text.de;
    
    if (!sessionId || !questionId || !userResponse || !language) {
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
      sessionUpdated: true
    };

    // Handle follow-up logic
    if (aiAnalysis.needsFollowUp && !questionId.includes('_followup')) {
      responseData.waitingForFollowUp = true;
    } else {
      // Move to next question or complete assessment
      const nextIndex = currentIndex + 1;
      if (nextIndex < totalQuestions) {
        const nextQuestion = assessmentQuestions[nextIndex];
        responseData.nextQuestion = nextQuestion.text[language];
        responseData.questionId = nextQuestion.id;
      } else {
        responseData.isComplete = true;
      }
    }

    res.json(responseData);
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
    
    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let valueIndex = 1;
    
    const allowedFields = [
      'current_step', 'responses', 'consent_data_processing', 
      'consent_contact_permission', 'contact_name', 'email', 
      'company_name', 'employee_number', 'readiness_score', 
      'is_completed', 'language'
    ];
    
    Object.entries(updates).forEach(([key, value]) => {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbField)) {
        updateFields.push(`${dbField} = $${valueIndex}`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
        valueIndex++;
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    
    if (updates.isCompleted) {
      updateFields.push(`completed_at = $${valueIndex}`);
      values.push(new Date());
      valueIndex++;
    }
    
    values.push(sessionId);
    
    const query = `UPDATE assessment_sessions SET ${updateFields.join(', ')} WHERE session_id = $${valueIndex} RETURNING *`;
    
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

// Send email report
app.post('/api/assessment/send-report', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    const { sessionId, name, email, companyName, employeeNumber } = req.body;
    
    const sessionResult = await pool.query(
      'SELECT * FROM assessment_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    if (!session.is_completed) {
      return res.status(400).json({ message: 'Assessment not completed' });
    }

    // Update session with contact info if not already set
    if (name || email || companyName || employeeNumber) {
      await pool.query(
        'UPDATE assessment_sessions SET contact_name = COALESCE($1, contact_name), email = COALESCE($2, email), company_name = COALESCE($3, company_name), employee_number = COALESCE($4, employee_number) WHERE session_id = $5',
        [name, email, companyName, employeeNumber, sessionId]
      );
    }

    // Store email report record
    await pool.query(
      'INSERT INTO email_reports (session_id, email, company_name, report_data) VALUES ($1, $2, $3, $4)',
      [sessionId, email || session.email, companyName || session.company_name, JSON.stringify({ readinessScore: session.readiness_score, responses: session.responses })]
    );

    res.json({ success: true, message: 'Report sent successfully' });
  } catch (error) {
    console.error('Error sending report:', error);
    res.status(500).json({ message: 'Failed to send report' });
  }
});

// Admin endpoint to export all assessment data
app.get('/api/admin/export-data', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ message: 'Database not configured' });
    }

    // Get all assessment sessions
    const sessionsResult = await pool.query(
      'SELECT * FROM assessment_sessions ORDER BY created_at DESC'
    );
    
    // Get all email reports
    const reportsResult = await pool.query(
      'SELECT * FROM email_reports ORDER BY sent_at DESC'
    );
    
    const sessions = sessionsResult.rows;
    const emailReports = reportsResult.rows;
    
    // Format data for export
    const exportData = {
      sessions: sessions.map(session => ({
        sessionId: session.session_id,
        contactName: session.contact_name,
        email: session.email,
        companyName: session.company_name,
        employeeNumber: session.employee_number,
        consentDataProcessing: session.consent_data_processing,
        consentContactPermission: session.consent_contact_permission,
        language: session.language,
        readinessScore: session.readiness_score,
        responses: session.responses,
        isCompleted: session.is_completed,
        createdAt: session.created_at,
        completedAt: session.completed_at
      })),
      emailReports: emailReports.map(report => ({
        sessionId: report.session_id,
        email: report.email,
        companyName: report.company_name,
        reportData: report.report_data,
        sentAt: report.sent_at
      })),
      totalSessions: sessions.length,
      completedSessions: sessions.filter(s => s.is_completed).length,
      exportedAt: new Date().toISOString()
    };
    
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ message: 'Failed to export data' });
  }
});

// Get complete assessment data for webhook
app.post('/api/assessment/complete-data', async (req, res) => {
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

    const chatResult = await pool.query(
      'SELECT message_type, content, question_id, timestamp FROM chat_messages WHERE session_id = $1 ORDER BY timestamp ASC',
      [sessionId]
    );

    const webhookPayload = {
      session_id: session.session_id,
      language: session.language,
      consent: {
        data_processing: session.consent_data_processing,
        contact_permission: session.consent_contact_permission
      },
      contact: {
        name: session.contact_name,
        email: session.email,
        company_name: session.company_name,
        employee_number: session.employee_number
      },
      assessment: {
        readiness_score: session.readiness_score,
        is_completed: session.is_completed,
        responses: session.responses,
        created_at: session.created_at,
        completed_at: session.completed_at
      },
      chat_conversation: chatResult.rows.map(msg => ({
        type: msg.message_type,
        content: msg.content,
        question_id: msg.question_id,
        timestamp: msg.timestamp
      })),
      metadata: {
        webhook_generated_at: new Date().toISOString(),
        total_messages: chatResult.rows.length
      }
    };

    res.json(webhookPayload);
  } catch (error) {
    console.error('Error preparing webhook data:', error);
    res.status(500).json({ message: 'Failed to prepare assessment data' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

module.exports.handler = serverless(app);
