import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ok, fail } from '../middleware/response.js'
import { AGENT_TEMPLATES, getTemplate, getTemplatesByCategory } from '../data/templates.js'

export const templatesRouter = Router()

// GET /api/templates — list all agent templates
templatesRouter.get('/', (_req, res) => {
  ok(res, AGENT_TEMPLATES)
})

// GET /api/templates/:category — templates by category
templatesRouter.get('/category/:category', (req, res) => {
  const templates = getTemplatesByCategory(req.params.category)
  ok(res, templates)
})

// GET /api/templates/:id — get a single template
templatesRouter.get('/:id', (req, res) => {
  const template = getTemplate(req.params.id)
  if (!template) return fail(res, 'Template not found', 404)
  ok(res, template)
})

// POST /api/templates/:id/create — create an agent from a template
templatesRouter.post('/:id/create', async (req, res) => {
  const template = getTemplate(req.params.id)
  if (!template) return fail(res, 'Template not found', 404)

  const agentId = uuidv4()
  const agent = {
    id: agentId,
    name: req.body.name ?? template.name,
    description: template.description,
    model: template.model,
    systemPrompt: template.systemPrompt,
    maxTokens: 8192,
    temperature: 1.0,
  }

  await db.insert(schema.agents).values(agent)
  const [created] = await db.select().from(schema.agents).where(eq(schema.agents.id, agentId))
  ok(res, { agent: created, template })
})
