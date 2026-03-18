import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { eq, desc } from 'drizzle-orm'
import { createHmac, timingSafeEqual } from 'crypto'
import { db, schema } from '../db/index.js'
import { ok, fail } from '../middleware/response.js'
import { scheduleEngine } from '../services/scheduleEngine.js'

export const schedulesRouter = Router()

// Validate cron expression using node-cron (optional dep)
function validateCron(expression: string): boolean {
  try {
    // Basic field-count validation (5 or 6 fields)
    const parts = expression.trim().split(/\s+/)
    return parts.length >= 5 && parts.length <= 6
  } catch {
    return false
  }
}

// GET /api/schedules — list all schedules
schedulesRouter.get('/', async (_req, res) => {
  const rows = await db.select().from(schema.schedules).orderBy(desc(schema.schedules.createdAt))
  ok(res, rows)
})

// GET /api/schedules/:id — get one schedule
schedulesRouter.get('/:id', async (req, res) => {
  const [row] = await db.select().from(schema.schedules).where(eq(schema.schedules.id, req.params.id))
  if (!row) return fail(res, 'Schedule not found', 404)
  ok(res, row)
})

// POST /api/schedules — create schedule
schedulesRouter.post('/', async (req, res) => {
  const { workflowId, name, type, cronExpression, webhookSecret } = req.body
  if (!workflowId) return fail(res, 'workflowId is required')
  if (!name) return fail(res, 'name is required')
  if (!type || !['cron', 'webhook'].includes(type)) return fail(res, 'type must be cron or webhook')
  if (type === 'cron' && !cronExpression) return fail(res, 'cronExpression is required for cron schedules')
  if (type === 'cron' && !validateCron(cronExpression)) return fail(res, 'Invalid cron expression')

  // Verify workflow exists
  const [workflow] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, workflowId))
  if (!workflow) return fail(res, 'Workflow not found', 404)

  const id = uuidv4()
  await db.insert(schema.schedules).values({
    id,
    workflowId,
    name,
    type,
    cronExpression: cronExpression ?? null,
    webhookSecret: webhookSecret ?? null,
    isActive: true,
  })

  const [created] = await db.select().from(schema.schedules).where(eq(schema.schedules.id, id))

  // Register in the engine if cron
  if (type === 'cron' && cronExpression) {
    await scheduleEngine.register(id, type, cronExpression, workflowId)
  }

  ok(res, created)
})

// PUT /api/schedules/:id — update schedule
schedulesRouter.put('/:id', async (req, res) => {
  const [existing] = await db.select().from(schema.schedules).where(eq(schema.schedules.id, req.params.id))
  if (!existing) return fail(res, 'Schedule not found', 404)

  const { name, cronExpression, webhookSecret, isActive } = req.body

  if (cronExpression && !validateCron(cronExpression)) return fail(res, 'Invalid cron expression')

  await db.update(schema.schedules).set({
    ...(name !== undefined && { name }),
    ...(cronExpression !== undefined && { cronExpression }),
    ...(webhookSecret !== undefined && { webhookSecret }),
    ...(isActive !== undefined && { isActive }),
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.schedules.id, req.params.id))

  const [updated] = await db.select().from(schema.schedules).where(eq(schema.schedules.id, req.params.id))

  // Re-register/unregister in engine
  scheduleEngine.unregister(req.params.id)
  if (updated?.isActive && updated.type === 'cron' && updated.cronExpression) {
    await scheduleEngine.register(req.params.id, updated.type, updated.cronExpression, updated.workflowId)
  }

  ok(res, updated)
})

// DELETE /api/schedules/:id
schedulesRouter.delete('/:id', async (req, res) => {
  const [existing] = await db.select().from(schema.schedules).where(eq(schema.schedules.id, req.params.id))
  if (!existing) return fail(res, 'Schedule not found', 404)

  scheduleEngine.unregister(req.params.id)
  await db.delete(schema.schedules).where(eq(schema.schedules.id, req.params.id))
  ok(res, { deleted: true, id: req.params.id })
})

// POST /api/webhooks/:scheduleId/trigger — webhook trigger
schedulesRouter.post('/webhook/:scheduleId/trigger', async (req, res) => {
  const [schedule] = await db.select().from(schema.schedules).where(eq(schema.schedules.id, req.params.scheduleId))
  if (!schedule) return fail(res, 'Schedule not found', 404)
  if (!schedule.isActive) return fail(res, 'Schedule is not active', 400)
  if (schedule.type !== 'webhook') return fail(res, 'Not a webhook schedule', 400)

  // Validate HMAC signature if webhookSecret is set
  if (schedule.webhookSecret) {
    const signature = req.headers['x-webhook-signature'] as string | undefined
    if (!signature) return fail(res, 'Missing X-Webhook-Signature header', 401)

    const body = JSON.stringify(req.body)
    const expected = createHmac('sha256', schedule.webhookSecret).update(body).digest('hex')
    const expectedBuf = Buffer.from(`sha256=${expected}`)
    const actualBuf = Buffer.from(signature)

    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      return fail(res, 'Invalid webhook signature', 401)
    }
  }

  const context = typeof req.body === 'object' ? req.body as Record<string, unknown> : {}

  // Fire async — respond immediately
  scheduleEngine.fireWorkflow(schedule.id, schedule.workflowId, context).catch((err) => {
    console.error('[Webhook] Workflow fire error:', err)
  })

  ok(res, { triggered: true, scheduleId: schedule.id, workflowId: schedule.workflowId })
})
