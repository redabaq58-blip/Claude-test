import { Router } from 'express'
import type { Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ClaudeClient } from '@claudeforge/core'
import { MCPRegistry } from '@claudeforge/mcp'
import { v4 as uuidv4 } from 'uuid'
import { calculateCost } from '@claudeforge/core'

export const streamRouter = Router()

// POST /api/agents/:id/stream
// Runs an agent and streams the response as Server-Sent Events (SSE).
// Client receives: data: {"type":"text","text":"..."} chunks
// Followed by:     data: {"type":"done","usage":{...},"runId":"..."}

streamRouter.post('/:id/stream', async (req: Request, res: Response) => {
  const [agentRow] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, req.params.id))

  if (!agentRow) {
    res.status(404).json({ data: null, error: 'Agent not found' })
    return
  }

  const { input } = req.body
  if (!input) {
    res.status(400).json({ data: null, error: 'input is required' })
    return
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  const runId = uuidv4()
  const startedAt = Date.now()

  // Insert pending run record
  await db.insert(schema.agentRuns).values({
    id: runId,
    agentId: agentRow.id,
    status: 'running',
    input,
    startedAt: new Date().toISOString(),
  })

  const client = new ClaudeClient()
  const model = (agentRow.model ?? 'claude-sonnet-4-6') as Parameters<typeof client.stream>[1]['model']

  let fullText = ''
  let inputTokens = 0
  let outputTokens = 0

  try {
    const stream = client.stream(
      [{ role: 'user', content: input }],
      {
        model,
        systemPrompt: agentRow.systemPrompt ?? '',
        maxTokens: agentRow.maxTokens ?? 8192,
      }
    )

    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk.text) {
        fullText += chunk.text
        res.write(`data: ${JSON.stringify({ type: 'text', text: chunk.text })}\n\n`)
      }
      if (chunk.type === 'done') break
    }

    const durationMs = Date.now() - startedAt
    // Rough token estimates (streaming doesn't return exact usage)
    inputTokens = Math.ceil(input.length / 4)
    outputTokens = Math.ceil(fullText.length / 4)
    const costUsd = calculateCost(
      agentRow.model as Parameters<typeof calculateCost>[0],
      inputTokens,
      outputTokens
    )

    // Update run record
    await db
      .update(schema.agentRuns)
      .set({
        status: 'completed',
        output: fullText,
        inputTokens,
        outputTokens,
        costUsd,
        durationMs,
        model: agentRow.model,
        completedAt: new Date().toISOString(),
      })
      .where(eq(schema.agentRuns.id, runId))

    // Log usage
    await db.insert(schema.usageEvents).values({
      id: uuidv4(),
      agentRunId: runId,
      model: agentRow.model ?? 'claude-sonnet-4-6',
      inputTokens,
      outputTokens,
      costUsd,
    })

    // Send final done event
    res.write(
      `data: ${JSON.stringify({
        type: 'done',
        runId,
        usage: { inputTokens, outputTokens, costUsd, durationMs, model: agentRow.model },
      })}\n\n`
    )
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)

    await db
      .update(schema.agentRuns)
      .set({ status: 'failed', error, completedAt: new Date().toISOString() })
      .where(eq(schema.agentRuns.id, runId))

    res.write(`data: ${JSON.stringify({ type: 'error', error })}\n\n`)
  } finally {
    res.end()
  }
})
