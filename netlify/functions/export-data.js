const { Pool } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
  const { queryStringParameters } = event;
  const type = queryStringParameters?.type || 'contacts';
  const format = queryStringParameters?.format || 'csv';

  if (!process.env.DATABASE_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Database not configured' })
    };
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    let query, filename;
    
    switch (type) {
      case 'hubspot':
        query = `
          SELECT 
            contact_name as "First Name",
            email as "Email",
            company_name as "Company Name",
            employee_number as "Number of Employees",
            readiness_score as "AI Readiness Score",
            language as "Language",
            created_at as "Assessment Date"
          FROM assessment_sessions 
          WHERE is_completed = true 
          ORDER BY created_at DESC
        `;
        filename = 'hubspot_import.csv';
        break;
        
      case 'mailchimp':
        query = `
          SELECT 
            email as "Email Address",
            contact_name as "First Name",
            company_name as "Company",
            CASE WHEN consent_contact_permission = true THEN 'subscribed' ELSE 'unsubscribed' END as "Status"
          FROM assessment_sessions 
          WHERE is_completed = true 
          ORDER BY created_at DESC
        `;
        filename = 'mailchimp_import.csv';
        break;
        
      default:
        query = `
          SELECT 
            contact_name,
            email,
            company_name,
            employee_number,
            readiness_score,
            created_at
          FROM assessment_sessions 
          WHERE is_completed = true 
          ORDER BY created_at DESC
        `;
        filename = 'contacts.csv';
    }

    const result = await pool.query(query);
    
    if (format === 'json') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename.replace('.csv', '.json')}"`
        },
        body: JSON.stringify(result.rows, null, 2)
      };
    }

    if (result.rows.length === 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        },
        body: 'No data available'
      };
    }

    const headers = Object.keys(result.rows[0]);
    const csvContent = [
      headers.join(','),
      ...result.rows.map(row => 
        headers.map(header => 
          `"${(row[header] || '').toString().replace(/"/g, '""')}"`
        ).join(',')
      )
    ].join('\n');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      },
      body: csvContent
    };

  } catch (error) {
    console.error('Export error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Export failed' })
    };
  } finally {
    await pool.end();
  }
};
