import { Router } from 'express'
import { db } from '../db/index.js'
import { ok } from '../middleware/response.js'
import { sql } from 'drizzle-orm'

export const runsRouter = Router()

// GET /api/runs — aggregate all agent runs across all agents
// Query params: ?agentId=, ?status=, ?from=, ?to=, ?limit=, ?offset=
runsRouter.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string ?? '20', 10), 100)
  const offset = parseInt(req.query.offset as string ?? '0', 10)
  const agentId = req.query.agentId as string | undefined
  const status = req.query.status as string | undefined
  const from = req.query.from as string | undefined
  const to = req.query.to as string | undefined

  // Build WHERE clause dynamically
  const conditions: string[] = []
  if (agentId) conditions.push(`r.agent_id = '${agentId.replace(/'/g, "''")}'`)
  if (status) conditions.push(`r.status = '${status.replace(/'/g, "''")}'`)
  if (from) conditions.push(`r.started_at >= '${from.replace(/'/g, "''")}'`)
  if (to) conditions.push(`r.started_at <= '${to.replace(/'/g, "''")}'`)

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const rows = await db.all(sql.raw(`
    SELECT
      r.id,
      r.agent_id,
      a.name as agent_name,
      r.status,
      r.input,
      r.output,
      r.error,
      r.input_tokens,
      r.output_tokens,
      r.cost_usd,
      r.duration_ms,
      r.model,
      r.started_at,
      r.completed_at
    FROM agent_runs r
    LEFT JOIN agents a ON r.agent_id = a.id
    ${where}
    ORDER BY r.started_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `))

  const [{ total }] = await db.all(sql.raw(`
    SELECT COUNT(*) as total
    FROM agent_runs r
    ${where}
  `)) as [{ total: number }]

  ok(res, rows, { total, limit, offset, hasMore: offset + limit < total })
})
