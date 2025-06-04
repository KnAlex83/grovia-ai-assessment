# AI Readiness Assessment Tool

Professional AI readiness assessment for SMEs with lead generation capabilities.

## Features
- Conversational AI-powered assessment
- GDPR-compliant data collection
- CRM integration (HubSpot, Mailchimp, System.io)
- Multilingual support (German/English)
- Professional Grovia Digital branding

## Deploy to Netlify
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/YOURUSERNAME/YOURREPO)

## Quick Setup
1. Fork this repository
2. Connect to Netlify or Vercel
3. Add environment variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `OPENROUTER_API_KEY`: Your OpenRouter API key
4. Deploy and configure custom domain

## Environment Variables
```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
OPENROUTER_API_KEY=sk-or-your-key-here
NODE_ENV=production
```

## Database Setup
Run the SQL script in `database-setup.sql` on your PostgreSQL database.

## Data Export
Access customer data at:
- `/export-data.php?type=hubspot` - HubSpot import format
- `/export-data.php?type=mailchimp` - Mailchimp subscriber list
- `/export-data.php?type=contacts&format=csv` - CSV export

## Custom Domain Setup
Add CNAME record: `assessment.yourwebsite.com` → `yourapp.netlify.app`

Built for professional lead generation and AI consulting services.
