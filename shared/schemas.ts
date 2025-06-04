import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const assessmentSessions = pgTable("assessment_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  email: text("email"),
  contactName: text("contact_name"),
  companyName: text("company_name"),
  employeeNumber: text("employee_number"),
  currentStep: integer("current_step").notNull().default(1),
  responses: jsonb("responses").notNull().default({}),
  consentDataProcessing: boolean("consent_data_processing").notNull().default(false),
  consentContactPermission: boolean("consent_contact_permission").notNull().default(false),
  readinessScore: integer("readiness_score"),
  isCompleted: boolean("is_completed").notNull().default(false),
  language: text("language").notNull().default("de"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const emailReports = pgTable("email_reports", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  email: text("email").notNull(),
  companyName: text("company_name"),
  reportData: jsonb("report_data").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertAssessmentSessionSchema = createInsertSchema(assessmentSessions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertEmailReportSchema = createInsertSchema(emailReports).omit({
  id: true,
  sentAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertAssessmentSession = z.infer<typeof insertAssessmentSessionSchema>;
export type AssessmentSession = typeof assessmentSessions.$inferSelect;

export type InsertEmailReport = z.infer<typeof insertEmailReportSchema>;
export type EmailReport = typeof emailReports.$inferSelect;
