import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAssessmentSessionSchema, insertEmailReportSchema } from "@shared/schema";
import { z } from "zod";
import { sendAssessmentReport } from "./lib/email-service";
import { generateAssessmentReport } from "./lib/report-generator";
import { analyzeResponse, generateFinalAssessment } from "./lib/ai-service";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create or get assessment session
  app.post("/api/assessment/session", async (req, res) => {
    try {
      const sessionData = insertAssessmentSessionSchema.parse(req.body);
      
      // Check if session already exists
      const existingSession = await storage.getAssessmentSession(sessionData.sessionId);
      if (existingSession) {
        return res.json(existingSession);
      }
      
      const session = await storage.createAssessmentSession(sessionData);
      res.json(session);
    } catch (error) {
      console.error("Error creating assessment session:", error);
      res.status(400).json({ 
        message: error instanceof z.ZodError ? "Invalid session data" : "Failed to create session" 
      });
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
      console.error("Error getting assessment session:", error);
      res.status(500).json({ message: "Failed to get session" });
    }
  });

  // Analyze response and get follow-up or next question
  app.post("/api/assessment/analyze", async (req, res) => {
    try {
      const { sessionId, questionId, questionText, userResponse, language } = req.body;
      
      if (!sessionId || !questionId || !questionText || !userResponse || !language) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Get current session
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

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
      await storage.updateAssessmentSession(sessionId, {
        responses: currentResponses,
        currentStep: session.currentStep || 1
      });

      res.json({
        analysis: aiAnalysis,
        sessionUpdated: true
      });
    } catch (error) {
      console.error("Error analyzing response:", error);
      res.status(500).json({ message: "Failed to analyze response" });
    }
  });

  // Update assessment session
  app.patch("/api/assessment/session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const updates = req.body;
      
      const session = await storage.updateAssessmentSession(sessionId, updates);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error updating assessment session:", error);
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  // Submit assessment response with AI analysis
  app.post("/api/assessment/response", async (req, res) => {
    try {
      const { sessionId, questionId, userResponse, questionText, currentStep } = req.body;
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Analyze response with AI
      const aiAnalysis = await analyzeResponse(
        questionId,
        questionText,
        userResponse,
        session.language as 'de' | 'en'
      );

      const responseData = {
        userResponse,
        aiAnalysis,
        timestamp: new Date().toISOString()
      };

      const responses = session.responses ? 
        { ...(session.responses as Record<string, any>), [questionId]: responseData } :
        { [questionId]: responseData };
      
      const updatedSession = await storage.updateAssessmentSession(sessionId, {
        responses,
        currentStep,
      });

      res.json({ session: updatedSession, aiAnalysis });
    } catch (error) {
      console.error("Error submitting response:", error);
      res.status(500).json({ message: "Failed to submit response" });
    }
  });

  // Complete assessment and calculate score
  app.post("/api/assessment/complete", async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Calculate readiness score (implement scoring logic)
      const readinessScore = calculateReadinessScore(session.responses as Record<string, any>);
      
      const updatedSession = await storage.updateAssessmentSession(sessionId, {
        isCompleted: true,
        readinessScore,
      });

      res.json(updatedSession);
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

      // Send email
      await sendAssessmentReport(email, reportData, session.language);

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
      // Get all assessment sessions with complete data
      const sessions = await storage.getAllAssessmentSessions();
      
      // Get all email reports
      const emailReports = await storage.getAllEmailReports();
      
      // Format data for export
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

  const httpServer = createServer(app);
  return httpServer;
}

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
    
    if (response) {
      // Score based on response quality
      let questionScore = 0;
      
      switch (questionId) {
        case '1': // Main goal
          questionScore = ['efficiency', 'customer-experience', 'revenue'].includes(response) ? weight : weight * 0.5;
          break;
        case '2': // AI experience
          questionScore = response === 'yes' ? weight : weight * 0.3;
          break;
        case '3': // IT infrastructure
          questionScore = response === 'cloud' ? weight : response === 'hybrid' ? weight * 0.8 : weight * 0.6;
          break;
        case '4': // Data quality
          questionScore = response === 'structured' ? weight : weight * 0.5;
          break;
        case '5': // Data compliance
          questionScore = response === 'yes' ? weight : weight * 0.3;
          break;
        case '6': // Process optimization
          questionScore = response ? weight * 0.8 : weight * 0.2;
          break;
        case '7': // Team readiness
          questionScore = response === 'experienced' ? weight : response === 'planned' ? weight * 0.6 : weight * 0.2;
          break;
        case '8': // Management support
          questionScore = response === 'yes' ? weight : weight * 0.2;
          break;
        case '9': // Risk awareness
          questionScore = response ? weight * 0.7 : weight * 0.3;
          break;
        default:
          questionScore = weight * 0.5;
      }
      
      totalScore += questionScore;
    }
  });

  const rawScore = Math.round((totalScore / maxPossibleScore) * 100);
  // Ensure score never goes below 30% to maintain client confidence
  return Math.max(rawScore, 30);
}
