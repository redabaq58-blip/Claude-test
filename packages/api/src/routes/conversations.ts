import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { eq, desc } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ok, fail } from '../middleware/response.js'
import { ClaudeClient, resolveModel, calculateCost } from '@claudeforge/core'

export const conversationsRouter = Router()

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  usage?: { inputTokens: number; outputTokens: number; costUsd: number; model: string }
}

// GET /api/conversations — list all conversations (newest first)
conversationsRouter.get('/', async (_req, res) => {
  const rows = await db
    .select()
    .from(schema.conversations)
    .orderBy(desc(schema.conversations.updatedAt))
    .limit(100)
  ok(res, rows)
})

// GET /api/conversations/:id — get single conversation with messages
conversationsRouter.get('/:id', async (req, res) => {
  const [conv] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, req.params.id))
  if (!conv) return fail(res, 'Conversation not found', 404)
  ok(res, { ...conv, messages: JSON.parse(conv.messages ?? '[]') })
})

// POST /api/conversations — create new conversation (and run first message)
conversationsRouter.post('/', async (req, res) => {
  const { agentId, message } = req.body
  if (!agentId) return fail(res, 'agentId is required')
  if (!message) return fail(res, 'message is required')

  const [agentRow] = await db.select().from(schema.agents).where(eq(schema.agents.id, agentId))
  if (!agentRow) return fail(res, 'Agent not found', 404)

  const convId = uuidv4()
  const now = new Date().toISOString()

  // Create first user message
  const userMsg: Message = { id: uuidv4(), role: 'user', content: message, timestamp: now }

  await db.insert(schema.conversations).values({
    id: convId,
    agentId,
    title: message.slice(0, 60) + (message.length > 60 ? '…' : ''),
    messages: JSON.stringify([userMsg]),
    totalCostUsd: 0,
  })

  const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, convId))
  ok(res, { ...conv, messages: [userMsg] })
})

// POST /api/conversations/:id/message — append user message + stream assistant reply
conversationsRouter.post('/:id/message', async (req, res) => {
  const [conv] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, req.params.id))
  if (!conv) return fail(res, 'Conversation not found', 404)

  const [agentRow] = await db.select().from(schema.agents).where(eq(schema.agents.id, conv.agentId))
  if (!agentRow) return fail(res, 'Agent not found', 404)

  const { message } = req.body
  if (!message) return fail(res, 'message is required')

  // Parse existing messages and append user message
  const messages: Message[] = JSON.parse(conv.messages ?? '[]')
  const userMsg: Message = { id: uuidv4(), role: 'user', content: message, timestamp: new Date().toISOString() }
  messages.push(userMsg)

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`)

  try {
    const client = new ClaudeClient()
    const model = resolveModel(agentRow.model as 'auto')

    // Build anthropic-format message history
    const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }))

    let fullText = ''
    // Build context string for token estimation (system + all messages)
    const contextStr = (agentRow.systemPrompt ?? '') + apiMessages.map((m) => m.content).join('')

    for await (const chunk of client.stream(apiMessages, {
      model,
      systemPrompt: agentRow.systemPrompt ?? '',
      maxTokens: agentRow.maxTokens ?? 8192,
    })) {
      if (chunk.type === 'text' && chunk.text) {
        fullText += chunk.text
        send({ type: 'text', text: chunk.text })
      }
    }

    // Estimate token counts (streaming API doesn't return exact usage)
    const inputTokens = Math.ceil(contextStr.length / 4)
    const outputTokens = Math.ceil(fullText.length / 4)
    const costUsd = calculateCost(model, inputTokens, outputTokens)
    const usage = { inputTokens, outputTokens, costUsd, model }

    // Build assistant message
    const assistantMsg: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: fullText,
      timestamp: new Date().toISOString(),
      usage,
    }
    messages.push(assistantMsg)

    // Update conversation in DB
    const newCost = (conv.totalCostUsd ?? 0) + usage.costUsd
    await db
      .update(schema.conversations)
      .set({
        messages: JSON.stringify(messages),
        totalCostUsd: newCost,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.conversations.id, conv.id))

    send({ type: 'done', message: assistantMsg, totalCostUsd: newCost })
    res.end()
  } catch (err) {
    send({ type: 'error', error: err instanceof Error ? err.message : String(err) })
    res.end()
  }
})

// PATCH /api/conversations/:id/title — rename conversation
conversationsRouter.patch('/:id/title', async (req, res) => {
  const { title } = req.body
  if (!title) return fail(res, 'title is required')
  const [existing] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, req.params.id))
  if (!existing) return fail(res, 'Conversation not found', 404)
  await db
    .update(schema.conversations)
    .set({ title, updatedAt: new Date().toISOString() })
    .where(eq(schema.conversations.id, req.params.id))
  ok(res, { id: req.params.id, title })
})

// DELETE /api/conversations/:id — delete conversation
conversationsRouter.delete('/:id', async (req, res) => {
  const [existing] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, req.params.id))
  if (!existing) return fail(res, 'Conversation not found', 404)
  await db.delete(schema.conversations).where(eq(schema.conversations.id, req.params.id))
  ok(res, { deleted: true })
})
