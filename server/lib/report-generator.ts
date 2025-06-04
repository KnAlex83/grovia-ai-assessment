import { type AssessmentSession } from "@shared/schema";

export function generateAssessmentReport(session: AssessmentSession, companyName?: string) {
  const { responses, readinessScore, language } = session;
  const isGerman = language === 'de';

  const strengths = generateStrengths(responses, isGerman);
  const improvements = generateImprovements(responses, isGerman);
  const recommendations = generateRecommendations(responses, readinessScore || 0, isGerman);

  return {
    score: readinessScore || 0,
    companyName,
    strengths,
    improvements,
    recommendations,
    responses,
    language,
  };
}

function generateStrengths(responses: Record<string, any>, isGerman: boolean): string[] {
  const strengths: string[] = [];

  // Check for clear AI goals
  if (['efficiency', 'customer-experience', 'revenue'].includes(responses['1'])) {
    strengths.push(isGerman 
      ? 'Klare Zieldefinition für KI-Einsatz'
      : 'Clear AI implementation goals');
  }

  // Check for existing AI experience
  if (responses['2'] === 'yes') {
    strengths.push(isGerman
      ? 'Bereits vorhandene KI-Erfahrung'
      : 'Existing AI experience');
  }

  // Check for cloud infrastructure
  if (responses['3'] === 'cloud') {
    strengths.push(isGerman
      ? 'Moderne, cloud-basierte IT-Infrastruktur'
      : 'Modern, cloud-based IT infrastructure');
  }

  // Check for structured data
  if (responses['4'] === 'structured') {
    strengths.push(isGerman
      ? 'Strukturierte und analysebereite Daten'
      : 'Structured and analysis-ready data');
  }

  // Check for compliance awareness
  if (responses['5'] === 'yes') {
    strengths.push(isGerman
      ? 'Bewusstsein für Datenschutz und Compliance'
      : 'Data protection and compliance awareness');
  }

  // Check for management support
  if (responses['8'] === 'yes') {
    strengths.push(isGerman
      ? 'Starke Unterstützung durch die Unternehmensführung'
      : 'Strong management support');
  }

  // Default strength if none found
  if (strengths.length === 0) {
    strengths.push(isGerman
      ? 'Bereitschaft zur digitalen Transformation'
      : 'Willingness for digital transformation');
  }

  return strengths;
}

function generateImprovements(responses: Record<string, any>, isGerman: boolean): string[] {
  const improvements: string[] = [];

  // Check for missing AI experience
  if (responses['2'] !== 'yes') {
    improvements.push(isGerman
      ? 'Aufbau von KI-Expertise und -Erfahrung'
      : 'Building AI expertise and experience');
  }

  // Check for infrastructure limitations
  if (responses['3'] === 'on-premises') {
    improvements.push(isGerman
      ? 'Modernisierung der IT-Infrastruktur'
      : 'IT infrastructure modernization');
  }

  // Check for data quality issues
  if (responses['4'] !== 'structured') {
    improvements.push(isGerman
      ? 'Verbesserung der Datenqualität und -struktur'
      : 'Improving data quality and structure');
  }

  // Check for team readiness
  if (responses['7'] !== 'experienced') {
    improvements.push(isGerman
      ? 'Schulung und Weiterbildung der Mitarbeiter'
      : 'Employee training and development');
  }

  // Check for missing management support
  if (responses['8'] !== 'yes') {
    improvements.push(isGerman
      ? 'Erhöhung der Management-Unterstützung'
      : 'Increasing management support');
  }

  return improvements;
}

function generateRecommendations(
  responses: Record<string, any>, 
  score: number, 
  isGerman: boolean
): string[] {
  const recommendations: string[] = [];

  if (score >= 80) {
    recommendations.push(isGerman
      ? 'Starten Sie mit einem Pilotprojekt in Ihrem Kerngeschäft'
      : 'Start with a pilot project in your core business');
    recommendations.push(isGerman
      ? 'Entwickeln Sie eine umfassende KI-Strategie'
      : 'Develop a comprehensive AI strategy');
  } else if (score >= 60) {
    recommendations.push(isGerman
      ? 'Investieren Sie in KI-Schulungen für Ihr Team'
      : 'Invest in AI training for your team');
    recommendations.push(isGerman
      ? 'Beginnen Sie mit einfachen Automatisierungsprojekten'
      : 'Start with simple automation projects');
    recommendations.push(isGerman
      ? 'Verbessern Sie Ihre Datensammlung und -analyse'
      : 'Improve your data collection and analysis');
  } else if (score >= 40) {
    recommendations.push(isGerman
      ? 'Schaffen Sie ein Bewusstsein für KI in der Organisation'
      : 'Create AI awareness in your organization');
    recommendations.push(isGerman
      ? 'Investieren Sie in eine moderne IT-Infrastruktur'
      : 'Invest in modern IT infrastructure');
    recommendations.push(isGerman
      ? 'Beginnen Sie mit der Digitalisierung Ihrer Prozesse'
      : 'Start digitizing your processes');
  } else {
    recommendations.push(isGerman
      ? 'Beginnen Sie mit grundlegender Digitalisierung'
      : 'Start with basic digitization');
    recommendations.push(isGerman
      ? 'Suchen Sie externe Beratung für KI-Readiness'
      : 'Seek external consultation for AI readiness');
    recommendations.push(isGerman
      ? 'Entwickeln Sie eine langfristige Digitalisierungsstrategie'
      : 'Develop a long-term digitization strategy');
  }

  return recommendations;
}
