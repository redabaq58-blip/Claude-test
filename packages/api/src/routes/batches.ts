import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { eq, desc } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ok, fail } from '../middleware/response.js'
import { ClaudeClient } from '@claudeforge/core'
import type { BatchRequest, ClaudeModel } from '@claudeforge/core'

export const batchesRouter = Router()

// GET /api/batches — list all batch jobs
batchesRouter.get('/', async (_req, res) => {
  const rows = await db.select().from(schema.batchJobs).orderBy(desc(schema.batchJobs.createdAt))
  ok(res, rows)
})

// GET /api/batches/:id — get batch job
batchesRouter.get('/:id', async (req, res) => {
  const [row] = await db.select().from(schema.batchJobs).where(eq(schema.batchJobs.id, req.params.id))
  if (!row) return fail(res, 'Batch job not found', 404)
  ok(res, row)
})

// GET /api/batches/:id/results — get results for a completed batch
batchesRouter.get('/:id/results', async (req, res) => {
  const [row] = await db.select().from(schema.batchJobs).where(eq(schema.batchJobs.id, req.params.id))
  if (!row) return fail(res, 'Batch job not found', 404)
  if (row.status !== 'ended') return fail(res, 'Batch job not yet complete', 400)

  try {
    const results = row.resultsJson ? JSON.parse(row.resultsJson) : []
    ok(res, results)
  } catch {
    fail(res, 'Failed to parse results', 500)
  }
})

// POST /api/batches — create and submit a batch job
// Body: { agentId?: string, requests: Array<{ customId: string, input: string, systemPrompt?: string }> }
batchesRouter.post('/', async (req, res) => {
  const { agentId, requests } = req.body

  if (!Array.isArray(requests) || requests.length === 0) {
    return fail(res, 'requests must be a non-empty array')
  }
  if (requests.length > 100) {
    return fail(res, 'Maximum 100 requests per batch')
  }

  let agentModel: ClaudeModel | 'auto' = 'auto'
  let agentSystemPrompt: string | undefined

  if (agentId) {
    const [agentRow] = await db.select().from(schema.agents).where(eq(schema.agents.id, agentId))
    if (!agentRow) return fail(res, 'Agent not found', 404)
    agentModel = (agentRow.model ?? 'auto') as ClaudeModel | 'auto'
    agentSystemPrompt = agentRow.systemPrompt ?? undefined
  }

  const batchRequests: BatchRequest[] = requests.map((r: { customId?: string; input: string; systemPrompt?: string }) => ({
    customId: r.customId ?? uuidv4(),
    messages: [{ role: 'user' as const, content: r.input }],
    systemPrompt: r.systemPrompt ?? agentSystemPrompt,
    model: agentModel === 'auto' ? 'claude-sonnet-4-6' : agentModel,
  }))

  try {
    const client = new ClaudeClient()
    const batchResponse = await client.batch(batchRequests)

    const id = uuidv4()
    await db.insert(schema.batchJobs).values({
      id,
      agentId: agentId ?? null,
      anthropicBatchId: batchResponse.batchId,
      status: 'submitted',
      inputCount: requests.length,
    })

    const [created] = await db.select().from(schema.batchJobs).where(eq(schema.batchJobs.id, id))
    ok(res, created)
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Batch submission failed', 500)
  }
})

// DELETE /api/batches/:id/cancel — cancel a batch
batchesRouter.delete('/:id/cancel', async (req, res) => {
  const [row] = await db.select().from(schema.batchJobs).where(eq(schema.batchJobs.id, req.params.id))
  if (!row) return fail(res, 'Batch job not found', 404)
  if (!['submitted', 'processing'].includes(row.status)) {
    return fail(res, 'Batch job cannot be cancelled in current state', 400)
  }

  try {
    // Cancel via Anthropic API
    const client = new ClaudeClient()
    await (client as unknown as { cancelBatch: (id: string) => Promise<void> }).cancelBatch?.(row.anthropicBatchId)
  } catch {
    // Ignore cancel API errors — still update local status
  }

  await db.update(schema.batchJobs)
    .set({ status: 'cancelled', completedAt: new Date().toISOString() })
    .where(eq(schema.batchJobs.id, req.params.id))

  ok(res, { cancelled: true, id: req.params.id })
})

// Internal: poll and update a batch status (called by background poller)
export async function pollBatchStatus(jobId: string): Promise<void> {
  const [job] = await db.select().from(schema.batchJobs).where(eq(schema.batchJobs.id, jobId))
  if (!job || !['submitted', 'processing'].includes(job.status)) return

  try {
    const client = new ClaudeClient()
    const status = await client.getBatch(job.anthropicBatchId)

    if (status.status === 'ended') {
      // Collect results
      const results: Array<{ customId: string; output: string; error?: string; inputTokens: number; outputTokens: number }> = []
      for await (const item of client.getBatchResults(job.anthropicBatchId)) {
        if (item.result.type === 'succeeded' && item.result.message) {
          const text = item.result.message.content
            .filter((b) => b.type === 'text')
            .map((b) => b.text ?? '')
            .join('')
          results.push({
            customId: item.customId,
            output: text,
            inputTokens: item.result.message.usage?.input_tokens ?? 0,
            outputTokens: item.result.message.usage?.output_tokens ?? 0,
          })
        } else {
          results.push({
            customId: item.customId,
            output: '',
            error: item.result.error?.message ?? item.result.type,
            inputTokens: 0,
            outputTokens: 0,
          })
        }
      }

      await db.update(schema.batchJobs).set({
        status: 'ended',
        completedCount: status.requestCounts.succeeded,
        resultsJson: JSON.stringify(results),
        completedAt: new Date().toISOString(),
      }).where(eq(schema.batchJobs.id, jobId))
    } else {
      await db.update(schema.batchJobs).set({
        status: status.status,
        completedCount: status.requestCounts.succeeded,
      }).where(eq(schema.batchJobs.id, jobId))
    }
  } catch (err) {
    console.error(`[BatchPoller] Failed to poll batch ${jobId}:`, err)
  }
}
