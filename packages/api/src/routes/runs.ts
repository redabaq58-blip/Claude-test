import { Router } from 'express'
import { db } from '../db/index.js'
import { ok } from '../middleware/response.js'
import { sql, SQL } from 'drizzle-orm'

export const runsRouter = Router()

// GET /api/runs — aggregate all agent runs across all agents
// Query params: ?agentId=, ?status=, ?from=, ?to=, ?limit=, ?offset=
runsRouter.get('/', async (req, res) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? '20', 10), 100)
  const offset = parseInt((req.query.offset as string) ?? '0', 10)
  const agentId = req.query.agentId as string | undefined
  const status = req.query.status as string | undefined
  const from = req.query.from as string | undefined
  const to = req.query.to as string | undefined

  // Build WHERE clause using parameterized sql tagged template (safe from injection)
  const conditions: SQL[] = []
  if (agentId) conditions.push(sql`r.agent_id = ${agentId}`)
  if (status) conditions.push(sql`r.status = ${status}`)
  if (from) conditions.push(sql`r.started_at >= ${from}`)
  if (to) conditions.push(sql`r.started_at <= ${to}`)

  const whereClause =
    conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``

  const rows = await db.all(sql`
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
    ${whereClause}
    ORDER BY r.started_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `)

  const [{ total }] = (await db.all(sql`
    SELECT COUNT(*) as total
    FROM agent_runs r
    ${whereClause}
  `)) as [{ total: number }]

  ok(res, rows, { total, limit, offset, hasMore: offset + limit < total })
})
