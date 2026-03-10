import { Router } from 'express'
import { ok } from '../middleware/response.js'
import {
  WORKFORCE_OCCUPATIONS,
  SKILLS_TAXONOMY,
  DOMAIN_KNOWLEDGE_AREAS,
  type AutomationTier,
  type GrowthOutlook,
} from '../data/workforce.js'

export const workforceRouter = Router()

// ─── GET /api/workforce/occupations ──────────────────────────────────────────
// Returns all workforce occupations with automation intelligence data.
// Supports filtering by industry, automationTier, growthOutlook.

workforceRouter.get('/occupations', (req, res) => {
  const { industry, tier, growth, search } = req.query as Record<string, string>

  let results = [...WORKFORCE_OCCUPATIONS]

  if (industry) {
    const q = industry.toLowerCase()
    results = results.filter((o) => o.industry.toLowerCase().includes(q))
  }

  if (tier) {
    results = results.filter((o) => o.automationTier === (tier as AutomationTier))
  }

  if (growth) {
    results = results.filter((o) => o.growthOutlook === (growth as GrowthOutlook))
  }

  if (search) {
    const q = search.toLowerCase()
    results = results.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q) ||
        o.industry.toLowerCase().includes(q) ||
        o.knowledgeDomains.some((d) => d.toLowerCase().includes(q)),
    )
  }

  // Attach summary stats
  const stats = {
    total: results.length,
    byTier: {
      'at-risk': results.filter((o) => o.automationTier === 'at-risk').length,
      transforming: results.filter((o) => o.automationTier === 'transforming').length,
      augmented: results.filter((o) => o.automationTier === 'augmented').length,
      resilient: results.filter((o) => o.automationTier === 'resilient').length,
    },
    avgAutomationRisk: Math.round(results.reduce((s, o) => s + o.automationRisk, 0) / (results.length || 1)),
    avgAiAugmentation: Math.round(results.reduce((s, o) => s + o.aiAugmentation, 0) / (results.length || 1)),
    totalUSJobsAffected: results.reduce((s, o) => s + o.estimatedUSJobs, 0),
  }

  ok(res, { occupations: results, stats })
})

// ─── GET /api/workforce/occupations/:id ──────────────────────────────────────

workforceRouter.get('/occupations/:id', (req, res) => {
  const occ = WORKFORCE_OCCUPATIONS.find((o) => o.id === req.params.id)
  if (!occ) {
    res.status(404).json({ error: 'Occupation not found', data: null, meta: {} })
    return
  }

  // Enrich with related skills from taxonomy
  const relatedSkills = SKILLS_TAXONOMY.filter((s) =>
    s.linkedOccupations.includes(occ.id),
  )

  // Find domain knowledge areas for this occupation
  const domains = DOMAIN_KNOWLEDGE_AREAS.filter((d) =>
    d.primaryOccupations.includes(occ.id),
  )

  ok(res, { occupation: occ, relatedSkills, domains })
})

// ─── GET /api/workforce/skills ────────────────────────────────────────────────
// Returns the skills taxonomy with AI impact classification.

workforceRouter.get('/skills', (req, res) => {
  const { impact, trend, category } = req.query as Record<string, string>

  let results = [...SKILLS_TAXONOMY]

  if (impact) results = results.filter((s) => s.aiImpact === impact)
  if (trend) results = results.filter((s) => s.demandTrend === trend)
  if (category) results = results.filter((s) => s.category === category)

  const stats = {
    total: results.length,
    byImpact: {
      automates: results.filter((s) => s.aiImpact === 'automates').length,
      augments: results.filter((s) => s.aiImpact === 'augments').length,
      resilient: results.filter((s) => s.aiImpact === 'resilient').length,
    },
    surging: results.filter((s) => s.demandTrend === 'surging').map((s) => s.name),
  }

  ok(res, { skills: results, stats })
})

// ─── GET /api/workforce/domains ───────────────────────────────────────────────
// Returns domain knowledge areas with automation potential and use cases.

workforceRouter.get('/domains', (req, res) => {
  const { search } = req.query as Record<string, string>

  let results = [...DOMAIN_KNOWLEDGE_AREAS]

  if (search) {
    const q = search.toLowerCase()
    results = results.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.keySubdomains.some((s) => s.toLowerCase().includes(q)),
    )
  }

  ok(res, { domains: results })
})

// ─── GET /api/workforce/domains/:id ──────────────────────────────────────────

workforceRouter.get('/domains/:id', (req, res) => {
  const domain = DOMAIN_KNOWLEDGE_AREAS.find((d) => d.id === req.params.id)
  if (!domain) {
    res.status(404).json({ error: 'Domain not found', data: null, meta: {} })
    return
  }

  const occupations = WORKFORCE_OCCUPATIONS.filter((o) =>
    domain.primaryOccupations.includes(o.id),
  )

  ok(res, { domain, occupations })
})

// ─── GET /api/workforce/insights ─────────────────────────────────────────────
// Aggregate workforce intelligence insights — dashboard summary.

workforceRouter.get('/insights', (_req, res) => {
  const total = WORKFORCE_OCCUPATIONS.length
  const totalJobs = WORKFORCE_OCCUPATIONS.reduce((s, o) => s + o.estimatedUSJobs, 0)
  const atRiskJobs = WORKFORCE_OCCUPATIONS
    .filter((o) => o.automationTier === 'at-risk')
    .reduce((s, o) => s + o.estimatedUSJobs, 0)

  const topAtRisk = [...WORKFORCE_OCCUPATIONS]
    .sort((a, b) => b.automationRisk - a.automationRisk)
    .slice(0, 5)
    .map((o) => ({ id: o.id, title: o.title, automationRisk: o.automationRisk, icon: o.icon }))

  const mostAugmented = [...WORKFORCE_OCCUPATIONS]
    .sort((a, b) => b.aiAugmentation - a.aiAugmentation)
    .slice(0, 5)
    .map((o) => ({ id: o.id, title: o.title, aiAugmentation: o.aiAugmentation, icon: o.icon }))

  const highGrowth = WORKFORCE_OCCUPATIONS
    .filter((o) => o.growthOutlook === 'high-growth')
    .map((o) => ({ id: o.id, title: o.title, icon: o.icon, industry: o.industry }))

  const surgingSkills = SKILLS_TAXONOMY
    .filter((s) => s.demandTrend === 'surging')
    .map((s) => ({ id: s.id, name: s.name, aiImpact: s.aiImpact }))

  ok(res, {
    summary: {
      totalOccupations: total,
      totalUSJobs: totalJobs,
      atRiskUSJobs: atRiskJobs,
      atRiskPercent: Math.round((atRiskJobs / totalJobs) * 100),
      avgAutomationRisk: Math.round(
        WORKFORCE_OCCUPATIONS.reduce((s, o) => s + o.automationRisk, 0) / total,
      ),
      avgAiAugmentation: Math.round(
        WORKFORCE_OCCUPATIONS.reduce((s, o) => s + o.aiAugmentation, 0) / total,
      ),
    },
    topAtRisk,
    mostAugmented,
    highGrowth,
    surgingSkills,
    domains: DOMAIN_KNOWLEDGE_AREAS.map((d) => ({
      id: d.id,
      name: d.name,
      icon: d.icon,
      automationPotential: d.automationPotential,
    })),
  })
})
