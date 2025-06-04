import { users, assessmentSessions, emailReports, type User, type InsertUser, type AssessmentSession, type InsertAssessmentSession, type EmailReport, type InsertEmailReport } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Assessment Session methods
  createAssessmentSession(session: InsertAssessmentSession): Promise<AssessmentSession>;
  getAssessmentSession(sessionId: string): Promise<AssessmentSession | undefined>;
  updateAssessmentSession(sessionId: string, updates: Partial<AssessmentSession>): Promise<AssessmentSession | undefined>;
  
  // Email Report methods
  createEmailReport(report: InsertEmailReport): Promise<EmailReport>;
  getEmailReportsBySession(sessionId: string): Promise<EmailReport[]>;
  
  // Admin methods
  getAllAssessmentSessions(): Promise<AssessmentSession[]>;
  getAllEmailReports(): Promise<EmailReport[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createAssessmentSession(insertSession: InsertAssessmentSession): Promise<AssessmentSession> {
    const [session] = await db
      .insert(assessmentSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getAssessmentSession(sessionId: string): Promise<AssessmentSession | undefined> {
    const [session] = await db
      .select()
      .from(assessmentSessions)
      .where(eq(assessmentSessions.sessionId, sessionId));
    return session || undefined;
  }

  async updateAssessmentSession(sessionId: string, updates: Partial<AssessmentSession>): Promise<AssessmentSession | undefined> {
    const updateData: any = { ...updates };
    if (updates.isCompleted) {
      updateData.completedAt = new Date();
    }
    delete updateData.id;
    delete updateData.createdAt;
    
    const [session] = await db
      .update(assessmentSessions)
      .set(updateData)
      .where(eq(assessmentSessions.sessionId, sessionId))
      .returning();
    return session || undefined;
  }

  async createEmailReport(insertReport: InsertEmailReport): Promise<EmailReport> {
    const [report] = await db
      .insert(emailReports)
      .values(insertReport)
      .returning();
    return report;
  }

  async getEmailReportsBySession(sessionId: string): Promise<EmailReport[]> {
    const reports = await db
      .select()
      .from(emailReports)
      .where(eq(emailReports.sessionId, sessionId));
    return reports;
  }

  async getAllAssessmentSessions(): Promise<AssessmentSession[]> {
    return await db.select().from(assessmentSessions).orderBy(assessmentSessions.createdAt);
  }

  async getAllEmailReports(): Promise<EmailReport[]> {
    return await db.select().from(emailReports).orderBy(emailReports.sentAt);
  }
}

export const storage = new DatabaseStorage();
