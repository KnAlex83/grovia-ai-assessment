<?php
/**
 * Data Export Script for AI Assessment
 * 
 * This script exports assessment data in formats suitable for:
 * - HubSpot CRM
 * - System.io
 * - Mailchimp
 * - CSV files
 */

// Configuration - Update these with your database details
$host = 'your_db_host';
$dbname = 'your_db_name';
$username = 'your_db_username';
$password = 'your_db_password';

// Get export format from URL parameter
$format = $_GET['format'] ?? 'csv';
$type = $_GET['type'] ?? 'contacts';

try {
    $pdo = new PDO("pgsql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    switch ($type) {
        case 'contacts':
            exportContacts($pdo, $format);
            break;
        case 'assessments':
            exportAssessments($pdo, $format);
            break;
        case 'hubspot':
            exportForHubSpot($pdo);
            break;
        case 'mailchimp':
            exportForMailchimp($pdo);
            break;
        default:
            exportContacts($pdo, $format);
    }
    
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

function exportContacts($pdo, $format) {
    $sql = "
        SELECT 
            contact_name,
            email,
            company_name,
            employee_number,
            consent_data_processing,
            consent_contact_permission,
            language,
            readiness_score,
            created_at,
            completed_at
        FROM assessment_sessions 
        WHERE is_completed = true 
        ORDER BY created_at DESC
    ";
    
    $stmt = $pdo->query($sql);
    $contacts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if ($format === 'json') {
        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="contacts.json"');
        echo json_encode($contacts, JSON_PRETTY_PRINT);
    } else {
        exportCSV($contacts, 'contacts.csv');
    }
}

function exportAssessments($pdo, $format) {
    $sql = "
        SELECT 
            session_id,
            contact_name,
            email,
            company_name,
            employee_number,
            readiness_score,
            responses,
            created_at,
            completed_at
        FROM assessment_sessions 
        WHERE is_completed = true 
        ORDER BY created_at DESC
    ";
    
    $stmt = $pdo->query($sql);
    $assessments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Flatten responses for CSV export
    $flattened = [];
    foreach ($assessments as $assessment) {
        $responses = json_decode($assessment['responses'], true);
        $row = [
            'session_id' => $assessment['session_id'],
            'contact_name' => $assessment['contact_name'],
            'email' => $assessment['email'],
            'company_name' => $assessment['company_name'],
            'employee_number' => $assessment['employee_number'],
            'readiness_score' => $assessment['readiness_score'],
            'created_at' => $assessment['created_at'],
            'completed_at' => $assessment['completed_at']
        ];
        
        // Add question responses
        for ($i = 1; $i <= 10; $i++) {
            $row["question_{$i}_answer"] = $responses[$i]['answer'] ?? '';
            $row["question_{$i}_score"] = $responses[$i]['score'] ?? '';
        }
        
        $flattened[] = $row;
    }
    
    if ($format === 'json') {
        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="assessments.json"');
        echo json_encode($flattened, JSON_PRETTY_PRINT);
    } else {
        exportCSV($flattened, 'assessments.csv');
    }
}

function exportForHubSpot($pdo) {
    $sql = "
        SELECT 
            contact_name as 'First Name',
            email as 'Email',
            company_name as 'Company Name',
            employee_number as 'Number of Employees',
            readiness_score as 'AI Readiness Score',
            CASE 
                WHEN language = 'de' THEN 'German'
                WHEN language = 'en' THEN 'English'
                ELSE language
            END as 'Language',
            CASE 
                WHEN consent_contact_permission = true THEN 'Yes'
                ELSE 'No'
            END as 'Marketing Consent',
            created_at as 'Assessment Date'
        FROM assessment_sessions 
        WHERE is_completed = true 
        ORDER BY created_at DESC
    ";
    
    $stmt = $pdo->query($sql);
    $contacts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    exportCSV($contacts, 'hubspot_import.csv');
}

function exportForMailchimp($pdo) {
    $sql = "
        SELECT 
            email as 'Email Address',
            contact_name as 'First Name',
            company_name as 'Company',
            CASE 
                WHEN consent_contact_permission = true THEN 'subscribed'
                ELSE 'unsubscribed'
            END as 'Status',
            readiness_score as 'AI_READINESS_SCORE',
            employee_number as 'COMPANY_SIZE',
            language as 'LANGUAGE'
        FROM assessment_sessions 
        WHERE is_completed = true 
        AND consent_contact_permission = true
        ORDER BY created_at DESC
    ";
    
    $stmt = $pdo->query($sql);
    $contacts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    exportCSV($contacts, 'mailchimp_import.csv');
}

function exportCSV($data, $filename) {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    
    $output = fopen('php://output', 'w');
    
    if (!empty($data)) {
        // Write headers
        fputcsv($output, array_keys($data[0]));
        
        // Write data
        foreach ($data as $row) {
            fputcsv($output, $row);
        }
    }
    
    fclose($output);
}

// Usage examples:
// 
// Export contacts as CSV:
// https://yourwebsite.com/ai-assessment/export-data.php?type=contacts&format=csv
//
// Export for HubSpot:
// https://yourwebsite.com/ai-assessment/export-data.php?type=hubspot
//
// Export for Mailchimp:
// https://yourwebsite.com/ai-assessment/export-data.php?type=mailchimp
//
// Export all assessment data:
// https://yourwebsite.com/ai-assessment/export-data.php?type=assessments&format=json
?>

<!DOCTYPE html>
<html>
<head>
    <title>AI Assessment Data Export</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .export-links { margin: 20px 0; }
        .export-links a { 
            display: inline-block; 
            margin: 10px; 
            padding: 10px 20px; 
            background: #007cba; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
        }
        .export-links a:hover { background: #005a87; }
    </style>
</head>
<body>
    <h1>AI Assessment Data Export</h1>
    
    <div class="export-links">
        <h3>Quick Export Options:</h3>
        <a href="?type=contacts&format=csv">Export Contacts (CSV)</a>
        <a href="?type=hubspot">Export for HubSpot</a>
        <a href="?type=mailchimp">Export for Mailchimp</a>
        <a href="?type=assessments&format=json">Full Assessment Data (JSON)</a>
    </div>
    
    <h3>What each export contains:</h3>
    <ul>
        <li><strong>Contacts CSV:</strong> Basic contact info with AI readiness scores</li>
        <li><strong>HubSpot:</strong> Formatted for direct import into HubSpot CRM</li>
        <li><strong>Mailchimp:</strong> Email list with marketing consent status</li>
        <li><strong>Full Assessment:</strong> Complete responses and scores for analysis</li>
    </ul>
</body>
</html>