import { Router } from 'express'
import { ok } from '../middleware/response.js'
import { WORKFORCE_OCCUPATIONS, DOMAIN_KNOWLEDGE_AREAS, SKILLS_TAXONOMY } from '../data/workforce.js'
import { AGENT_TEMPLATES } from '../data/templates.js'

export const automationRouter = Router()

// ─── POST /api/automation/analyze ────────────────────────────────────────────
// Analyse a given occupation or job description and return:
// - Automation risk score
// - Task breakdown (AI-handle / AI-assist / human)
// - Recommended ClaudeForge agents
// - Upskilling recommendations

automationRouter.post('/analyze', (req, res) => {
  const { occupationId, title } = req.body as { occupationId?: string; title?: string }

  // Find by ID first, then fuzzy match by title
  let occ = occupationId
    ? WORKFORCE_OCCUPATIONS.find((o) => o.id === occupationId)
    : undefined

  if (!occ && title) {
    const q = title.toLowerCase()
    occ = WORKFORCE_OCCUPATIONS.find(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        q.includes(o.title.toLowerCase().split(' ')[0].toLowerCase()),
    )
  }

  if (!occ) {
    res.status(404).json({
      error: 'Occupation not found. Try /api/workforce/occupations for available roles.',
      data: null,
      meta: {},
    })
    return
  }

  const aiHandleCount = occ.tasks.filter((t) => t.aiHandles).length
  const aiAssistCount = occ.tasks.filter((t) => t.aiAssists).length
  const humanRequiredCount = occ.tasks.filter((t) => t.humanRequired).length
  const totalTasks = occ.tasks.length

  const automatedPercent = Math.round((aiHandleCount / totalTasks) * 100)
  const assistedPercent = Math.round((aiAssistCount / totalTasks) * 100)
  const humanPercent = Math.round((humanRequiredCount / totalTasks) * 100)

  // Recommended agents from templates
  const recommendedAgents = AGENT_TEMPLATES.filter((t) =>
    occ!.recommendedAgents.includes(t.id),
  ).map((t) => ({
    id: t.id,
    name: t.name,
    icon: t.icon,
    description: t.description,
    model: t.model,
  }))

  // Skills to develop (resilient + surging demand)
  const upskillingRecs = SKILLS_TAXONOMY
    .filter(
      (s) =>
        (s.aiImpact === 'resilient' || s.demandTrend === 'surging') &&
        (s.linkedOccupations.includes(occ!.id) || s.industries.includes('All')),
    )
    .slice(0, 5)
    .map((s) => ({
      name: s.name,
      category: s.category,
      reason: s.aiImpact === 'resilient'
        ? 'AI cannot replace this skill — high long-term value'
        : 'Demand is surging as AI adoption accelerates',
      demandTrend: s.demandTrend,
    }))

  // Domain knowledge areas applicable
  const domains = DOMAIN_KNOWLEDGE_AREAS.filter((d) =>
    d.primaryOccupations.includes(occ!.id),
  ).map((d) => ({
    id: d.id,
    name: d.name,
    icon: d.icon,
    automationPotential: d.automationPotential,
    topUseCases: d.useCases.slice(0, 3),
  }))

  // ROI estimate: hours saved per week (rough heuristic)
  const hoursPerWeek = 40
  const aiHoursSaved = Math.round(hoursPerWeek * (occ.aiAugmentation / 100) * 0.4)

  ok(res, {
    occupation: {
      id: occ.id,
      title: occ.title,
      industry: occ.industry,
      icon: occ.icon,
    },
    automationAnalysis: {
      automationRisk: occ.automationRisk,
      aiAugmentation: occ.aiAugmentation,
      automationTier: occ.automationTier,
      timelineYears: occ.timelineYears,
      growthOutlook: occ.growthOutlook,
    },
    taskBreakdown: {
      total: totalTasks,
      aiAutomates: { count: aiHandleCount, percent: automatedPercent },
      aiAssists: { count: aiAssistCount, percent: assistedPercent },
      humanRequired: { count: humanRequiredCount, percent: humanPercent },
      tasks: occ.tasks,
    },
    roiEstimate: {
      hoursPerWeekSaved: aiHoursSaved,
      annualHoursSaved: aiHoursSaved * 52,
      productivityGainPercent: Math.round(occ.aiAugmentation * 0.45),
    },
    recommendedAgents,
    upskillingRecommendations: upskillingRecs,
    domains,
  })
})

// ─── GET /api/automation/compare ─────────────────────────────────────────────
// Compare multiple occupations by automation risk side-by-side.

automationRouter.get('/compare', (req, res) => {
  const ids = (req.query.ids as string)?.split(',').filter(Boolean) ?? []

  if (ids.length < 2) {
    res.status(400).json({
      error: 'Provide at least 2 occupation IDs as ?ids=id1,id2',
      data: null,
      meta: {},
    })
    return
  }

  const occupations = ids
    .map((id) => WORKFORCE_OCCUPATIONS.find((o) => o.id === id.trim()))
    .filter(Boolean)

  const comparison = occupations.map((o) => ({
    id: o!.id,
    title: o!.title,
    icon: o!.icon,
    industry: o!.industry,
    automationRisk: o!.automationRisk,
    aiAugmentation: o!.aiAugmentation,
    automationTier: o!.automationTier,
    growthOutlook: o!.growthOutlook,
    estimatedUSJobs: o!.estimatedUSJobs,
    timelineYears: o!.timelineYears,
    tasksAiHandles: o!.tasks.filter((t) => t.aiHandles).length,
    tasksHumanRequired: o!.tasks.filter((t) => t.humanRequired).length,
  }))

  ok(res, { comparison })
})

// ─── GET /api/automation/leaderboard ─────────────────────────────────────────
// Top occupations ranked by automation risk, augmentation potential, or growth.

automationRouter.get('/leaderboard', (req, res) => {
  const { sortBy = 'automationRisk', order = 'desc', limit = '10' } = req.query as Record<string, string>

  const field = sortBy as 'automationRisk' | 'aiAugmentation'
  const validFields = ['automationRisk', 'aiAugmentation']

  if (!validFields.includes(field)) {
    res.status(400).json({ error: `sortBy must be one of: ${validFields.join(', ')}`, data: null, meta: {} })
    return
  }

  const sorted = [...WORKFORCE_OCCUPATIONS].sort((a, b) =>
    order === 'asc' ? a[field] - b[field] : b[field] - a[field],
  )

  const results = sorted.slice(0, Math.min(parseInt(limit, 10), 50)).map((o, i) => ({
    rank: i + 1,
    id: o.id,
    title: o.title,
    icon: o.icon,
    industry: o.industry,
    automationRisk: o.automationRisk,
    aiAugmentation: o.aiAugmentation,
    automationTier: o.automationTier,
    growthOutlook: o.growthOutlook,
    estimatedUSJobs: o.estimatedUSJobs,
  }))

  ok(res, { leaderboard: results, sortBy: field, order })
})
