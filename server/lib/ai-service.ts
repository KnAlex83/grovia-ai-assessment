// Import will be resolved at runtime

// the newest Anthropic model is "claude-sonnet-4-20250514" which was released May 14, 2025. Use this by default unless user has already selected claude-3-7-sonnet-20250219
interface AIResponse {
  needsFollowUp: boolean;
  followUpQuestion?: string;
  explanation?: string;
  analysis: string;
  score: number; // 1-5 scale for this specific answer
}

interface AssessmentAnalysis {
  overallScore: number;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
}

// Question mapping for AI context
const questionContexts = {
  '1': 'AI goals and objectives',
  '2': 'Previous AI experience',
  '3': 'IT infrastructure setup',
  '4': 'Data collection and storage',
  '5': 'Data protection compliance',
  '6': 'Business process automation',
  '7': 'Team AI experience and training',
  '8': 'Management support and budget',
  '9': 'Risks and challenges',
  '10': 'Implementation timeline'
};

export async function analyzeResponse(
  questionId: string,
  questionText: string,
  userResponse: string,
  language: 'de' | 'en'
): Promise<AIResponse> {
  // Check if this is a follow-up response - if so, always proceed to next question
  const isFollowUp = questionId.includes('_followup');
  
  const prompt = `You are an AI Readiness Assessment expert. Analyze this response to an AI readiness question.

Question: ${questionText}
User Response: ${userResponse}
Language: ${language}
Is Follow-up Response: ${isFollowUp}

Your task:
1. Analyze the quality and depth of the response
2. ${isFollowUp ? 'Since this is a follow-up response, set needsFollowUp to false to proceed to next question' : 'Determine if a follow-up question would help get more specific information'}
3. ${isFollowUp ? 'Provide encouraging feedback and transition to next question' : 'If needed, generate ONE targeted follow-up question that digs deeper'}
4. Provide a brief explanation to help the user understand the context
5. Score the response from 1-5 (1=very poor AI readiness, 5=excellent AI readiness)

Respond in JSON format:
{
  "needsFollowUp": ${isFollowUp ? 'false' : 'boolean'},
  "followUpQuestion": "string (only if needsFollowUp is true)",
  "explanation": "brief explanation in ${language === 'de' ? 'German' : 'English'}",
  "analysis": "brief analysis of the response quality",
  "score": number
}

Guidelines:
- Keep explanations under 100 words
- Follow-up questions should be specific and actionable
- Focus on practical AI implementation aspects
- Be encouraging but honest in assessment
- ${isFollowUp ? 'For follow-up responses, provide positive acknowledgment and signal readiness to continue' : ''}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-readiness-assessment.com',
        'X-Title': 'AI Readiness Assessment'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet:beta',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    const aiResponse = JSON.parse(content) as AIResponse;
    
    return aiResponse;
  } catch (error) {
    console.error('Error analyzing response:', error);
    
    // Fallback response
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

export async function generateFinalAssessment(
  responses: Record<string, any>,
  language: 'de' | 'en'
): Promise<AssessmentAnalysis> {
  const responseEntries = Object.entries(responses)
    .map(([questionId, response]) => {
      const questionContext = questionContexts[questionId as keyof typeof questionContexts] || 'Assessment question';
      return `Q${questionId}: ${questionContext}\nA: ${response.userResponse || response}\nScore: ${response.score || 'N/A'}`;
    })
    .join('\n\n');

  const prompt = `You are an AI Readiness Assessment expert. Analyze these responses and provide a comprehensive assessment.

Assessment Responses:
${responseEntries}

Language: ${language}

Provide a comprehensive analysis in JSON format:
{
  "overallScore": number (0-100),
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["improvement1", "improvement2", "improvement3"],
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"]
}

Guidelines:
- Overall score should reflect AI readiness (0-100)
- Strengths should highlight positive aspects for AI adoption
- Improvements should identify specific areas needing work
- Recommendations should be actionable next steps
- Keep each item concise (under 50 words)
- Write in ${language === 'de' ? 'German' : 'English'}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-readiness-assessment.com',
        'X-Title': 'AI Readiness Assessment'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet:beta',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.6
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    const analysis = JSON.parse(content) as AssessmentAnalysis;
    
    return analysis;
  } catch (error) {
    console.error('Error generating final assessment:', error);
    
    // Fallback assessment
    return {
      overallScore: 50,
      strengths: language === 'de' 
        ? ['Interesse an KI-Technologie', 'Bereitschaft zur Veränderung', 'Bewusstsein für Digitalisierung']
        : ['Interest in AI technology', 'Willingness to change', 'Awareness of digitalization'],
      improvements: language === 'de'
        ? ['KI-Expertise aufbauen', 'Datenqualität verbessern', 'Strategische Planung']
        : ['Build AI expertise', 'Improve data quality', 'Strategic planning'],
      recommendations: language === 'de'
        ? ['KI-Schulungen durchführen', 'Pilotprojekt starten', 'Externe Beratung suchen']
        : ['Conduct AI training', 'Start pilot project', 'Seek external consultation']
    };
  }
}
