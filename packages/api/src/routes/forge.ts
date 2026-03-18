/**
 * /api/forge — forge() execution API
 *
 * Runs the forge() universal agent executor via HTTP.
 * Supports async execution, thread management, HITL resume, and SSE streaming.
 */

import { Router } from 'express'
import { forge, ROLE_LIBRARY, getForgeCheckpoint, listForgeThreads, deleteForgeThread } from '@claudeforge/agents'
import type { ForgeAgent, ForgeOptions, ForgeEvent } from '@claudeforge/agents'
import { db, schema } from '../db/index.js'
import { eq, desc } from 'drizzle-orm'
import { ok, fail } from '../middleware/response.js'

export const forgeRouter = Router()

// ─── POST /api/forge/run ──────────────────────────────────────────────────────
// Start a new forge() run. Returns immediately with the threadId.
// Poll GET /api/forge/threads/:threadId for status, or use SSE endpoint.

forgeRouter.post('/run', async (req, res) => {
  const { agents, goal, options = {} } = req.body as {
    agents: ForgeAgent[]
    goal: string
    options?: ForgeOptions
  }

  if (!agents || !Array.isArray(agents) || agents.length === 0) {
    return fail(res, 'agents must be a non-empty array of ForgeAgent objects')
  }
  if (!goal || typeof goal !== 'string') {
    return fail(res, 'goal must be a non-empty string')
  }

  const threadId = crypto.randomUUID()

  // Insert pending record immediately so clients can poll
  try {
    await db.insert(schema.forgeRuns).values({
      id: threadId,
      goal,
      agents: JSON.stringify(agents),
      options: JSON.stringify(options),
      state: JSON.stringify({ inputs: options.inputs ?? {}, outputs: {}, history: [] }),
      steps: JSON.stringify([]),
      currentStep: 0,
      status: 'running',
      output: '',
      costUsd: 0,
      durationMs: 0,
    })
  } catch {
    // DB insert failure is non-fatal — continue in-memory
  }

  ok(res, { threadId, status: 'running' })

  // Execute in background (fire-and-forget)
  const startTime = Date.now()
  forge(agents, goal, {
    ...options,
    threadId: undefined, // fresh run
    persist: true,
    onProgress: async (event: ForgeEvent) => {
      // Update DB status on key events
      if (event.type === 'interrupted' || event.type === 'complete') {
        try {
          await db.update(schema.forgeRuns)
            .set({
              status: event.type === 'complete' ? 'completed' : 'interrupted',
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.forgeRuns.id, threadId))
        } catch { /* non-fatal */ }
      }
    },
  })
    .then(async (result) => {
      try {
        await db.update(schema.forgeRuns)
          .set({
            status: result.status,
            output: result.output,
            steps: JSON.stringify(result.steps),
            costUsd: result.costUsd,
            durationMs: Date.now() - startTime,
            resumePrompt: result.resumePrompt ?? null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.forgeRuns.id, threadId))
      } catch { /* non-fatal */ }
    })
    .catch(async (err) => {
      try {
        await db.update(schema.forgeRuns)
          .set({
            status: 'failed',
            output: '',
            durationMs: Date.now() - startTime,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.forgeRuns.id, threadId))
      } catch { /* non-fatal */ }
      console.error('[forge] run failed:', err)
    })
})

// ─── GET /api/forge/threads ───────────────────────────────────────────────────
// List all forge threads (paginated, most recent first).

forgeRouter.get('/threads', async (_req, res) => {
  try {
    const threads = await db.select({
      id: schema.forgeRuns.id,
      goal: schema.forgeRuns.goal,
      status: schema.forgeRuns.status,
      costUsd: schema.forgeRuns.costUsd,
      durationMs: schema.forgeRuns.durationMs,
      currentStep: schema.forgeRuns.currentStep,
      resumePrompt: schema.forgeRuns.resumePrompt,
      createdAt: schema.forgeRuns.createdAt,
      updatedAt: schema.forgeRuns.updatedAt,
    })
      .from(schema.forgeRuns)
      .orderBy(desc(schema.forgeRuns.createdAt))
      .limit(50)

    ok(res, threads)
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to list threads', 500)
  }
})

// ─── GET /api/forge/threads/:threadId ────────────────────────────────────────
// Get full state of a forge thread, including steps and output.

forgeRouter.get('/threads/:threadId', async (req, res) => {
  const { threadId } = req.params

  try {
    const [row] = await db.select()
      .from(schema.forgeRuns)
      .where(eq(schema.forgeRuns.id, threadId))
      .limit(1)

    if (!row) {
      return fail(res, `Thread '${threadId}' not found`, 404)
    }

    ok(res, {
      threadId: row.id,
      goal: row.goal,
      status: row.status,
      output: row.output,
      resumePrompt: row.resumePrompt,
      steps: JSON.parse(row.steps ?? '[]'),
      costUsd: row.costUsd,
      durationMs: row.durationMs,
      currentStep: row.currentStep,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to get thread', 500)
  }
})

// ─── POST /api/forge/threads/:threadId/resume ─────────────────────────────────
// Resume an interrupted forge thread with a human response.

forgeRouter.post('/threads/:threadId/resume', async (req, res) => {
  const { threadId } = req.params
  const { value } = req.body as { value?: string }

  if (value === undefined) {
    return fail(res, 'value is required — the human response to inject into the run')
  }

  try {
    const [row] = await db.select()
      .from(schema.forgeRuns)
      .where(eq(schema.forgeRuns.id, threadId))
      .limit(1)

    if (!row) {
      return fail(res, `Thread '${threadId}' not found`, 404)
    }
    if (row.status !== 'interrupted') {
      return fail(res, `Thread '${threadId}' is not interrupted (status: ${row.status})`)
    }

    // Mark as running before resuming
    await db.update(schema.forgeRuns)
      .set({ status: 'running', updatedAt: new Date().toISOString() })
      .where(eq(schema.forgeRuns.id, threadId))

    ok(res, { threadId, status: 'running', message: 'Thread resumed' })

    // Resume in background
    const agents = JSON.parse(row.agents ?? '[]') as ForgeAgent[]
    const parsedOptions = JSON.parse(row.options ?? '{}') as ForgeOptions
    const startTime = Date.now()

    forge(agents, row.goal, {
      ...parsedOptions,
      threadId,
      resume: value,
      persist: true,
    })
      .then(async (result) => {
        await db.update(schema.forgeRuns)
          .set({
            status: result.status,
            output: result.output,
            steps: JSON.stringify(result.steps),
            costUsd: result.costUsd,
            durationMs: Date.now() - startTime,
            resumePrompt: result.resumePrompt ?? null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.forgeRuns.id, threadId))
      })
      .catch(async (err) => {
        await db.update(schema.forgeRuns)
          .set({ status: 'failed', updatedAt: new Date().toISOString() })
          .where(eq(schema.forgeRuns.id, threadId))
        console.error('[forge] resume failed:', err)
      })
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to resume thread', 500)
  }
})

// ─── DELETE /api/forge/threads/:threadId ──────────────────────────────────────

forgeRouter.delete('/threads/:threadId', async (req, res) => {
  const { threadId } = req.params
  try {
    await db.delete(schema.forgeRuns).where(eq(schema.forgeRuns.id, threadId))
    deleteForgeThread(threadId)
    ok(res, { deleted: true })
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to delete thread', 500)
  }
})

// ─── GET /api/forge/roles ─────────────────────────────────────────────────────
// Return the Role Library — pre-built agent definitions.

forgeRouter.get('/roles', (_req, res) => {
  ok(res, Object.entries(ROLE_LIBRARY).map(([key, agent]) => ({
    key,
    ...agent,
  })))
})

// ─── POST /api/forge/stream ───────────────────────────────────────────────────
// Execute a forge() run with Server-Sent Events streaming of progress events.

forgeRouter.post('/stream', async (req, res) => {
  const { agents, goal, options = {} } = req.body as {
    agents: ForgeAgent[]
    goal: string
    options?: ForgeOptions
  }

  if (!agents || !Array.isArray(agents) || agents.length === 0) {
    return fail(res, 'agents must be a non-empty array')
  }
  if (!goal) {
    return fail(res, 'goal is required')
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const result = await forge(agents, goal, {
      ...options,
      persist: true,
      onProgress: (event: ForgeEvent) => {
        send(event.type, event)
      },
    })
    send('complete', { ...result, status: result.status })
  } catch (err) {
    send('error', { message: err instanceof Error ? err.message : String(err) })
  } finally {
    res.end()
  }
})
