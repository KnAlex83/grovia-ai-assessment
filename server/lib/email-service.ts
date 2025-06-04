import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
  },
});

export async function sendAssessmentReport(
  email: string,
  reportData: any,
  language: string = 'de'
) {
  const isGerman = language === 'de';
  
  const subject = isGerman 
    ? 'Ihr AI Readiness Assessment Report'
    : 'Your AI Readiness Assessment Report';

  const htmlContent = generateEmailTemplate(reportData, isGerman);

  const mailOptions = {
    from: process.env.FROM_EMAIL || 'noreply@ai-assessment.com',
    to: email,
    subject,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email report');
  }
}

function generateEmailTemplate(reportData: any, isGerman: boolean): string {
  const { score, strengths, improvements, recommendations, companyName } = reportData;
  
  const greeting = isGerman 
    ? `Vielen Dank für Ihre Teilnahme am AI Readiness Assessment${companyName ? ` für ${companyName}` : ''}!`
    : `Thank you for participating in the AI Readiness Assessment${companyName ? ` for ${companyName}` : ''}!`;

  const scoreText = isGerman
    ? `Ihr AI Readiness Score beträgt ${score}%`
    : `Your AI Readiness Score is ${score}%`;

  const strengthsTitle = isGerman ? 'Ihre Stärken:' : 'Your Strengths:';
  const improvementsTitle = isGerman ? 'Verbesserungsbereiche:' : 'Areas for Improvement:';
  const recommendationsTitle = isGerman ? 'Empfehlungen:' : 'Recommendations:';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI Readiness Report</title>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #1E293B; margin: 0; padding: 20px; background-color: #F8FAFC; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #2563EB, #3B82F6); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .score-circle { background: #EFF6FF; border-radius: 50%; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; margin: 20px auto; border: 4px solid #2563EB; }
        .score-text { font-size: 32px; font-weight: bold; color: #2563EB; }
        .section { margin: 25px 0; }
        .section h3 { color: #2563EB; border-bottom: 2px solid #E5E7EB; padding-bottom: 8px; }
        .list-item { padding: 8px 0; border-left: 3px solid #10B981; padding-left: 15px; margin: 10px 0; background: #F0FDF4; }
        .improvement-item { border-left-color: #F59E0B; background: #FFFBEB; }
        .footer { background: #F1F5F9; padding: 20px; text-align: center; font-size: 14px; color: #64748B; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>AI Readiness Assessment Report</h1>
          <p>${greeting}</p>
        </div>
        
        <div class="content">
          <div class="score-circle">
            <span class="score-text">${score}%</span>
          </div>
          <p style="text-align: center; font-size: 18px; font-weight: 600;">${scoreText}</p>
          
          <div class="section">
            <h3>${strengthsTitle}</h3>
            ${strengths.map((strength: string) => `<div class="list-item">${strength}</div>`).join('')}
          </div>
          
          <div class="section">
            <h3>${improvementsTitle}</h3>
            ${improvements.map((improvement: string) => `<div class="list-item improvement-item">${improvement}</div>`).join('')}
          </div>
          
          <div class="section">
            <h3>${recommendationsTitle}</h3>
            ${recommendations.map((rec: string) => `<div class="list-item">${rec}</div>`).join('')}
          </div>
        </div>
        
        <div class="footer">
          <p>${isGerman ? 'Haben Sie Fragen? Kontaktieren Sie uns gerne!' : 'Have questions? Feel free to contact us!'}</p>
          <p>© 2024 AI Readiness Assessment</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
