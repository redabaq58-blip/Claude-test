import { Router } from 'express'
import type { Request, Response } from 'express'
import { ClaudeClient, calculateCost } from '@claudeforge/core'
import type { ClaudeModel } from '@claudeforge/core'

export const playgroundRouter = Router()

const MODEL_MAP: Record<string, string> = {
  auto: 'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001': 'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6': 'claude-sonnet-4-6',
  'claude-opus-4-6': 'claude-opus-4-6',
}

// POST /api/playground/stream
// Ephemeral (no DB writes) single-turn Claude call streamed as SSE.
// Body: { userMessage: string, model?: string, systemPrompt?: string }
// Events: data: { type: "text", text: "..." }
//         data: { type: "done", usage: { inputTokens, outputTokens, costUsd, durationMs, model } }
//         data: { type: "error", error: "..." }

playgroundRouter.post('/stream', async (req: Request, res: Response) => {
  const { userMessage, model: rawModel, systemPrompt } = req.body

  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    res.status(400).json({ data: null, error: 'userMessage must be a non-empty string' })
    return
  }

  const MAX_BYTES = 100_000
  if (Buffer.byteLength(userMessage, 'utf8') > MAX_BYTES) {
    res.status(400).json({ data: null, error: `userMessage too large (max ${MAX_BYTES / 1000} KB)` })
    return
  }

  const model = MODEL_MAP[rawModel ?? 'auto'] ?? 'claude-sonnet-4-6'

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  const corsOrigin = process.env.CORS_ORIGIN ?? (process.env.NODE_ENV === 'production' ? null : '*')
  if (corsOrigin) res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.flushHeaders()

  const startedAt = Date.now()
  const client = new ClaudeClient()
  let fullText = ''

  try {
    const stream = client.stream(
      [{ role: 'user', content: userMessage }],
      {
        model: model as ClaudeModel,
        systemPrompt: systemPrompt ?? '',
        maxTokens: 8192,
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
    const inputTokens = Math.ceil(userMessage.length / 4)
    const outputTokens = Math.ceil(fullText.length / 4)
    const costUsd = calculateCost(model as ClaudeModel, inputTokens, outputTokens)

    res.write(
      `data: ${JSON.stringify({
        type: 'done',
        usage: { inputTokens, outputTokens, costUsd, durationMs, model },
      })}\n\n`
    )
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    res.write(`data: ${JSON.stringify({ type: 'error', error })}\n\n`)
  } finally {
    res.end()
  }
})
