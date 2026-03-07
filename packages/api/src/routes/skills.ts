import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ok, fail } from '../middleware/response.js'
import { parseSkillMd } from '@claudeforge/agents'

export const skillsRouter = Router()

// GET /api/skills — list all skills
skillsRouter.get('/', async (_req, res) => {
  const rows = await db.select().from(schema.skills)
  ok(res, rows)
})

// GET /api/skills/:id
skillsRouter.get('/:id', async (req, res) => {
  const [skill] = await db.select().from(schema.skills).where(eq(schema.skills.id, req.params.id))
  if (!skill) return fail(res, 'Skill not found', 404)
  ok(res, skill)
})

// POST /api/skills — create a skill from SKILL.md content
skillsRouter.post('/', async (req, res) => {
  const { skillMd, name, description } = req.body
  if (!skillMd) return fail(res, 'skillMd is required')

  let parsed
  try {
    parsed = parseSkillMd(skillMd as string)
  } catch (err) {
    return fail(res, `Failed to parse SKILL.md: ${err instanceof Error ? err.message : String(err)}`)
  }

  const skill = {
    id: uuidv4(),
    name: name ?? parsed.metadata.name,
    description: description ?? parsed.metadata.description,
    version: parsed.metadata.version,
    skillMd: skillMd as string,
    tags: JSON.stringify(parsed.metadata.tags ?? []),
  }

  await db.insert(schema.skills).values(skill)
  const [created] = await db.select().from(schema.skills).where(eq(schema.skills.id, skill.id))
  ok(res, created)
})

// DELETE /api/skills/:id
skillsRouter.delete('/:id', async (req, res) => {
  const [existing] = await db.select().from(schema.skills).where(eq(schema.skills.id, req.params.id))
  if (!existing) return fail(res, 'Skill not found', 404)
  await db.delete(schema.skills).where(eq(schema.skills.id, req.params.id))
  ok(res, { deleted: true, id: req.params.id })
})
