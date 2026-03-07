import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { eq, desc } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ok, fail } from '../middleware/response.js'
import { ClaudeAgent } from '@claudeforge/agents'
import { MCPRegistry } from '@claudeforge/mcp'

export const agentsRouter = Router()

// GET /api/agents — list all agents
agentsRouter.get('/', async (_req, res) => {
  const rows = await db.select().from(schema.agents).orderBy(desc(schema.agents.createdAt))
  ok(res, rows)
})

// GET /api/agents/:id — get agent by id
agentsRouter.get('/:id', async (req, res) => {
  const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, req.params.id))
  if (!agent) return fail(res, 'Agent not found', 404)
  ok(res, agent)
})

// POST /api/agents — create agent
agentsRouter.post('/', async (req, res) => {
  const { name, description, model, systemPrompt, maxTokens, temperature } = req.body
  if (!name) return fail(res, 'name is required')

  const agent = {
    id: uuidv4(),
    name,
    description: description ?? '',
    model: model ?? 'auto',
    systemPrompt: systemPrompt ?? '',
    maxTokens: maxTokens ?? 8192,
    temperature: temperature ?? 1.0,
  }

  await db.insert(schema.agents).values(agent)
  const [created] = await db.select().from(schema.agents).where(eq(schema.agents.id, agent.id))
  ok(res, created)
})

// PUT /api/agents/:id — update agent
agentsRouter.put('/:id', async (req, res) => {
  const [existing] = await db.select().from(schema.agents).where(eq(schema.agents.id, req.params.id))
  if (!existing) return fail(res, 'Agent not found', 404)

  const { name, description, model, systemPrompt, maxTokens, temperature, isActive } = req.body
  await db
    .update(schema.agents)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(model !== undefined && { model }),
      ...(systemPrompt !== undefined && { systemPrompt }),
      ...(maxTokens !== undefined && { maxTokens }),
      ...(temperature !== undefined && { temperature }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.agents.id, req.params.id))

  const [updated] = await db.select().from(schema.agents).where(eq(schema.agents.id, req.params.id))
  ok(res, updated)
})

// DELETE /api/agents/:id
agentsRouter.delete('/:id', async (req, res) => {
  const [existing] = await db.select().from(schema.agents).where(eq(schema.agents.id, req.params.id))
  if (!existing) return fail(res, 'Agent not found', 404)
  await db.delete(schema.agents).where(eq(schema.agents.id, req.params.id))
  ok(res, { deleted: true, id: req.params.id })
})

// POST /api/agents/:id/run — run agent with input
agentsRouter.post('/:id/run', async (req, res) => {
  const [agentRow] = await db.select().from(schema.agents).where(eq(schema.agents.id, req.params.id))
  if (!agentRow) return fail(res, 'Agent not found', 404)

  const { input } = req.body
  if (!input) return fail(res, 'input is required')

  const runId = uuidv4()
  const startedAt = new Date().toISOString()

  // Insert pending run
  await db.insert(schema.agentRuns).values({
    id: runId,
    agentId: agentRow.id,
    status: 'running',
    input,
    startedAt,
  })

  // Build and execute agent
  try {
    const mcpServers = JSON.parse(agentRow.mcpServers ?? '[]') as string[]
    const registry = MCPRegistry.withDefaults()
    const tools = mcpServers.flatMap((name) => {
      try {
        return registry.getTools(name)
      } catch {
        return []
      }
    })

    const agent = new ClaudeAgent({
      name: agentRow.name,
      description: agentRow.description ?? '',
      model: agentRow.model as 'auto',
      systemPrompt: agentRow.systemPrompt ?? '',
      tools,
      maxTokens: agentRow.maxTokens ?? 8192,
      logUsage: false,
    })

    const result = await agent.run(input)

    // Update run record
    await db
      .update(schema.agentRuns)
      .set({
        status: result.success ? 'completed' : 'failed',
        output: result.output,
        error: result.error,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costUsd: result.usage.costUsd,
        durationMs: result.usage.durationMs,
        model: result.usage.model,
        completedAt: new Date().toISOString(),
      })
      .where(eq(schema.agentRuns.id, runId))

    // Log usage event
    await db.insert(schema.usageEvents).values({
      id: uuidv4(),
      agentRunId: runId,
      model: result.usage.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: result.usage.costUsd,
    })

    const [run] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, runId))
    ok(res, run)
  } catch (err) {
    await db
      .update(schema.agentRuns)
      .set({
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date().toISOString(),
      })
      .where(eq(schema.agentRuns.id, runId))

    fail(res, err instanceof Error ? err.message : 'Agent run failed', 500)
  }
})

// GET /api/agents/:id/runs — get run history for an agent
agentsRouter.get('/:id/runs', async (req, res) => {
  const limit = parseInt(req.query.limit as string ?? '20', 10)
  const runs = await db
    .select()
    .from(schema.agentRuns)
    .where(eq(schema.agentRuns.agentId, req.params.id))
    .orderBy(desc(schema.agentRuns.startedAt))
    .limit(limit)
  ok(res, runs)
})
