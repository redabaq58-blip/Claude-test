import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { eq, desc } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ok, fail } from '../middleware/response.js'
import { ClaudeAgent } from '@claudeforge/agents'

export const workflowsRouter = Router()

// GET /api/workflows
workflowsRouter.get('/', async (_req, res) => {
  const rows = await db.select().from(schema.workflows).orderBy(desc(schema.workflows.createdAt))
  ok(res, rows)
})

// GET /api/workflows/:id
workflowsRouter.get('/:id', async (req, res) => {
  const [workflow] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, req.params.id))
  if (!workflow) return fail(res, 'Workflow not found', 404)
  ok(res, workflow)
})

// POST /api/workflows
workflowsRouter.post('/', async (req, res) => {
  const { name, description, steps } = req.body
  if (!name) return fail(res, 'name is required')
  if (!steps || !Array.isArray(steps)) return fail(res, 'steps must be an array')

  const workflow = {
    id: uuidv4(),
    name,
    description: description ?? '',
    steps: JSON.stringify(steps),
  }

  await db.insert(schema.workflows).values(workflow)
  const [created] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, workflow.id))
  ok(res, created)
})

// PUT /api/workflows/:id
workflowsRouter.put('/:id', async (req, res) => {
  const [existing] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, req.params.id))
  if (!existing) return fail(res, 'Workflow not found', 404)

  const { name, description, steps, isActive } = req.body
  await db
    .update(schema.workflows)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(steps !== undefined && { steps: JSON.stringify(steps) }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.workflows.id, req.params.id))

  const [updated] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, req.params.id))
  ok(res, updated)
})

// DELETE /api/workflows/:id
workflowsRouter.delete('/:id', async (req, res) => {
  const [existing] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, req.params.id))
  if (!existing) return fail(res, 'Workflow not found', 404)
  await db.delete(schema.workflows).where(eq(schema.workflows.id, req.params.id))
  ok(res, { deleted: true, id: req.params.id })
})

// POST /api/workflows/:id/run — execute workflow
workflowsRouter.post('/:id/run', async (req, res) => {
  const [workflowRow] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, req.params.id))
  if (!workflowRow) return fail(res, 'Workflow not found', 404)

  const { context = {} } = req.body
  const steps = JSON.parse(workflowRow.steps ?? '[]') as Array<{
    agentId: string
    inputTemplate: string
    outputKey?: string
  }>

  const runId = uuidv4()
  await db.insert(schema.workflowRuns).values({
    id: runId,
    workflowId: workflowRow.id,
    status: 'running',
    context: JSON.stringify(context),
  })

  const stepResults: Array<{ step: number; agentId: string; output: string; success: boolean }> = []
  let runContext = { ...context }

  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const [agentRow] = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.id, step.agentId))

      if (!agentRow) {
        throw new Error(`Workflow step ${i + 1}: Agent "${step.agentId}" not found`)
      }

      // Interpolate input template with current context
      let input = step.inputTemplate
      for (const [key, value] of Object.entries(runContext)) {
        input = input.replace(`{{${key}}}`, String(value))
      }

      const agent = new ClaudeAgent({
        name: agentRow.name,
        model: agentRow.model as 'auto',
        systemPrompt: agentRow.systemPrompt ?? '',
        logUsage: false,
      })

      const result = await agent.run(input)
      stepResults.push({
        step: i + 1,
        agentId: step.agentId,
        output: result.output,
        success: result.success,
      })

      // Store output in context for next steps
      if (step.outputKey) {
        runContext[step.outputKey] = result.output
      }
    }

    await db
      .update(schema.workflowRuns)
      .set({
        status: 'completed',
        stepResults: JSON.stringify(stepResults),
        completedAt: new Date().toISOString(),
      })
      .where(eq(schema.workflowRuns.id, runId))

    const [run] = await db.select().from(schema.workflowRuns).where(eq(schema.workflowRuns.id, runId))
    ok(res, run)
  } catch (err) {
    await db
      .update(schema.workflowRuns)
      .set({
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        stepResults: JSON.stringify(stepResults),
        completedAt: new Date().toISOString(),
      })
      .where(eq(schema.workflowRuns.id, runId))

    fail(res, err instanceof Error ? err.message : 'Workflow execution failed', 500)
  }
})
