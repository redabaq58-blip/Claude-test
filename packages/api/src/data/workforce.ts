// ─── Workforce Intelligence Data ─────────────────────────────────────────────
// Real-world occupational data enriched with AI automation research.
// Automation scores derived from Oxford Martin School, McKinsey Global Institute,
// and World Economic Forum studies on AI and the future of work.
// Skills taxonomy aligned with O*NET / ESCO frameworks.

export type AutomationTier = 'at-risk' | 'transforming' | 'augmented' | 'resilient'
export type GrowthOutlook = 'declining' | 'stable' | 'growing' | 'high-growth'
export type SalaryTier = 'entry' | 'mid' | 'senior' | 'executive'

export interface WorkforceSkill {
  name: string
  category: 'technical' | 'cognitive' | 'social' | 'creative' | 'physical'
  aiReplaceable: boolean   // can AI fully substitute this skill?
  aiAugmented: boolean     // can AI meaningfully enhance this skill?
}

export interface AutomationTask {
  description: string
  aiHandles: boolean        // AI can execute autonomously
  aiAssists: boolean        // AI assists human decision
  humanRequired: boolean    // irreducibly human
}

export interface WorkforceOccupation {
  id: string
  title: string
  industry: string
  description: string
  icon: string
  // ── Automation Intelligence ────────────────────────────────────────────────
  automationRisk: number          // 0-100: probability of full automation
  aiAugmentation: number          // 0-100: AI enhancement potential
  automationTier: AutomationTier
  timelineYears: string           // estimated years to significant impact
  // ── Skills ─────────────────────────────────────────────────────────────────
  coreSkills: WorkforceSkill[]
  // ── Task breakdown ─────────────────────────────────────────────────────────
  tasks: AutomationTask[]
  // ── Recommended ClaudeForge agents ─────────────────────────────────────────
  recommendedAgents: string[]     // template IDs from AGENT_TEMPLATES
  recommendedSkills: string[]     // skill IDs
  // ── Market data ────────────────────────────────────────────────────────────
  growthOutlook: GrowthOutlook
  salaryTierUS: SalaryTier
  estimatedUSJobs: number         // approximate current US employment
  // ── Domain knowledge areas ──────────────────────────────────────────────────
  knowledgeDomains: string[]
}

export const WORKFORCE_OCCUPATIONS: WorkforceOccupation[] = [
  // ─── Technology ─────────────────────────────────────────────────────────────
  {
    id: 'software-engineer',
    title: 'Software Engineer',
    industry: 'Technology',
    description: 'Designs, builds, and maintains software systems, APIs, and infrastructure.',
    icon: '💻',
    automationRisk: 28,
    aiAugmentation: 82,
    automationTier: 'augmented',
    timelineYears: '5–10',
    coreSkills: [
      { name: 'System design', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Code writing', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Debugging', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Code review', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Stakeholder communication', category: 'social', aiReplaceable: false, aiAugmented: false },
      { name: 'Architecture decisions', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
    ],
    tasks: [
      { description: 'Write boilerplate and CRUD code', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Generate unit tests', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Document APIs and code', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Debug complex race conditions', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Architect distributed systems', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Lead technical interviews', aiHandles: false, aiAssists: false, humanRequired: true },
      { description: 'Evaluate build-vs-buy trade-offs', aiHandles: false, aiAssists: true, humanRequired: false },
    ],
    recommendedAgents: ['code-reviewer', 'research-assistant', 'api-designer'],
    recommendedSkills: ['code-reviewer', 'document-analyst'],
    growthOutlook: 'growing',
    salaryTierUS: 'senior',
    estimatedUSJobs: 1_840_000,
    knowledgeDomains: ['algorithms', 'distributed systems', 'cloud infrastructure', 'security', 'DevOps'],
  },

  {
    id: 'data-scientist',
    title: 'Data Scientist',
    industry: 'Technology / Analytics',
    description: 'Extracts insights from large datasets using statistical modelling, ML, and data visualisation.',
    icon: '📊',
    automationRisk: 22,
    aiAugmentation: 88,
    automationTier: 'augmented',
    timelineYears: '3–8',
    coreSkills: [
      { name: 'Statistical modelling', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Python / R programming', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Data cleaning / ETL', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Hypothesis framing', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Storytelling with data', category: 'creative', aiReplaceable: false, aiAugmented: true },
      { name: 'Domain expertise application', category: 'cognitive', aiReplaceable: false, aiAugmented: false },
    ],
    tasks: [
      { description: 'Write data pipeline code', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Generate EDA visualisations', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Select appropriate ML algorithm', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Interpret model results in business context', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Define experiment hypotheses', aiHandles: false, aiAssists: false, humanRequired: true },
      { description: 'Communicate findings to executives', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['data-analyst', 'research-assistant'],
    recommendedSkills: ['research-assistant', 'document-analyst'],
    growthOutlook: 'high-growth',
    salaryTierUS: 'senior',
    estimatedUSJobs: 168_000,
    knowledgeDomains: ['machine learning', 'statistics', 'data engineering', 'business intelligence', 'experimentation'],
  },

  {
    id: 'cybersecurity-analyst',
    title: 'Cybersecurity Analyst',
    industry: 'Technology / Security',
    description: 'Protects systems by monitoring threats, investigating incidents, and hardening infrastructure.',
    icon: '🛡️',
    automationRisk: 18,
    aiAugmentation: 74,
    automationTier: 'augmented',
    timelineYears: '5–12',
    coreSkills: [
      { name: 'Threat intelligence', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Incident response', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Log analysis', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Vulnerability assessment', category: 'technical', aiReplaceable: false, aiAugmented: true },
      { name: 'Adversarial thinking', category: 'cognitive', aiReplaceable: false, aiAugmented: false },
      { name: 'Forensic investigation', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
    ],
    tasks: [
      { description: 'Scan for known CVEs', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Correlate SIEM alerts', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Investigate novel attack vectors', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Conduct red-team exercises', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Decide incident escalation', aiHandles: false, aiAssists: false, humanRequired: true },
      { description: 'Brief executive leadership post-breach', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['code-reviewer', 'research-assistant'],
    recommendedSkills: ['code-reviewer', 'research-assistant'],
    growthOutlook: 'high-growth',
    salaryTierUS: 'senior',
    estimatedUSJobs: 172_000,
    knowledgeDomains: ['network security', 'cryptography', 'compliance (SOC 2, ISO 27001)', 'cloud security', 'malware analysis'],
  },

  // ─── Finance ─────────────────────────────────────────────────────────────────
  {
    id: 'financial-analyst',
    title: 'Financial Analyst',
    industry: 'Finance',
    description: 'Analyses financial data, builds models, and produces investment recommendations.',
    icon: '📈',
    automationRisk: 48,
    aiAugmentation: 76,
    automationTier: 'transforming',
    timelineYears: '3–7',
    coreSkills: [
      { name: 'Financial modelling (DCF, LBO)', category: 'technical', aiReplaceable: false, aiAugmented: true },
      { name: 'Excel / data analysis', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Earnings report analysis', category: 'cognitive', aiReplaceable: true, aiAugmented: true },
      { name: 'Valuation judgement', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Client relationship management', category: 'social', aiReplaceable: false, aiAugmented: false },
      { name: 'Regulatory knowledge (SEC, IFRS)', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
    ],
    tasks: [
      { description: 'Scrape and normalise financial statements', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Build variance analysis reports', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Write earnings commentary', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Model M&A deal scenarios', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Assess management quality', aiHandles: false, aiAssists: false, humanRequired: true },
      { description: 'Pitch investment thesis to fund committee', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['data-analyst', 'research-assistant', 'sql-expert'],
    recommendedSkills: ['research-assistant', 'document-analyst'],
    growthOutlook: 'stable',
    salaryTierUS: 'mid',
    estimatedUSJobs: 331_000,
    knowledgeDomains: ['DCF / LBO modelling', 'accounting (GAAP / IFRS)', 'capital markets', 'risk management', 'regulatory compliance'],
  },

  {
    id: 'accountant',
    title: 'Accountant / CPA',
    industry: 'Finance / Professional Services',
    description: 'Records, reconciles, and reports financial transactions in compliance with accounting standards.',
    icon: '🧾',
    automationRisk: 65,
    aiAugmentation: 80,
    automationTier: 'at-risk',
    timelineYears: '2–5',
    coreSkills: [
      { name: 'Bookkeeping and reconciliation', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Tax preparation', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Audit procedures', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'GAAP / IFRS compliance', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Advisory judgement', category: 'cognitive', aiReplaceable: false, aiAugmented: false },
    ],
    tasks: [
      { description: 'Data entry and transaction categorisation', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Bank reconciliation', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Tax return preparation', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Audit sampling and testing', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Complex tax planning strategy', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Sign off on financial statements', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['data-analyst', 'sql-expert'],
    recommendedSkills: ['document-analyst'],
    growthOutlook: 'declining',
    salaryTierUS: 'mid',
    estimatedUSJobs: 1_440_000,
    knowledgeDomains: ['GAAP / IFRS', 'tax law', 'audit standards', 'ERP systems', 'financial reporting'],
  },

  // ─── Legal ───────────────────────────────────────────────────────────────────
  {
    id: 'lawyer',
    title: 'Lawyer / Attorney',
    industry: 'Legal',
    description: 'Advises clients on legal matters, drafts documents, and represents in proceedings.',
    icon: '⚖️',
    automationRisk: 32,
    aiAugmentation: 68,
    automationTier: 'augmented',
    timelineYears: '5–10',
    coreSkills: [
      { name: 'Legal research', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Contract drafting', category: 'technical', aiReplaceable: false, aiAugmented: true },
      { name: 'Litigation strategy', category: 'cognitive', aiReplaceable: false, aiAugmented: false },
      { name: 'Client counselling', category: 'social', aiReplaceable: false, aiAugmented: false },
      { name: 'Oral argumentation', category: 'social', aiReplaceable: false, aiAugmented: false },
      { name: 'Regulatory interpretation', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
    ],
    tasks: [
      { description: 'Search case law and statutes', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Draft standard contracts and NDAs', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Summarise discovery documents', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Develop litigation strategy', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Cross-examine witnesses', aiHandles: false, aiAssists: false, humanRequired: true },
      { description: 'Negotiate complex deals', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['research-assistant', 'document-analyst-agent'],
    recommendedSkills: ['research-assistant', 'document-analyst'],
    growthOutlook: 'stable',
    salaryTierUS: 'senior',
    estimatedUSJobs: 813_000,
    knowledgeDomains: ['contract law', 'litigation', 'regulatory compliance', 'M&A', 'IP law'],
  },

  {
    id: 'paralegal',
    title: 'Paralegal',
    industry: 'Legal',
    description: 'Supports attorneys with research, document preparation, and case management.',
    icon: '📋',
    automationRisk: 62,
    aiAugmentation: 85,
    automationTier: 'at-risk',
    timelineYears: '2–5',
    coreSkills: [
      { name: 'Legal document drafting', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Case file management', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Legal research', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Court filing procedures', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Client communication', category: 'social', aiReplaceable: false, aiAugmented: false },
    ],
    tasks: [
      { description: 'Draft routine legal correspondence', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Review and summarise contracts', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Organise discovery materials', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Assist in depositions', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Witness coordination', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['research-assistant', 'meeting-summariser'],
    recommendedSkills: ['document-analyst', 'research-assistant'],
    growthOutlook: 'declining',
    salaryTierUS: 'mid',
    estimatedUSJobs: 348_000,
    knowledgeDomains: ['legal research', 'document management', 'court procedures', 'contract review'],
  },

  // ─── Healthcare ──────────────────────────────────────────────────────────────
  {
    id: 'physician',
    title: 'Physician / Doctor',
    industry: 'Healthcare',
    description: 'Diagnoses and treats patients using clinical knowledge, examination, and judgment.',
    icon: '🩺',
    automationRisk: 12,
    aiAugmentation: 55,
    automationTier: 'augmented',
    timelineYears: '8–15',
    coreSkills: [
      { name: 'Clinical diagnosis', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Patient examination', category: 'physical', aiReplaceable: false, aiAugmented: false },
      { name: 'Treatment planning', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Patient communication / empathy', category: 'social', aiReplaceable: false, aiAugmented: false },
      { name: 'Medical documentation', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Procedural skills', category: 'physical', aiReplaceable: false, aiAugmented: false },
    ],
    tasks: [
      { description: 'Write clinical notes (SOAP)', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Check drug interactions', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Interpret lab / imaging results', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Differential diagnosis formulation', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Physical examination', aiHandles: false, aiAssists: false, humanRequired: true },
      { description: 'Informed consent discussion', aiHandles: false, aiAssists: false, humanRequired: true },
      { description: 'Surgical procedures', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['research-assistant'],
    recommendedSkills: ['research-assistant', 'document-analyst'],
    growthOutlook: 'high-growth',
    salaryTierUS: 'executive',
    estimatedUSJobs: 756_000,
    knowledgeDomains: ['clinical medicine', 'pharmacology', 'medical coding (ICD-10)', 'EHR systems', 'evidence-based medicine'],
  },

  {
    id: 'radiologist',
    title: 'Radiologist',
    industry: 'Healthcare',
    description: 'Interprets medical imaging (X-ray, CT, MRI) to diagnose disease.',
    icon: '🔬',
    automationRisk: 42,
    aiAugmentation: 78,
    automationTier: 'transforming',
    timelineYears: '3–7',
    coreSkills: [
      { name: 'Image interpretation', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Radiology reporting', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Clinical correlation', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Interventional procedures', category: 'physical', aiReplaceable: false, aiAugmented: false },
    ],
    tasks: [
      { description: 'Generate structured radiology reports', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Flag abnormalities in routine scans', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Interpret complex multi-modal imaging', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Perform interventional radiology', aiHandles: false, aiAssists: false, humanRequired: true },
      { description: 'Consult with clinical team', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['research-assistant', 'document-analyst-agent'],
    recommendedSkills: ['document-analyst'],
    growthOutlook: 'stable',
    salaryTierUS: 'executive',
    estimatedUSJobs: 39_000,
    knowledgeDomains: ['radiology', 'anatomy', 'oncology', 'AI-assisted diagnosis', 'interventional techniques'],
  },

  {
    id: 'nurse',
    title: 'Registered Nurse',
    industry: 'Healthcare',
    description: 'Provides direct patient care, administers medications, and coordinates treatment plans.',
    icon: '💊',
    automationRisk: 14,
    aiAugmentation: 48,
    automationTier: 'resilient',
    timelineYears: '10–20',
    coreSkills: [
      { name: 'Patient assessment', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Medication administration', category: 'physical', aiReplaceable: false, aiAugmented: false },
      { name: 'Patient advocacy / empathy', category: 'social', aiReplaceable: false, aiAugmented: false },
      { name: 'Clinical documentation', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Emergency response', category: 'cognitive', aiReplaceable: false, aiAugmented: false },
    ],
    tasks: [
      { description: 'Document care notes in EHR', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Triage patient complaints', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Administer injections / IVs', aiHandles: false, aiAssists: false, humanRequired: true },
      { description: 'Emotional support for patients', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['research-assistant', 'meeting-summariser'],
    recommendedSkills: ['document-analyst'],
    growthOutlook: 'high-growth',
    salaryTierUS: 'mid',
    estimatedUSJobs: 3_190_000,
    knowledgeDomains: ['clinical nursing', 'pharmacology', 'patient safety', 'EHR', 'care coordination'],
  },

  // ─── Marketing ───────────────────────────────────────────────────────────────
  {
    id: 'marketing-manager',
    title: 'Marketing Manager',
    industry: 'Marketing / Advertising',
    description: 'Develops and executes marketing strategies to drive brand awareness and revenue growth.',
    icon: '📣',
    automationRisk: 38,
    aiAugmentation: 82,
    automationTier: 'transforming',
    timelineYears: '2–5',
    coreSkills: [
      { name: 'Campaign strategy', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Copywriting', category: 'creative', aiReplaceable: false, aiAugmented: true },
      { name: 'Analytics and attribution', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Brand positioning', category: 'creative', aiReplaceable: false, aiAugmented: false },
      { name: 'Team leadership', category: 'social', aiReplaceable: false, aiAugmented: false },
      { name: 'Agency / vendor management', category: 'social', aiReplaceable: false, aiAugmented: false },
    ],
    tasks: [
      { description: 'Write social media copy', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Generate A/B test variants', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Analyse campaign performance', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Develop brand voice guidelines', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Negotiate media buys', aiHandles: false, aiAssists: false, humanRequired: true },
      { description: 'Build agency relationships', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['writing-coach', 'research-assistant', 'data-analyst'],
    recommendedSkills: ['research-assistant', 'document-analyst'],
    growthOutlook: 'stable',
    salaryTierUS: 'senior',
    estimatedUSJobs: 323_000,
    knowledgeDomains: ['digital marketing', 'SEO/SEM', 'brand strategy', 'growth hacking', 'marketing analytics'],
  },

  {
    id: 'content-writer',
    title: 'Content Writer',
    industry: 'Media / Marketing',
    description: 'Produces written content — articles, blogs, scripts, copy — for brands and publishers.',
    icon: '✍️',
    automationRisk: 55,
    aiAugmentation: 92,
    automationTier: 'at-risk',
    timelineYears: '1–3',
    coreSkills: [
      { name: 'Longform writing', category: 'creative', aiReplaceable: false, aiAugmented: true },
      { name: 'SEO optimisation', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Research', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Editing and proofreading', category: 'cognitive', aiReplaceable: true, aiAugmented: true },
      { name: 'Brand voice adherence', category: 'creative', aiReplaceable: false, aiAugmented: true },
    ],
    tasks: [
      { description: 'Draft SEO blog articles', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Generate social media posts', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Proofread and format copy', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Develop unique brand voice', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Conduct expert interviews', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['writing-coach', 'research-assistant'],
    recommendedSkills: ['research-assistant', 'document-analyst'],
    growthOutlook: 'declining',
    salaryTierUS: 'entry',
    estimatedUSJobs: 175_000,
    knowledgeDomains: ['journalism', 'SEO', 'brand communications', 'UX writing', 'technical writing'],
  },

  // ─── Human Resources ─────────────────────────────────────────────────────────
  {
    id: 'hr-manager',
    title: 'HR Manager',
    industry: 'Human Resources',
    description: 'Manages the employee lifecycle — hiring, performance, compensation, and compliance.',
    icon: '👥',
    automationRisk: 44,
    aiAugmentation: 72,
    automationTier: 'transforming',
    timelineYears: '3–6',
    coreSkills: [
      { name: 'Talent acquisition', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Employee relations', category: 'social', aiReplaceable: false, aiAugmented: false },
      { name: 'Compensation benchmarking', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'HR compliance / employment law', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Performance management', category: 'social', aiReplaceable: false, aiAugmented: true },
    ],
    tasks: [
      { description: 'Screen resumes against job descriptions', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Draft job descriptions', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Generate offer letters', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Analyse workforce turnover data', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Mediate employee conflicts', aiHandles: false, aiAssists: false, humanRequired: true },
      { description: 'Design culture initiatives', aiHandles: false, aiAssists: true, humanRequired: false },
    ],
    recommendedAgents: ['career-coach', 'research-assistant', 'data-analyst'],
    recommendedSkills: ['document-analyst', 'research-assistant'],
    growthOutlook: 'stable',
    salaryTierUS: 'senior',
    estimatedUSJobs: 168_000,
    knowledgeDomains: ['employment law', 'talent management', 'organisational design', 'DEI', 'compensation and benefits'],
  },

  {
    id: 'recruiter',
    title: 'Recruiter / Talent Acquisition',
    industry: 'Human Resources',
    description: 'Sources, evaluates, and hires talent across roles and functions.',
    icon: '🎯',
    automationRisk: 52,
    aiAugmentation: 78,
    automationTier: 'at-risk',
    timelineYears: '2–4',
    coreSkills: [
      { name: 'Candidate sourcing', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Resume screening', category: 'cognitive', aiReplaceable: true, aiAugmented: true },
      { name: 'Interviewing', category: 'social', aiReplaceable: false, aiAugmented: true },
      { name: 'Offer negotiation', category: 'social', aiReplaceable: false, aiAugmented: false },
      { name: 'Employer branding', category: 'creative', aiReplaceable: false, aiAugmented: true },
    ],
    tasks: [
      { description: 'Source candidates on LinkedIn', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Screen resumes', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Send outreach messages', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Conduct structured interviews', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Negotiate compensation packages', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['career-coach', 'research-assistant'],
    recommendedSkills: ['document-analyst', 'research-assistant'],
    growthOutlook: 'declining',
    salaryTierUS: 'mid',
    estimatedUSJobs: 217_000,
    knowledgeDomains: ['talent acquisition', 'employer branding', 'ATS systems', 'behavioural interviewing', 'compensation benchmarking'],
  },

  // ─── Education ───────────────────────────────────────────────────────────────
  {
    id: 'teacher',
    title: 'Teacher / Educator',
    industry: 'Education',
    description: 'Designs and delivers instruction to help students develop knowledge and skills.',
    icon: '🎓',
    automationRisk: 18,
    aiAugmentation: 58,
    automationTier: 'augmented',
    timelineYears: '8–15',
    coreSkills: [
      { name: 'Curriculum design', category: 'creative', aiReplaceable: false, aiAugmented: true },
      { name: 'Classroom management', category: 'social', aiReplaceable: false, aiAugmented: false },
      { name: 'Assessment grading', category: 'cognitive', aiReplaceable: true, aiAugmented: true },
      { name: 'Student mentorship', category: 'social', aiReplaceable: false, aiAugmented: false },
      { name: 'Adaptive instruction', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
    ],
    tasks: [
      { description: 'Generate lesson plans', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Create quiz / test questions', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Grade objective assessments', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Provide personalised feedback on essays', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Build student trust and rapport', aiHandles: false, aiAssists: false, humanRequired: true },
      { description: 'Handle classroom conflict', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['research-assistant', 'writing-coach', 'eli5'],
    recommendedSkills: ['research-assistant', 'document-analyst'],
    growthOutlook: 'stable',
    salaryTierUS: 'mid',
    estimatedUSJobs: 3_380_000,
    knowledgeDomains: ['pedagogy', 'curriculum design', 'differentiated instruction', 'ed-tech', 'assessment'],
  },

  // ─── Operations / Supply Chain ────────────────────────────────────────────────
  {
    id: 'supply-chain-manager',
    title: 'Supply Chain Manager',
    industry: 'Operations / Logistics',
    description: 'Orchestrates procurement, inventory, logistics, and supplier relationships.',
    icon: '🚚',
    automationRisk: 40,
    aiAugmentation: 78,
    automationTier: 'transforming',
    timelineYears: '3–7',
    coreSkills: [
      { name: 'Demand forecasting', category: 'technical', aiReplaceable: false, aiAugmented: true },
      { name: 'Supplier negotiation', category: 'social', aiReplaceable: false, aiAugmented: false },
      { name: 'Inventory optimisation', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Risk management', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'ERP system management', category: 'technical', aiReplaceable: true, aiAugmented: true },
    ],
    tasks: [
      { description: 'Generate purchase orders', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Monitor inventory levels', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Forecast demand from historical data', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Respond to supply disruptions', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Negotiate multi-year supplier contracts', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['data-analyst', 'research-assistant'],
    recommendedSkills: ['research-assistant', 'document-analyst'],
    growthOutlook: 'growing',
    salaryTierUS: 'senior',
    estimatedUSJobs: 175_000,
    knowledgeDomains: ['logistics', 'procurement', 'ERP (SAP, Oracle)', 'trade compliance', 'lean / Six Sigma'],
  },

  {
    id: 'customer-service-rep',
    title: 'Customer Service Representative',
    industry: 'Customer Success',
    description: 'Handles customer inquiries, resolves issues, and builds product satisfaction.',
    icon: '🎧',
    automationRisk: 72,
    aiAugmentation: 88,
    automationTier: 'at-risk',
    timelineYears: '1–3',
    coreSkills: [
      { name: 'Issue resolution', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Product knowledge', category: 'cognitive', aiReplaceable: true, aiAugmented: true },
      { name: 'Empathy / de-escalation', category: 'social', aiReplaceable: false, aiAugmented: false },
      { name: 'Ticket management', category: 'technical', aiReplaceable: true, aiAugmented: true },
    ],
    tasks: [
      { description: 'Answer FAQ-type questions', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Process returns and refunds', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Route complex tickets', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'De-escalate angry customers', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Build long-term client relationships', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['eli5', 'meeting-summariser'],
    recommendedSkills: ['document-analyst'],
    growthOutlook: 'declining',
    salaryTierUS: 'entry',
    estimatedUSJobs: 2_920_000,
    knowledgeDomains: ['CRM systems', 'product knowledge', 'conflict resolution', 'SLA management'],
  },

  // ─── Creative ────────────────────────────────────────────────────────────────
  {
    id: 'graphic-designer',
    title: 'Graphic Designer',
    industry: 'Creative / Design',
    description: 'Creates visual assets for branding, marketing, products, and digital experiences.',
    icon: '🎨',
    automationRisk: 35,
    aiAugmentation: 80,
    automationTier: 'transforming',
    timelineYears: '2–5',
    coreSkills: [
      { name: 'Visual composition', category: 'creative', aiReplaceable: false, aiAugmented: true },
      { name: 'Typography', category: 'creative', aiReplaceable: false, aiAugmented: true },
      { name: 'Brand identity design', category: 'creative', aiReplaceable: false, aiAugmented: false },
      { name: 'Tool proficiency (Figma, PS, AI)', category: 'technical', aiReplaceable: true, aiAugmented: true },
      { name: 'Client brief interpretation', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
    ],
    tasks: [
      { description: 'Generate concept variations', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Resize assets for different platforms', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Remove backgrounds / retouch images', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Develop brand identity system', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Present creative direction to clients', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['writing-coach', 'research-assistant'],
    recommendedSkills: ['research-assistant'],
    growthOutlook: 'stable',
    salaryTierUS: 'mid',
    estimatedUSJobs: 261_000,
    knowledgeDomains: ['visual design', 'brand identity', 'UX/UI design', 'motion graphics', 'design systems'],
  },

  // ─── Management ──────────────────────────────────────────────────────────────
  {
    id: 'product-manager',
    title: 'Product Manager',
    industry: 'Technology / Business',
    description: 'Defines product strategy, prioritises features, and aligns cross-functional teams.',
    icon: '🗺️',
    automationRisk: 20,
    aiAugmentation: 70,
    automationTier: 'augmented',
    timelineYears: '5–10',
    coreSkills: [
      { name: 'Product strategy', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'User research', category: 'social', aiReplaceable: false, aiAugmented: true },
      { name: 'Roadmap planning', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
      { name: 'Stakeholder alignment', category: 'social', aiReplaceable: false, aiAugmented: false },
      { name: 'Data-driven decision making', category: 'cognitive', aiReplaceable: false, aiAugmented: true },
    ],
    tasks: [
      { description: 'Write PRDs and user stories', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Analyse feature usage data', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Summarise user research sessions', aiHandles: true, aiAssists: false, humanRequired: false },
      { description: 'Set product vision and OKRs', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Prioritise amid competing demands', aiHandles: false, aiAssists: true, humanRequired: false },
      { description: 'Build exec buy-in', aiHandles: false, aiAssists: false, humanRequired: true },
    ],
    recommendedAgents: ['research-assistant', 'data-analyst', 'meeting-summariser'],
    recommendedSkills: ['research-assistant', 'document-analyst'],
    growthOutlook: 'growing',
    salaryTierUS: 'senior',
    estimatedUSJobs: 154_000,
    knowledgeDomains: ['product strategy', 'agile / scrum', 'user research', 'OKRs', 'growth metrics'],
  },
]

// ─── Skills Taxonomy ──────────────────────────────────────────────────────────
// Cross-industry skills with AI impact classification

export interface TaxonomySkill {
  id: string
  name: string
  category: 'technical' | 'cognitive' | 'social' | 'creative' | 'physical'
  description: string
  aiImpact: 'automates' | 'augments' | 'resilient'
  demandTrend: 'declining' | 'stable' | 'rising' | 'surging'
  industries: string[]
  linkedOccupations: string[]   // occupation IDs
}

export const SKILLS_TAXONOMY: TaxonomySkill[] = [
  {
    id: 'prompt-engineering',
    name: 'Prompt Engineering',
    category: 'technical',
    description: 'Crafting effective instructions for AI systems to achieve desired outputs.',
    aiImpact: 'augments',
    demandTrend: 'surging',
    industries: ['Technology', 'Marketing', 'Legal', 'Finance', 'Healthcare'],
    linkedOccupations: ['software-engineer', 'data-scientist', 'marketing-manager', 'content-writer'],
  },
  {
    id: 'ai-agent-orchestration',
    name: 'AI Agent Orchestration',
    category: 'technical',
    description: 'Designing and managing multi-agent systems to automate complex workflows.',
    aiImpact: 'augments',
    demandTrend: 'surging',
    industries: ['Technology', 'Operations', 'Finance'],
    linkedOccupations: ['software-engineer', 'data-scientist', 'supply-chain-manager'],
  },
  {
    id: 'critical-thinking',
    name: 'Critical Thinking',
    category: 'cognitive',
    description: 'Evaluating evidence, identifying assumptions, and reasoning to sound conclusions.',
    aiImpact: 'resilient',
    demandTrend: 'rising',
    industries: ['All'],
    linkedOccupations: ['lawyer', 'physician', 'financial-analyst', 'product-manager'],
  },
  {
    id: 'empathy-emotional-intelligence',
    name: 'Empathy & Emotional Intelligence',
    category: 'social',
    description: 'Understanding and responding to the emotional states of others.',
    aiImpact: 'resilient',
    demandTrend: 'rising',
    industries: ['Healthcare', 'Education', 'HR', 'Customer Service'],
    linkedOccupations: ['nurse', 'teacher', 'hr-manager', 'physician'],
  },
  {
    id: 'data-literacy',
    name: 'Data Literacy',
    category: 'cognitive',
    description: 'Reading, working with, and communicating using data effectively.',
    aiImpact: 'augments',
    demandTrend: 'surging',
    industries: ['All'],
    linkedOccupations: ['financial-analyst', 'marketing-manager', 'hr-manager', 'supply-chain-manager'],
  },
  {
    id: 'systems-thinking',
    name: 'Systems Thinking',
    category: 'cognitive',
    description: 'Understanding how components of a system interact to produce complex behaviours.',
    aiImpact: 'resilient',
    demandTrend: 'rising',
    industries: ['Technology', 'Healthcare', 'Operations', 'Policy'],
    linkedOccupations: ['software-engineer', 'supply-chain-manager', 'product-manager'],
  },
  {
    id: 'creative-problem-solving',
    name: 'Creative Problem Solving',
    category: 'creative',
    description: 'Generating novel solutions to complex, ambiguous problems.',
    aiImpact: 'resilient',
    demandTrend: 'rising',
    industries: ['All'],
    linkedOccupations: ['product-manager', 'graphic-designer', 'marketing-manager'],
  },
  {
    id: 'negotiation',
    name: 'Negotiation & Persuasion',
    category: 'social',
    description: 'Influencing outcomes through dialogue and reaching mutually beneficial agreements.',
    aiImpact: 'resilient',
    demandTrend: 'stable',
    industries: ['Legal', 'Sales', 'HR', 'Finance', 'Supply Chain'],
    linkedOccupations: ['lawyer', 'recruiter', 'hr-manager', 'supply-chain-manager'],
  },
  {
    id: 'llm-fine-tuning',
    name: 'LLM Fine-tuning & RAG',
    category: 'technical',
    description: 'Adapting large language models for specific domains using fine-tuning or retrieval-augmented generation.',
    aiImpact: 'augments',
    demandTrend: 'surging',
    industries: ['Technology', 'Finance', 'Healthcare', 'Legal'],
    linkedOccupations: ['data-scientist', 'software-engineer'],
  },
  {
    id: 'regulatory-compliance',
    name: 'Regulatory & Compliance Knowledge',
    category: 'cognitive',
    description: 'Understanding and applying relevant laws, standards, and regulations in a specific domain.',
    aiImpact: 'augments',
    demandTrend: 'rising',
    industries: ['Legal', 'Finance', 'Healthcare', 'Technology'],
    linkedOccupations: ['lawyer', 'accountant', 'financial-analyst', 'physician'],
  },
]

// ─── Domain Knowledge Areas ───────────────────────────────────────────────────

export interface DomainKnowledgeArea {
  id: string
  name: string
  description: string
  icon: string
  automationPotential: number   // 0-100 (how much can AI automate tasks in this domain)
  keySubdomains: string[]
  primaryOccupations: string[]  // occupation IDs
  claudeForgeSkill: string | null  // corresponding SKILL.md ID
  useCases: string[]            // specific ways ClaudeForge helps
}

export const DOMAIN_KNOWLEDGE_AREAS: DomainKnowledgeArea[] = [
  {
    id: 'legal',
    name: 'Legal & Compliance',
    description: 'Contract review, legal research, regulatory mapping, and document drafting at scale.',
    icon: '⚖️',
    automationPotential: 68,
    keySubdomains: ['Contract Law', 'IP Law', 'Employment Law', 'Regulatory Compliance', 'M&A Due Diligence'],
    primaryOccupations: ['lawyer', 'paralegal'],
    claudeForgeSkill: 'legal-analyst',
    useCases: [
      'Automated contract risk review and redline suggestions',
      'Case law research and precedent mapping',
      'Regulatory change monitoring and impact analysis',
      'Due diligence document extraction',
      'Drafting NDAs, MSAs, employment agreements',
    ],
  },
  {
    id: 'finance',
    name: 'Finance & Investment',
    description: 'Financial modelling, earnings analysis, risk assessment, and investment research automation.',
    icon: '💹',
    automationPotential: 72,
    keySubdomains: ['Equity Research', 'Risk Management', 'Tax', 'Audit', 'FP&A'],
    primaryOccupations: ['financial-analyst', 'accountant'],
    claudeForgeSkill: 'financial-analyst',
    useCases: [
      'Earnings report summarisation and sentiment analysis',
      'Automated variance analysis and commentary',
      'Investment thesis generation from 10-K/10-Q filings',
      'Risk factor extraction and benchmarking',
      'Financial model documentation and audit trails',
    ],
  },
  {
    id: 'healthcare',
    name: 'Healthcare & Clinical',
    description: 'Clinical documentation, medical literature synthesis, and patient data summarisation.',
    icon: '🏥',
    automationPotential: 55,
    keySubdomains: ['Clinical Documentation', 'Medical Research', 'Drug Discovery', 'Diagnostics', 'Care Coordination'],
    primaryOccupations: ['physician', 'nurse', 'radiologist'],
    claudeForgeSkill: 'medical-documentor',
    useCases: [
      'SOAP note generation from voice transcripts',
      'Medical literature review and synthesis',
      'Discharge summary drafting',
      'Drug interaction screening documentation',
      'Prior authorisation letter generation',
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing & Growth',
    description: 'Campaign content generation, audience research, competitive analysis, and performance reporting.',
    icon: '📢',
    automationPotential: 78,
    keySubdomains: ['Content Marketing', 'SEO', 'Paid Media', 'Brand Strategy', 'Customer Analytics'],
    primaryOccupations: ['marketing-manager', 'content-writer'],
    claudeForgeSkill: 'marketing-strategist',
    useCases: [
      'Multi-channel content calendar generation',
      'Competitor analysis and battlecard creation',
      'A/B test copy variant generation',
      'Customer persona development from data',
      'Weekly performance report drafting',
    ],
  },
  {
    id: 'hr-talent',
    name: 'HR & Talent Management',
    description: 'Recruiting automation, performance management, and HR compliance at scale.',
    icon: '🤝',
    automationPotential: 65,
    keySubdomains: ['Talent Acquisition', 'Learning & Development', 'Performance Management', 'Compensation', 'DEI'],
    primaryOccupations: ['hr-manager', 'recruiter'],
    claudeForgeSkill: 'hr-specialist',
    useCases: [
      'Automated resume screening and ranking',
      'Job description generation with bias reduction',
      'Performance review 360-degree synthesis',
      'Onboarding document personalisation',
      'Employee sentiment analysis from survey data',
    ],
  },
  {
    id: 'supply-chain',
    name: 'Supply Chain & Operations',
    description: 'Demand planning, supplier intelligence, logistics optimisation, and risk monitoring.',
    icon: '🔗',
    automationPotential: 70,
    keySubdomains: ['Procurement', 'Logistics', 'Inventory Management', 'Risk Management', 'Sustainability'],
    primaryOccupations: ['supply-chain-manager'],
    claudeForgeSkill: null,
    useCases: [
      'Supplier risk assessment from news and data',
      'RFP document generation',
      'Procurement spend analysis reporting',
      'Logistics exception management summaries',
      'ESG supplier audit documentation',
    ],
  },
  {
    id: 'software-engineering',
    name: 'Software Engineering',
    description: 'Code generation, review, documentation, architecture guidance, and test writing.',
    icon: '💻',
    automationPotential: 60,
    keySubdomains: ['Backend Engineering', 'Frontend Development', 'DevOps', 'Security', 'Data Engineering'],
    primaryOccupations: ['software-engineer', 'data-scientist', 'cybersecurity-analyst'],
    claudeForgeSkill: 'code-reviewer',
    useCases: [
      'PR code review with security and performance feedback',
      'Technical documentation generation',
      'Unit test suite generation from source code',
      'Architecture decision record (ADR) drafting',
      'Bug investigation and root cause analysis',
    ],
  },
  {
    id: 'education',
    name: 'Education & Training',
    description: 'Curriculum design, personalised learning content, assessment generation, and tutoring.',
    icon: '📚',
    automationPotential: 52,
    keySubdomains: ['K-12', 'Higher Education', 'Corporate Training', 'EdTech', 'Assessment'],
    primaryOccupations: ['teacher'],
    claudeForgeSkill: null,
    useCases: [
      'Personalised lesson plan generation',
      'Quiz and assessment item creation',
      'Learning objective mapping',
      'Student feedback synthesis',
      'Course content adaptation for different levels',
    ],
  },
]
