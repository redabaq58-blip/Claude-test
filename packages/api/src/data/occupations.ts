// ─── Occupations ─────────────────────────────────────────────────────────────
// Professional roles used to personalise agent behaviour and system prompts.
// When a user selects an occupation, agents adjust terminology, depth, and
// communication style to match that professional context.

export interface Occupation {
  id: string
  title: string
  description: string
  icon: string
  category: 'engineering' | 'product' | 'design' | 'data' | 'business' | 'creative' | 'science' | 'other'
  expertiseAreas: string[]
  communicationStyle: string
  systemPromptSuffix: string
}

export const OCCUPATIONS: Occupation[] = [
  {
    id: 'software-engineer',
    title: 'Software Engineer',
    description: 'Builds and maintains software systems. Comfortable with code, architecture, and technical trade-offs.',
    icon: '💻',
    category: 'engineering',
    expertiseAreas: ['TypeScript', 'system design', 'algorithms', 'APIs', 'debugging'],
    communicationStyle: 'technical and precise',
    systemPromptSuffix: `The user is a software engineer. Use technical terminology freely. Include code examples when relevant. Discuss trade-offs, edge cases, and implementation details. Skip basic explanations of programming concepts.`,
  },

  {
    id: 'frontend-developer',
    title: 'Frontend Developer',
    description: 'Specialises in building user interfaces and web experiences with modern JavaScript frameworks.',
    icon: '🎨',
    category: 'engineering',
    expertiseAreas: ['React', 'CSS', 'TypeScript', 'UX', 'performance', 'accessibility'],
    communicationStyle: 'technical with visual focus',
    systemPromptSuffix: `The user is a frontend developer. Focus on UI/UX implementation, browser APIs, and framework-specific patterns. Include JSX/TSX code examples. Discuss accessibility (a11y), responsive design, and web performance when relevant.`,
  },

  {
    id: 'backend-engineer',
    title: 'Backend Engineer',
    description: 'Designs and builds server-side systems, APIs, databases, and infrastructure.',
    icon: '⚙️',
    category: 'engineering',
    expertiseAreas: ['APIs', 'databases', 'distributed systems', 'performance', 'security'],
    communicationStyle: 'technical and systems-focused',
    systemPromptSuffix: `The user is a backend engineer. Discuss server-side patterns, database design, API contracts, and system reliability. Include implementation examples for Node.js, Python, Go, or Java as appropriate. Address performance and scalability concerns.`,
  },

  {
    id: 'devops-engineer',
    title: 'DevOps / Platform Engineer',
    description: 'Manages CI/CD pipelines, cloud infrastructure, and developer tooling.',
    icon: '🚀',
    category: 'engineering',
    expertiseAreas: ['Docker', 'Kubernetes', 'CI/CD', 'cloud', 'monitoring', 'IaC'],
    communicationStyle: 'technical with operational focus',
    systemPromptSuffix: `The user is a DevOps or platform engineer. Use infrastructure and operations terminology. Discuss deployment strategies, monitoring, reliability, and automation. Include shell commands, Dockerfile snippets, or Kubernetes manifests when helpful.`,
  },

  {
    id: 'data-scientist',
    title: 'Data Scientist',
    description: 'Extracts insights from data using statistics, machine learning, and analytical techniques.',
    icon: '📊',
    category: 'data',
    expertiseAreas: ['Python', 'machine learning', 'statistics', 'data visualisation', 'SQL'],
    communicationStyle: 'analytical and evidence-based',
    systemPromptSuffix: `The user is a data scientist. Use statistical and ML terminology naturally. Include Python code with pandas, scikit-learn, or PyTorch when relevant. Discuss model evaluation, data quality, and statistical significance. Reference academic concepts where appropriate.`,
  },

  {
    id: 'data-engineer',
    title: 'Data Engineer',
    description: 'Builds data pipelines, warehouses, and the infrastructure that powers analytics.',
    icon: '🔧',
    category: 'data',
    expertiseAreas: ['ETL', 'SQL', 'Spark', 'data modelling', 'cloud data platforms'],
    communicationStyle: 'technical and data-focused',
    systemPromptSuffix: `The user is a data engineer. Discuss pipeline architecture, data modelling (star schema, dbt, etc.), orchestration (Airflow, Prefect), and warehouse optimisation. Use SQL examples freely and reference modern data stack tools when relevant.`,
  },

  {
    id: 'ml-engineer',
    title: 'Machine Learning Engineer',
    description: 'Takes ML models from research to production, focusing on reliability, scalability, and performance.',
    icon: '🤖',
    category: 'data',
    expertiseAreas: ['model deployment', 'MLOps', 'PyTorch', 'inference optimisation', 'feature engineering'],
    communicationStyle: 'technical bridging research and production',
    systemPromptSuffix: `The user is an ML engineer. Bridge research and production concerns: discuss model serving, latency optimisation, monitoring (data drift, model degradation), and MLOps tooling. Include PyTorch or TensorFlow examples when helpful. Balance theoretical rigour with practical constraints.`,
  },

  {
    id: 'product-manager',
    title: 'Product Manager',
    description: 'Defines product vision, prioritises features, and aligns engineering, design, and business goals.',
    icon: '📋',
    category: 'product',
    expertiseAreas: ['roadmapping', 'user research', 'metrics', 'stakeholder management', 'agile'],
    communicationStyle: 'strategic and outcome-focused',
    systemPromptSuffix: `The user is a product manager. Focus on outcomes, user value, and business impact. Use frameworks like RICE, OKRs, and Jobs-to-be-Done when relevant. Avoid deep technical implementation details — summarise them at a level suitable for stakeholder communication. Discuss trade-offs in terms of user impact and business value.`,
  },

  {
    id: 'ux-designer',
    title: 'UX Designer',
    description: 'Designs user experiences through research, prototyping, and iterative design.',
    icon: '🖌️',
    category: 'design',
    expertiseAreas: ['user research', 'wireframing', 'Figma', 'usability testing', 'interaction design'],
    communicationStyle: 'empathetic and user-centred',
    systemPromptSuffix: `The user is a UX designer. Focus on user needs, usability principles, and design patterns. Reference Figma, design systems, and interaction models when helpful. Discuss accessibility and inclusive design. Keep technical implementation details light — focus on the user experience layer.`,
  },

  {
    id: 'startup-founder',
    title: 'Startup Founder',
    description: 'Building a company from scratch. Needs practical, actionable advice across all business functions.',
    icon: '🏗️',
    category: 'business',
    expertiseAreas: ['strategy', 'fundraising', 'GTM', 'hiring', 'product-market fit'],
    communicationStyle: 'direct, practical, and high-signal',
    systemPromptSuffix: `The user is a startup founder. Be direct and cut to what matters. Prioritise actionable advice over theoretical frameworks. Acknowledge resource constraints (time, money, team size). Discuss trade-offs in terms of speed vs quality, build vs buy, and short vs long-term. Reference Y Combinator, common startup patterns, and real-world examples when useful.`,
  },

  {
    id: 'marketing-manager',
    title: 'Marketing Manager',
    description: 'Drives growth through campaigns, content, brand positioning, and customer acquisition.',
    icon: '📣',
    category: 'business',
    expertiseAreas: ['content marketing', 'SEO', 'paid acquisition', 'brand', 'analytics'],
    communicationStyle: 'persuasive and audience-aware',
    systemPromptSuffix: `The user is a marketing manager. Focus on messaging, audience segmentation, campaign performance, and ROI. Use marketing terminology (CAC, LTV, funnel, conversion rate, etc.) naturally. When writing copy, optimise for clarity and persuasion. Reference GA4, HubSpot, or similar tools when discussing measurement.`,
  },

  {
    id: 'security-engineer',
    title: 'Security Engineer',
    description: 'Protects systems and data from threats through offensive and defensive security practices.',
    icon: '🔒',
    category: 'engineering',
    expertiseAreas: ['threat modelling', 'penetration testing', 'OWASP', 'cloud security', 'incident response'],
    communicationStyle: 'precise and threat-aware',
    systemPromptSuffix: `The user is a security engineer. Use security-specific terminology (CVE, CVSS, threat vectors, attack surface, etc.). Discuss defensive measures, detection strategies, and secure coding practices. Be precise about severity and exploitability. Reference OWASP, NIST, and industry standards where applicable.`,
  },

  {
    id: 'researcher',
    title: 'Researcher / Academic',
    description: 'Conducts rigorous research, writes papers, and synthesises knowledge in a specialised domain.',
    icon: '🔬',
    category: 'science',
    expertiseAreas: ['literature review', 'methodology', 'academic writing', 'statistics', 'peer review'],
    communicationStyle: 'rigorous and evidence-based',
    systemPromptSuffix: `The user is a researcher or academic. Use precise, domain-appropriate language. Cite confidence levels and distinguish between correlation and causation. Discuss methodological considerations and limitations. When summarising research, preserve nuance and avoid overgeneralisation. Suggest primary sources and literature when relevant.`,
  },

  {
    id: 'content-creator',
    title: 'Content Creator / Writer',
    description: 'Creates written, video, or multimedia content for audiences across different platforms.',
    icon: '✍️',
    category: 'creative',
    expertiseAreas: ['storytelling', 'SEO', 'audience engagement', 'brand voice', 'social media'],
    communicationStyle: 'engaging and narrative-driven',
    systemPromptSuffix: `The user is a content creator or writer. Prioritise clarity, engagement, and storytelling. Help craft narratives that resonate with audiences. Discuss content strategy, platform-specific formats (YouTube, newsletters, X/Twitter, LinkedIn), and audience building. Be creative and suggest hooks, angles, and formats.`,
  },

  {
    id: 'financial-analyst',
    title: 'Financial Analyst',
    description: 'Evaluates financial data, models, and investments to support business decisions.',
    icon: '📈',
    category: 'business',
    expertiseAreas: ['financial modelling', 'valuation', 'Excel', 'accounting', 'investment analysis'],
    communicationStyle: 'precise and quantitative',
    systemPromptSuffix: `The user is a financial analyst. Use financial terminology (DCF, EBITDA, working capital, etc.) freely. Include quantitative reasoning and model assumptions when discussing projections. Discuss risk factors and sensitivity analysis. Reference accounting standards (GAAP/IFRS) and financial frameworks when relevant.`,
  },

  {
    id: 'student',
    title: 'Student / Learner',
    description: 'Actively learning a subject and looking for clear explanations, examples, and guidance.',
    icon: '🎓',
    category: 'other',
    expertiseAreas: ['learning', 'study techniques', 'concept understanding', 'exam prep'],
    communicationStyle: 'clear, educational, and encouraging',
    systemPromptSuffix: `The user is a student or learner. Explain concepts clearly from first principles. Use analogies and worked examples. Check understanding by summarising key points. Be encouraging and patient. Avoid overwhelming jargon — introduce new terms with definitions. Suggest additional resources when helpful.`,
  },

  {
    id: 'executive',
    title: 'Executive / Leader',
    description: 'Senior leader responsible for strategy, people, and organisational outcomes.',
    icon: '🏛️',
    category: 'business',
    expertiseAreas: ['strategy', 'leadership', 'organisational design', 'board communication', 'P&L'],
    communicationStyle: 'concise, strategic, and high-level',
    systemPromptSuffix: `The user is a senior executive or leader. Be concise and lead with the bottom line. Structure answers as: recommendation → rationale → key risks → next steps. Skip implementation details unless asked. Discuss topics in terms of strategic impact, organisational dynamics, and stakeholder considerations.`,
  },
]

export function getOccupation(id: string): Occupation | undefined {
  return OCCUPATIONS.find((o) => o.id === id)
}

export function getOccupationsByCategory(category: string): Occupation[] {
  return OCCUPATIONS.filter((o) => o.category === category)
}
