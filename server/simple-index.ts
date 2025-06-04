import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { storage } from "./file-storage";
import { generateAssessmentReport } from "./lib/report-generator";
import { sendAssessmentReport } from "./lib/email-service";
import { analyzeResponse, generateFinalAssessment } from "./lib/ai-service";
import { nanoid } from "nanoid";

const app = express();
app.use(express.json());
app.use(express.static("public"));

// CORS for development
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Create new assessment session
app.post("/api/assessment/session", async (req, res) => {
  try {
    const sessionId = nanoid();
    const language = req.body.language || 'de';
    
    const session = await storage.createAssessmentSession({
      sessionId,
      language
    });

    res.json(session);
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ message: "Failed to create session" });
  }
});

// Get assessment session
app.get("/api/assessment/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await storage.getAssessmentSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    res.json(session);
  } catch (error) {
    console.error("Error fetching session:", error);
    res.status(500).json({ message: "Failed to fetch session" });
  }
});

// Update assessment session
app.post("/api/assessment/session", async (req, res) => {
  try {
    const updates = req.body;
    const sessionId = updates.sessionId;
    
    if (!sessionId) {
      return res.status(400).json({ message: "Session ID required" });
    }

    const session = await storage.updateAssessmentSession(sessionId, updates);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    res.json(session);
  } catch (error) {
    console.error("Error updating session:", error);
    res.status(500).json({ message: "Failed to update session" });
  }
});

// Analyze response
app.post("/api/assessment/analyze", async (req, res) => {
  try {
    const { sessionId, questionId, questionText, userResponse, language } = req.body;
    
    // Get or create session
    let session = await storage.getAssessmentSession(sessionId);
    if (!session) {
      session = await storage.createAssessmentSession({ sessionId, language });
    }

    // Check if OpenRouter API key is available
    if (!process.env.OPENROUTER_API_KEY) {
      // Fallback to simple response without AI analysis
      const needsFollowUp = userResponse.length < 20; // Simple heuristic
      const followUpQuestion = needsFollowUp ? 
        (language === 'de' ? 'Können Sie das etwas genauer erklären?' : 'Could you explain that in more detail?') :
        undefined;

      return res.json({
        analysis: {
          needsFollowUp,
          followUpQuestion,
          explanation: language === 'de' ? 'Vielen Dank für Ihre Antwort.' : 'Thank you for your response.',
          analysis: 'Response received',
          score: 3
        }
      });
    }

    // Use AI analysis if API key is available
    const analysis = await analyzeResponse(questionId, questionText, userResponse, language);

    // Store response in session
    const updatedResponses = { 
      ...session.responses, 
      [questionId]: {
        question: questionText,
        answer: userResponse,
        score: analysis.score,
        timestamp: new Date().toISOString()
      }
    };

    await storage.updateAssessmentSession(sessionId, {
      responses: updatedResponses
    });

    res.json({ analysis });
  } catch (error) {
    console.error("Error analyzing response:", error);
    res.status(500).json({ message: "Failed to analyze response" });
  }
});

// Complete assessment
app.post("/api/assessment/complete", async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    const session = await storage.getAssessmentSession(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Calculate readiness score
    const readinessScore = calculateReadinessScore(session.responses);

    // Mark as completed
    const completedSession = await storage.updateAssessmentSession(sessionId, {
      isCompleted: true,
      readinessScore,
      completedAt: new Date()
    });

    res.json(completedSession);
  } catch (error) {
    console.error("Error completing assessment:", error);
    res.status(500).json({ message: "Failed to complete assessment" });
  }
});

// Send email report
app.post("/api/assessment/send-report", async (req, res) => {
  try {
    const { sessionId, name, email, companyName, employeeNumber } = req.body;
    
    const session = await storage.getAssessmentSession(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (!session.isCompleted) {
      return res.status(400).json({ message: "Assessment not completed" });
    }

    // Update session with contact info
    await storage.updateAssessmentSession(sessionId, {
      contactName: name,
      email,
      companyName,
      employeeNumber,
    });

    // Generate report
    const reportData = generateAssessmentReport(session, companyName);

    // Send email (if configured)
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await sendAssessmentReport(email, reportData, session.language);
    }

    // Store email report record
    const emailReport = await storage.createEmailReport({
      sessionId,
      email,
      companyName,
      reportData,
    });

    res.json({ success: true, reportId: emailReport.id });
  } catch (error) {
    console.error("Error sending report:", error);
    res.status(500).json({ message: "Failed to send report" });
  }
});

// Admin endpoint to export all assessment data
app.get("/api/admin/export-data", async (req, res) => {
  try {
    const sessions = await storage.getAllAssessmentSessions();
    const emailReports = await storage.getAllEmailReports();
    
    const exportData = {
      sessions: sessions.map(session => ({
        sessionId: session.sessionId,
        contactName: session.contactName,
        email: session.email,
        companyName: session.companyName,
        employeeNumber: session.employeeNumber,
        consentDataProcessing: session.consentDataProcessing,
        consentContactPermission: session.consentContactPermission,
        language: session.language,
        readinessScore: session.readinessScore,
        responses: session.responses,
        isCompleted: session.isCompleted,
        createdAt: session.createdAt,
        completedAt: session.completedAt
      })),
      emailReports: emailReports.map(report => ({
        sessionId: report.sessionId,
        email: report.email,
        companyName: report.companyName,
        reportData: report.reportData,
        sentAt: report.sentAt
      })),
      totalSessions: sessions.length,
      completedSessions: sessions.filter(s => s.isCompleted).length,
      exportedAt: new Date().toISOString()
    };
    
    res.json(exportData);
  } catch (error) {
    console.error("Error exporting data:", error);
    res.status(500).json({ message: "Failed to export data" });
  }
});

// Error handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

const port = process.env.PORT || 3000;
const server = createServer(app);

server.listen(port, () => {
  console.log(`AI Assessment server running on port ${port}`);
});

// Simple scoring algorithm
function calculateReadinessScore(responses: Record<string, any>): number {
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
      totalScore += (response.score / 5) * weight; // Normalize score to weight
    }
  });

  const rawScore = Math.round((totalScore / maxPossibleScore) * 100);
  return Math.max(rawScore, 30); // Minimum 30% score
}
