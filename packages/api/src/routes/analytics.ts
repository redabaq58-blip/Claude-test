import { Router } from 'express'
import { db } from '../db/index.js'
import { ok } from '../middleware/response.js'
import { sql } from 'drizzle-orm'

export const analyticsRouter = Router()

// GET /api/analytics/usage — token usage over time
analyticsRouter.get('/usage', async (req, res) => {
  const days = parseInt(req.query.days as string ?? '30', 10)

  const rows = await db.all(sql`
    SELECT
      date(created_at) as date,
      model,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(input_tokens + output_tokens) as total_tokens,
      COUNT(*) as request_count
    FROM usage_events
    WHERE created_at >= datetime('now', '-${days} days')
    GROUP BY date(created_at), model
    ORDER BY date DESC
  `)

  ok(res, rows, { days })
})

// GET /api/analytics/costs — cost breakdown
analyticsRouter.get('/costs', async (req, res) => {
  const days = parseInt(req.query.days as string ?? '30', 10)

  const byModel = await db.all(sql`
    SELECT
      model,
      SUM(cost_usd) as total_cost,
      COUNT(*) as request_count,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens
    FROM usage_events
    WHERE created_at >= datetime('now', '-${days} days')
    GROUP BY model
    ORDER BY total_cost DESC
  `)

  const byDay = await db.all(sql`
    SELECT
      date(created_at) as date,
      SUM(cost_usd) as total_cost
    FROM usage_events
    WHERE created_at >= datetime('now', '-${days} days')
    GROUP BY date(created_at)
    ORDER BY date DESC
  `)

  const [totals] = await db.all(sql`
    SELECT
      SUM(cost_usd) as total_cost,
      SUM(input_tokens + output_tokens) as total_tokens,
      COUNT(*) as total_requests
    FROM usage_events
    WHERE created_at >= datetime('now', '-${days} days')
  `) as [{ total_cost: number; total_tokens: number; total_requests: number }]

  ok(res, { byModel, byDay, totals, days })
})

// GET /api/analytics/runs — agent run stats
analyticsRouter.get('/runs', async (req, res) => {
  const days = parseInt(req.query.days as string ?? '30', 10)

  const byStatus = await db.all(sql`
    SELECT
      status,
      COUNT(*) as count
    FROM agent_runs
    WHERE started_at >= datetime('now', '-${days} days')
    GROUP BY status
  `)

  const byAgent = await db.all(sql`
    SELECT
      a.name as agent_name,
      r.agent_id,
      COUNT(*) as run_count,
      SUM(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END) as success_count,
      AVG(r.duration_ms) as avg_duration_ms,
      SUM(r.cost_usd) as total_cost
    FROM agent_runs r
    LEFT JOIN agents a ON r.agent_id = a.id
    WHERE r.started_at >= datetime('now', '-${days} days')
    GROUP BY r.agent_id
    ORDER BY run_count DESC
    LIMIT 10
  `)

  ok(res, { byStatus, byAgent, days })
})
