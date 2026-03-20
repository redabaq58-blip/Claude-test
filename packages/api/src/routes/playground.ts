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
// Ephemeral (no DB writes) Claude call streamed as SSE.
// Body: {
//   userMessage?: string,         // single-turn shorthand
//   messages?: Array<{role:'user'|'assistant', content:string}>,  // multi-turn
//   model?: string,
//   systemPrompt?: string,
//   temperature?: number,
//   thinkingEnabled?: boolean,
//   thinkingBudget?: number,
// }
// Events: data: { type: "text", text: "..." }
//         data: { type: "thinking", thinking: "..." }
//         data: { type: "done", usage: { inputTokens, outputTokens, costUsd, durationMs, model } }
//         data: { type: "error", error: "..." }

playgroundRouter.post('/stream', async (req: Request, res: Response) => {
  const {
    userMessage,
    messages: rawMessages,
    model: rawModel,
    systemPrompt,
    temperature,
    thinkingEnabled,
    thinkingBudget,
  } = req.body

  // Build messages array
  const msgs: Array<{ role: 'user' | 'assistant'; content: string }> =
    rawMessages?.length
      ? rawMessages
      : userMessage
        ? [{ role: 'user' as const, content: userMessage }]
        : []

  if (!msgs.length) {
    res.status(400).json({ data: null, error: 'userMessage or messages must be provided' })
    return
  }

  const MAX_BYTES = 100_000
  const lastUserMsg = msgs.filter((m) => m.role === 'user').at(-1)?.content ?? ''
  if (Buffer.byteLength(lastUserMsg, 'utf8') > MAX_BYTES) {
    res.status(400).json({ data: null, error: `message too large (max ${MAX_BYTES / 1000} KB)` })
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
    // Build RunOptions
    const runOptions: Record<string, unknown> = {
      model: model as ClaudeModel,
      systemPrompt: systemPrompt ?? '',
      maxTokens: 8192,
    }

    if (temperature !== undefined && typeof temperature === 'number') {
      runOptions.temperature = temperature
    }

    if (thinkingEnabled) {
      runOptions.thinking = {
        type: 'enabled' as const,
        budget_tokens: typeof thinkingBudget === 'number' ? thinkingBudget : 8000,
      }
      // Thinking requires temperature=1
      runOptions.temperature = 1
    }

    const stream = client.stream(msgs, runOptions as Parameters<typeof client.stream>[1])

    for await (const chunk of stream) {
      if (chunk.type === 'thinking' && chunk.thinking) {
        res.write(`data: ${JSON.stringify({ type: 'thinking', thinking: chunk.thinking })}\n\n`)
      } else if (chunk.type === 'text' && chunk.text) {
        fullText += chunk.text
        res.write(`data: ${JSON.stringify({ type: 'text', text: chunk.text })}\n\n`)
      }
      if (chunk.type === 'done') break
    }

    const durationMs = Date.now() - startedAt
    const totalInput = msgs.reduce((acc, m) => acc + m.content.length, 0)
    const inputTokens = Math.ceil(totalInput / 4)
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
