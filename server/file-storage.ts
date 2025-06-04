import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';

// Simple file-based storage for easy deployment
interface AssessmentSession {
  id: number;
  sessionId: string;
  email?: string;
  contactName?: string;
  companyName?: string;
  employeeNumber?: string;
  currentStep: number;
  responses: Record<string, any>;
  consentDataProcessing: boolean;
  consentContactPermission: boolean;
  readinessScore?: number;
  isCompleted: boolean;
  language: string;
  createdAt: Date;
  completedAt?: Date;
}

interface EmailReport {
  id: number;
  sessionId: string;
  email: string;
  companyName?: string;
  reportData: any;
  sentAt: Date;
}

interface User {
  id: number;
  username: string;
  password: string;
}

interface InsertUser {
  username: string;
  password: string;
}

interface InsertAssessmentSession {
  sessionId: string;
  language?: string;
}

interface InsertEmailReport {
  sessionId: string;
  email: string;
  companyName?: string;
  reportData: any;
}

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

export class FileStorage implements IStorage {
  private dataDir: string;
  private sessionsFile: string;
  private reportsFile: string;
  private usersFile: string;

  constructor() {
    this.dataDir = join(process.cwd(), 'data');
    this.sessionsFile = join(this.dataDir, 'sessions.json');
    this.reportsFile = join(this.dataDir, 'reports.json');
    this.usersFile = join(this.dataDir, 'users.json');
    
    // Create data directory if it doesn't exist
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Initialize files if they don't exist
    if (!existsSync(this.sessionsFile)) {
      writeFileSync(this.sessionsFile, JSON.stringify([]));
    }
    if (!existsSync(this.reportsFile)) {
      writeFileSync(this.reportsFile, JSON.stringify([]));
    }
    if (!existsSync(this.usersFile)) {
      writeFileSync(this.usersFile, JSON.stringify([]));
    }
  }

  private readSessions(): AssessmentSession[] {
    try {
      const data = readFileSync(this.sessionsFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private writeSessions(sessions: AssessmentSession[]): void {
    writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2));
  }

  private readReports(): EmailReport[] {
    try {
      const data = readFileSync(this.reportsFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private writeReports(reports: EmailReport[]): void {
    writeFileSync(this.reportsFile, JSON.stringify(reports, null, 2));
  }

  private readUsers(): User[] {
    try {
      const data = readFileSync(this.usersFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private writeUsers(users: User[]): void {
    writeFileSync(this.usersFile, JSON.stringify(users, null, 2));
  }

  async getUser(id: number): Promise<User | undefined> {
    const users = this.readUsers();
    return users.find(user => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const users = this.readUsers();
    return users.find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const users = this.readUsers();
    const newUser: User = {
      id: users.length + 1,
      ...insertUser
    };
    users.push(newUser);
    this.writeUsers(users);
    return newUser;
  }

  async createAssessmentSession(insertSession: InsertAssessmentSession): Promise<AssessmentSession> {
    const sessions = this.readSessions();
    const newSession: AssessmentSession = {
      id: sessions.length + 1,
      sessionId: insertSession.sessionId,
      currentStep: 1,
      responses: {},
      consentDataProcessing: false,
      consentContactPermission: false,
      isCompleted: false,
      language: insertSession.language || 'de',
      createdAt: new Date()
    };
    sessions.push(newSession);
    this.writeSessions(sessions);
    return newSession;
  }

  async getAssessmentSession(sessionId: string): Promise<AssessmentSession | undefined> {
    const sessions = this.readSessions();
    return sessions.find(session => session.sessionId === sessionId);
  }

  async updateAssessmentSession(sessionId: string, updates: Partial<AssessmentSession>): Promise<AssessmentSession | undefined> {
    const sessions = this.readSessions();
    const index = sessions.findIndex(session => session.sessionId === sessionId);
    
    if (index === -1) return undefined;
    
    const updateData = { ...updates };
    if (updates.isCompleted) {
      updateData.completedAt = new Date();
    }
    
    sessions[index] = { ...sessions[index], ...updateData };
    this.writeSessions(sessions);
    return sessions[index];
  }

  async createEmailReport(insertReport: InsertEmailReport): Promise<EmailReport> {
    const reports = this.readReports();
    const newReport: EmailReport = {
      id: reports.length + 1,
      ...insertReport,
      sentAt: new Date()
    };
    reports.push(newReport);
    this.writeReports(reports);
    return newReport;
  }

  async getEmailReportsBySession(sessionId: string): Promise<EmailReport[]> {
    const reports = this.readReports();
    return reports.filter(report => report.sessionId === sessionId);
  }

  async getAllAssessmentSessions(): Promise<AssessmentSession[]> {
    return this.readSessions();
  }

  async getAllEmailReports(): Promise<EmailReport[]> {
    return this.readReports();
  }
}

export const storage = new FileStorage();
