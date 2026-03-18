import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { eq, desc } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ok, fail } from '../middleware/response.js'
import { ClaudeAgent } from '@claudeforge/agents'
import { MCPRegistry } from '@claudeforge/mcp'
import { ClaudeClient, calculateCost } from '@claudeforge/core'
import type { ClaudeModel } from '@claudeforge/core'

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
  const { name, description, model, systemPrompt, maxTokens, temperature, cacheEnabled, thinkingEnabled, thinkingBudget } = req.body
  if (!name) return fail(res, 'name is required')

  const agent = {
    id: uuidv4(),
    name,
    description: description ?? '',
    model: model ?? 'auto',
    systemPrompt: systemPrompt ?? '',
    maxTokens: maxTokens ?? 8192,
    temperature: temperature ?? 1.0,
    cacheEnabled: cacheEnabled ?? false,
    thinkingEnabled: thinkingEnabled ?? false,
    thinkingBudget: thinkingBudget ?? 8000,
  }

  await db.insert(schema.agents).values(agent)
  const [created] = await db.select().from(schema.agents).where(eq(schema.agents.id, agent.id))
  ok(res, created)
})

// PUT /api/agents/:id — update agent
agentsRouter.put('/:id', async (req, res) => {
  const [existing] = await db.select().from(schema.agents).where(eq(schema.agents.id, req.params.id))
  if (!existing) return fail(res, 'Agent not found', 404)

  const { name, description, model, systemPrompt, maxTokens, temperature, isActive, cacheEnabled, thinkingEnabled, thinkingBudget } = req.body
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
      ...(cacheEnabled !== undefined && { cacheEnabled }),
      ...(thinkingEnabled !== undefined && { thinkingEnabled }),
      ...(thinkingBudget !== undefined && { thinkingBudget }),
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

// POST /api/agents/:id/estimate — pre-flight token count + cost estimate
agentsRouter.post('/:id/estimate', async (req, res) => {
  const [agentRow] = await db.select().from(schema.agents).where(eq(schema.agents.id, req.params.id))
  if (!agentRow) return fail(res, 'Agent not found', 404)

  const { input } = req.body
  if (!input || typeof input !== 'string') return fail(res, 'input is required')

  try {
    const client = new ClaudeClient()
    const model = (agentRow.model ?? 'auto') as ClaudeModel | 'auto'
    const messages = [{ role: 'user' as const, content: input }]
    const inputTokens = await client.countTokens(messages, {
      model,
      systemPrompt: agentRow.systemPrompt ?? '',
    })
    const estimatedCostUsd = calculateCost(model === 'auto' ? 'claude-sonnet-4-6' : model, inputTokens, 0)
    const budgetUsd = parseFloat(process.env.COST_LIMIT_PER_RUN ?? '1.0')
    ok(res, { inputTokens, estimatedCostUsd, withinBudget: estimatedCostUsd <= budgetUsd })
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Estimation failed', 500)
  }
})

// POST /api/agents/:id/run — run agent with input
agentsRouter.post('/:id/run', async (req, res) => {
  const [agentRow] = await db.select().from(schema.agents).where(eq(schema.agents.id, req.params.id))
  if (!agentRow) return fail(res, 'Agent not found', 404)

  const { input } = req.body
  if (!input || typeof input !== 'string' || !input.trim()) {
    return fail(res, 'input must be a non-empty string')
  }
  const MAX_INPUT_BYTES = 100_000
  if (Buffer.byteLength(input, 'utf8') > MAX_INPUT_BYTES) {
    return fail(res, `input too large (max ${MAX_INPUT_BYTES / 1000} KB)`)
  }

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
      model: (agentRow.model ?? 'auto') as ClaudeModel | 'auto',
      systemPrompt: agentRow.systemPrompt ?? '',
      tools,
      maxTokens: agentRow.maxTokens ?? 8192,
      logUsage: false,
      cacheSystemPrompt: agentRow.cacheEnabled ?? false,
      thinkingEnabled: agentRow.thinkingEnabled ?? false,
      thinkingBudget: agentRow.thinkingBudget ?? 8000,
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
        thinkingContent: result.thinkingContent ?? null,
        cacheReadTokens: result.usage.cacheReadTokens ?? 0,
        cacheCreationTokens: result.usage.cacheCreationTokens ?? 0,
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
      cacheReadTokens: result.usage.cacheReadTokens ?? 0,
      cacheCreationTokens: result.usage.cacheCreationTokens ?? 0,
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

// POST /api/agents/:id/clone — duplicate agent with new id and fresh timestamps
agentsRouter.post('/:id/clone', async (req, res) => {
  const [original] = await db.select().from(schema.agents).where(eq(schema.agents.id, req.params.id))
  if (!original) return fail(res, 'Agent not found', 404)

  const now = new Date().toISOString()
  const cloned = {
    id: uuidv4(),
    name: `Copy of ${original.name}`,
    description: original.description,
    model: original.model,
    systemPrompt: original.systemPrompt,
    tools: original.tools,
    mcpServers: original.mcpServers,
    skillIds: original.skillIds,
    hookConfig: original.hookConfig,
    maxTokens: original.maxTokens,
    temperature: original.temperature,
    isActive: original.isActive,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(schema.agents).values(cloned)
  const [created] = await db.select().from(schema.agents).where(eq(schema.agents.id, cloned.id))
  ok(res, created)
})

// GET /api/agents/:id/export — export agent as JSON (full config including tools)
agentsRouter.get('/:id/export', async (req, res) => {
  const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, req.params.id))
  if (!agent) return fail(res, 'Agent not found', 404)

  const exportData = {
    claudeforge_version: '1.0',
    exported_at: new Date().toISOString(),
    agent: {
      name: agent.name,
      description: agent.description,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      maxTokens: agent.maxTokens,
      temperature: agent.temperature,
        tools: (() => { try { return JSON.parse(agent.tools ?? '[]') } catch { return [] } })(),
      mcpServers: (() => { try { return JSON.parse(agent.mcpServers ?? '[]') } catch { return [] } })(),
      skillIds: (() => { try { return JSON.parse(agent.skillIds ?? '[]') } catch { return [] } })(),
      hookConfig: (() => { try { return JSON.parse(agent.hookConfig ?? '{}') } catch { return {} } })(),
    },
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="${agent.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-agent.json"`)
  res.send(JSON.stringify(exportData, null, 2))
})

// POST /api/agents/import — import agent from JSON export file
agentsRouter.post('/import', async (req, res) => {
  const { claudeforge_version, agent: agentData } = req.body
  if (!claudeforge_version || !agentData?.name) {
    return fail(res, 'Invalid export file format. Expected claudeforge_version and agent fields.')
  }

  const newAgent = {
    id: uuidv4(),
    name: agentData.name,
    description: agentData.description ?? '',
    model: agentData.model ?? 'auto',
    systemPrompt: agentData.systemPrompt ?? '',
    maxTokens: agentData.maxTokens ?? 8192,
    temperature: agentData.temperature ?? 1.0,
    tools: Array.isArray(agentData.tools) ? JSON.stringify(agentData.tools) : '[]',
    mcpServers: Array.isArray(agentData.mcpServers) ? JSON.stringify(agentData.mcpServers) : '[]',
    skillIds: Array.isArray(agentData.skillIds) ? JSON.stringify(agentData.skillIds) : '[]',
    hookConfig: agentData.hookConfig && typeof agentData.hookConfig === 'object'
      ? JSON.stringify(agentData.hookConfig)
      : '{}',
  }

  await db.insert(schema.agents).values(newAgent)
  const [created] = await db.select().from(schema.agents).where(eq(schema.agents.id, newAgent.id))
  ok(res, created)
})

// GET /api/agents/:id/runs — get run history for an agent (paginated)
agentsRouter.get('/:id/runs', async (req, res) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? '20', 10), 100)
  const offset = parseInt((req.query.offset as string) ?? '0', 10)
  const runs = await db
    .select()
    .from(schema.agentRuns)
    .where(eq(schema.agentRuns.agentId, req.params.id))
    .orderBy(desc(schema.agentRuns.startedAt))
    .limit(limit)
    .offset(offset)
  ok(res, runs, { limit, offset })
})
