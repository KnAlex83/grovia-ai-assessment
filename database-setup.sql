-- AI Assessment Database Setup
-- Run this SQL script in your PostgreSQL database

-- Create users table (for future authentication if needed)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

-- Create assessment sessions table
CREATE TABLE IF NOT EXISTS assessment_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255),
    contact_name VARCHAR(255),
    company_name VARCHAR(255),
    employee_number VARCHAR(100),
    current_step INTEGER NOT NULL DEFAULT 1,
    responses JSONB NOT NULL DEFAULT '{}',
    consent_data_processing BOOLEAN NOT NULL DEFAULT false,
    consent_contact_permission BOOLEAN NOT NULL DEFAULT false,
    readiness_score INTEGER,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    language VARCHAR(10) NOT NULL DEFAULT 'de',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create email reports table
CREATE TABLE IF NOT EXISTS email_reports (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    report_data JSONB NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_session_id ON assessment_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_email ON assessment_sessions(email);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_completed ON assessment_sessions(is_completed);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_created_at ON assessment_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_email_reports_session_id ON email_reports(session_id);

-- Insert sample data (optional - remove if you don't want test data)
-- INSERT INTO assessment_sessions (
--     session_id, 
--     email, 
--     contact_name, 
--     company_name, 
--     employee_number,
--     consent_data_processing,
--     consent_contact_permission,
--     readiness_score,
--     is_completed,
--     language,
--     responses
-- ) VALUES (
--     'test-session-123',
--     'test@example.com',
--     'Test User',
--     'Test Company GmbH',
--     '50',
--     true,
--     true,
--     75,
--     true,
--     'de',
--     '{"1": {"question": "Test question", "answer": "Test answer", "score": 4}}'
-- );

-- Grant necessary permissions (adjust username as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_username;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_username;