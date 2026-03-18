/**
 * /api/studio — Forge Studio API
 *
 * Backend for the visual Forge Studio canvas.
 * Stores flow definitions, generates forge() code, deploys flows as API endpoints.
 */

import { Router } from 'express'
import { db, schema } from '../db/index.js'
import { eq, desc } from 'drizzle-orm'
import { ok, fail } from '../middleware/response.js'
import { forge, ROLE_LIBRARY } from '@claudeforge/agents'
import type { ForgeAgent, ForgeOptions } from '@claudeforge/agents'

export const studioRouter = Router()

// ─── Canvas Types ─────────────────────────────────────────────────────────────

interface StudioNode {
  id: string
  type: 'start' | 'agent' | 'human_checkpoint' | 'condition' | 'output'
  position: { x: number; y: number }
  data: {
    // For 'agent' nodes:
    role?: string
    goal?: string
    backstory?: string
    model?: string
    tools?: string[]     // MCP server names
    roleKey?: string     // Key from ROLE_LIBRARY if using a preset
    // For 'condition' nodes:
    condition?: string   // JS expression
    // For 'human_checkpoint' nodes:
    prompt?: string      // What to show the human
    outputVar?: string   // Variable name to store human response
    // For 'start' nodes:
    variables?: string[] // Input variable names
    // For 'output' nodes:
    outputKey?: string   // Which state key to return as final output
    label?: string
  }
}

interface StudioEdge {
  id: string
  source: string
  target: string
  label?: string    // Optional condition label (for condition nodes: 'true' | 'false')
}

interface StudioDefinition {
  nodes: StudioNode[]
  edges: StudioEdge[]
  variables: string[]  // All input variable names declared in Start nodes
}

// ─── GET /api/studio/flows ────────────────────────────────────────────────────

studioRouter.get('/flows', async (_req, res) => {
  try {
    const flows = await db.select({
      id: schema.studioFlows.id,
      name: schema.studioFlows.name,
      description: schema.studioFlows.description,
      isDeployed: schema.studioFlows.isDeployed,
      runCount: schema.studioFlows.runCount,
      lastRunAt: schema.studioFlows.lastRunAt,
      createdAt: schema.studioFlows.createdAt,
      updatedAt: schema.studioFlows.updatedAt,
    })
      .from(schema.studioFlows)
      .orderBy(desc(schema.studioFlows.updatedAt))
      .limit(100)

    ok(res, flows)
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to list flows', 500)
  }
})

// ─── GET /api/studio/flows/:id ────────────────────────────────────────────────

studioRouter.get('/flows/:id', async (req, res) => {
  try {
    const [flow] = await db.select()
      .from(schema.studioFlows)
      .where(eq(schema.studioFlows.id, req.params.id))
      .limit(1)

    if (!flow) return fail(res, 'Flow not found', 404)

    ok(res, {
      ...flow,
      definition: JSON.parse(flow.definition ?? '{}'),
    })
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to get flow', 500)
  }
})

// ─── POST /api/studio/flows ───────────────────────────────────────────────────
// Save a new flow definition.

studioRouter.post('/flows', async (req, res) => {
  const { name, description, definition } = req.body as {
    name: string
    description?: string
    definition: StudioDefinition
  }

  if (!name) return fail(res, 'name is required')
  if (!definition || !Array.isArray(definition.nodes)) {
    return fail(res, 'definition must contain a nodes array')
  }

  const id = crypto.randomUUID()
  const generatedCode = generateForgeCode(name, definition)

  try {
    await db.insert(schema.studioFlows).values({
      id,
      name,
      description: description ?? '',
      definition: JSON.stringify(definition),
      generatedCode,
      isDeployed: false,
    })

    ok(res, { id, name, generatedCode })
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to save flow', 500)
  }
})

// ─── PUT /api/studio/flows/:id ────────────────────────────────────────────────

studioRouter.put('/flows/:id', async (req, res) => {
  const { name, description, definition } = req.body as {
    name?: string
    description?: string
    definition?: StudioDefinition
  }

  try {
    type FlowUpdate = Parameters<(typeof db.update<typeof schema.studioFlows>)>[0] extends infer T ? Partial<{ name: string; description: string; definition: string; generatedCode: string; updatedAt: string }> : never

    const updates: { name?: string; description?: string; definition?: string; generatedCode?: string; updatedAt: string } = {
      updatedAt: new Date().toISOString(),
    }
    if (name) updates.name = name
    if (description !== undefined) updates.description = description
    if (definition) {
      updates.definition = JSON.stringify(definition)
      updates.generatedCode = generateForgeCode(name ?? 'flow', definition)
    }

    await db.update(schema.studioFlows)
      .set(updates)
      .where(eq(schema.studioFlows.id, req.params.id))

    ok(res, { updated: true })
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to update flow', 500)
  }
})

// ─── DELETE /api/studio/flows/:id ────────────────────────────────────────────

studioRouter.delete('/flows/:id', async (req, res) => {
  try {
    await db.delete(schema.studioFlows).where(eq(schema.studioFlows.id, req.params.id))
    ok(res, { deleted: true })
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to delete flow', 500)
  }
})

// ─── POST /api/studio/flows/:id/deploy ───────────────────────────────────────
// Mark a flow as deployed (enables the /run endpoint).

studioRouter.post('/flows/:id/deploy', async (req, res) => {
  try {
    const [flow] = await db.select().from(schema.studioFlows)
      .where(eq(schema.studioFlows.id, req.params.id)).limit(1)
    if (!flow) return fail(res, 'Flow not found', 404)

    await db.update(schema.studioFlows)
      .set({ isDeployed: true, deployedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(schema.studioFlows.id, req.params.id))

    ok(res, {
      deployed: true,
      endpoint: `/api/studio/flows/${req.params.id}/run`,
      curlExample: `curl -X POST https://your-api/api/studio/flows/${req.params.id}/run -H "Content-Type: application/json" -d '{"inputs": {"topic": "AI in 2025"}}'`,
    })
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to deploy', 500)
  }
})

// ─── POST /api/studio/flows/:id/run ──────────────────────────────────────────
// Execute a deployed flow with user-provided inputs.

studioRouter.post('/flows/:id/run', async (req, res) => {
  const { inputs = {}, hitl = false } = req.body as { inputs?: Record<string, string>; hitl?: boolean }

  try {
    const [flow] = await db.select().from(schema.studioFlows)
      .where(eq(schema.studioFlows.id, req.params.id)).limit(1)
    if (!flow) return fail(res, 'Flow not found', 404)
    if (!flow.isDeployed) return fail(res, 'Flow is not deployed. Call /deploy first.')

    const definition = JSON.parse(flow.definition ?? '{}') as StudioDefinition
    const { agents, goal } = definitionToForgeArgs(definition, inputs)

    const runId = crypto.randomUUID()

    // Insert studio run record
    await db.insert(schema.studioRuns).values({
      id: runId,
      flowId: flow.id,
      inputs: JSON.stringify(inputs),
      status: 'running',
    })

    ok(res, { runId, status: 'running' })

    // Execute in background
    const startTime = Date.now()
    forge(agents, goal, { inputs, hitl, persist: true })
      .then(async (result) => {
        await db.update(schema.studioRuns)
          .set({
            status: result.status,
            output: result.output,
            costUsd: result.costUsd,
            durationMs: Date.now() - startTime,
            threadId: result.threadId,
            completedAt: new Date().toISOString(),
          })
          .where(eq(schema.studioRuns.id, runId))

        // Update flow stats
        await db.update(schema.studioFlows)
          .set({
            runCount: (flow.runCount ?? 0) + 1,
            lastRunAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.studioFlows.id, flow.id))
      })
      .catch(async (err) => {
        await db.update(schema.studioRuns)
          .set({ status: 'failed', error: err instanceof Error ? err.message : String(err), completedAt: new Date().toISOString() })
          .where(eq(schema.studioRuns.id, runId))
        console.error('[studio] run failed:', err)
      })
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to start run', 500)
  }
})

// ─── GET /api/studio/flows/:id/runs ──────────────────────────────────────────

studioRouter.get('/flows/:id/runs', async (req, res) => {
  try {
    const runs = await db.select()
      .from(schema.studioRuns)
      .where(eq(schema.studioRuns.flowId, req.params.id))
      .orderBy(desc(schema.studioRuns.createdAt))
      .limit(20)

    ok(res, runs.map(r => ({ ...r, inputs: JSON.parse(r.inputs ?? '{}') })))
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to list runs', 500)
  }
})

// ─── GET /api/studio/flows/:id/code ──────────────────────────────────────────
// Generate the TypeScript forge() code equivalent of this flow.

studioRouter.get('/flows/:id/code', async (req, res) => {
  try {
    const [flow] = await db.select().from(schema.studioFlows)
      .where(eq(schema.studioFlows.id, req.params.id)).limit(1)
    if (!flow) return fail(res, 'Flow not found', 404)

    const definition = JSON.parse(flow.definition ?? '{}') as StudioDefinition
    const code = generateForgeCode(flow.name, definition)

    ok(res, { code })
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to generate code', 500)
  }
})

// ─── GET /api/studio/run/:runId ───────────────────────────────────────────────

studioRouter.get('/run/:runId', async (req, res) => {
  try {
    const [run] = await db.select().from(schema.studioRuns)
      .where(eq(schema.studioRuns.id, req.params.runId)).limit(1)
    if (!run) return fail(res, 'Run not found', 404)

    ok(res, { ...run, inputs: JSON.parse(run.inputs ?? '{}') })
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to get run', 500)
  }
})

// ─── GET /api/studio/roles ────────────────────────────────────────────────────
// Return the Role Library for the canvas sidebar.

studioRouter.get('/roles', (_req, res) => {
  ok(res, Object.entries(ROLE_LIBRARY).map(([key, agent]) => ({
    key,
    ...agent,
    // Strip tools — those are added by the canvas via MCP server selection
  })))
})

// ─── POST /api/studio/flows/:id/stream ───────────────────────────────────────
// Run a flow with SSE streaming output (for the Studio preview panel).

studioRouter.post('/flows/:id/stream', async (req, res) => {
  const { inputs = {}, hitl = false } = req.body as { inputs?: Record<string, string>; hitl?: boolean }

  try {
    const [flow] = await db.select().from(schema.studioFlows)
      .where(eq(schema.studioFlows.id, req.params.id)).limit(1)
    if (!flow) return fail(res, 'Flow not found', 404)

    const definition = JSON.parse(flow.definition ?? '{}') as StudioDefinition
    const { agents, goal } = definitionToForgeArgs(definition, inputs)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    try {
      const result = await forge(agents, goal, {
        inputs,
        hitl,
        persist: true,
        onProgress: (event) => send(event.type, event),
      })
      send('complete', result)
    } catch (err) {
      send('error', { message: err instanceof Error ? err.message : String(err) })
    } finally {
      res.end()
    }
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to stream', 500)
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a StudioDefinition canvas into forge() arguments.
 * Walks the node graph in topological order (respecting edge connections).
 */
function definitionToForgeArgs(
  definition: StudioDefinition,
  inputs: Record<string, string>
): { agents: ForgeAgent[]; goal: string } {
  const { nodes, edges } = definition
  const agents: ForgeAgent[] = []
  let goal = 'Complete the workflow objective'

  // Find start node for goal
  const startNode = nodes.find(n => n.type === 'start')
  if (startNode?.data.label) goal = startNode.data.label

  // Topologically sort nodes following edges
  const visited = new Set<string>()
  const sorted: StudioNode[] = []

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    const outgoing = edges.filter(e => e.source === nodeId)
    for (const edge of outgoing) {
      visit(edge.target)
    }
    sorted.unshift(nodes.find(n => n.id === nodeId)!)
  }

  if (startNode) {
    visit(startNode.id)
  } else {
    sorted.push(...nodes)
  }

  for (const node of sorted) {
    if (!node || node.type === 'start' || node.type === 'output') continue

    if (node.type === 'agent') {
      const rolePreset = node.data.roleKey ? ROLE_LIBRARY[node.data.roleKey] : undefined
      agents.push({
        role: node.data.role ?? rolePreset?.role ?? 'Agent',
        goal: node.data.goal ?? rolePreset?.goal,
        backstory: node.data.backstory ?? rolePreset?.backstory,
        model: (node.data.model as ForgeAgent['model']) ?? rolePreset?.model ?? 'auto',
        as: `$${(node.data.role ?? node.id).toLowerCase().replace(/\s+/g, '_')}`,
      })
    }

    if (node.type === 'human_checkpoint') {
      // Human checkpoint becomes hitl=true on the previous agent's goto
      // We represent it as a special agent that just captures input
      agents.push({
        role: 'Human Reviewer',
        goal: node.data.prompt ?? 'Review the work so far and provide feedback',
        as: '$human_review',
      })
    }

    if (node.type === 'condition') {
      // Conditions modify the `when` field of subsequent agents
      const outgoingTrue = edges.find(e => e.source === node.id && e.label === 'true')
      const outgoingFalse = edges.find(e => e.source === node.id && e.label === 'false')

      const trueNode = nodes.find(n => n.id === outgoingTrue?.target)
      const falseNode = nodes.find(n => n.id === outgoingFalse?.target)

      if (trueNode?.type === 'agent') {
        const lastAdded = agents[agents.length - 1]
        if (lastAdded) lastAdded.when = node.data.condition
      }
      if (falseNode?.type === 'agent') {
        agents.push({
          role: falseNode.data.role ?? 'Agent',
          goal: falseNode.data.goal,
          when: `!(${node.data.condition})`,
          as: `$${(falseNode.data.role ?? falseNode.id).toLowerCase().replace(/\s+/g, '_')}`,
        })
      }
    }
  }

  return { agents, goal }
}

/**
 * Generate TypeScript forge() code from a canvas definition.
 * This is what the "View Code" button shows in Forge Studio.
 */
function generateForgeCode(flowName: string, definition: StudioDefinition): string {
  const { agents: forgeAgents, goal } = definitionToForgeArgs(definition, {})

  const agentLines = forgeAgents.map(a => {
    const parts: string[] = [`  { role: '${a.role}'`]
    if (a.goal) parts[0] += `,\n    goal: '${a.goal.replace(/'/g, "\\'")}'`
    if (a.backstory) parts[0] += `,\n    backstory: '${a.backstory.slice(0, 80).replace(/'/g, "\\'")}...'`
    if (a.model && a.model !== 'auto') parts[0] += `,\n    model: '${a.model}'`
    if (a.when) parts[0] += `,\n    when: '${a.when}'`
    if (a.goto) parts[0] += `,\n    goto: '${a.goto}'`
    if (a.as) parts[0] += `,\n    as: '${a.as}'`
    parts[0] += ' }'
    return parts[0]
  })

  const variables = definition.variables ?? []
  const inputsComment = variables.length > 0
    ? `// Required inputs: ${variables.map(v => `{ ${v}: '...' }`).join(', ')}\n`
    : ''

  return `import { forge } from '@claudeforge/agents'

${inputsComment}const result = await forge(
  [
${agentLines.join(',\n')}
  ],
  '${goal.replace(/'/g, "\\'")}',
  {
    inputs: { ${variables.map(v => `${v}: 'your value here'`).join(', ')} },
    persist: true,   // checkpoint state after each agent
    hitl: false,     // set true to pause for human review between agents
  }
)

console.log(result.output)     // final answer
console.log(result.costUsd)    // total cost in USD
console.log(result.threadId)   // use to resume if interrupted
`
}
