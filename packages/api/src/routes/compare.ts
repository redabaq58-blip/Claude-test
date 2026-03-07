import { Router } from 'express'
import { ok, fail } from '../middleware/response.js'
import { ClaudeClient } from '@claudeforge/core'

export const compareRouter = Router()

const MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
] as const

// POST /api/compare — run same prompt on all (or selected) models in parallel
compareRouter.post('/', async (req, res) => {
  const { prompt, systemPrompt, models } = req.body
  if (!prompt) return fail(res, 'prompt is required')

  const targetModels = (Array.isArray(models) && models.length > 0)
    ? models.filter((m: string) => MODELS.includes(m as typeof MODELS[number]))
    : [...MODELS]

  if (targetModels.length === 0) return fail(res, 'No valid models selected')

  const client = new ClaudeClient()

  const runModel = async (model: string) => {
    const start = Date.now()
    try {
      const response = await client.complete(
        [{ role: 'user', content: prompt }],
        {
          model: model as 'claude-opus-4-6',
          systemPrompt: systemPrompt ?? '',
          maxTokens: 2048,
        }
      )
      return {
        model,
        output: response.content,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        costUsd: response.usage.costUsd,
        durationMs: Date.now() - start,
        error: null,
      }
    } catch (err) {
      return {
        model,
        output: '',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  // Run all models truly in parallel
  const results = await Promise.all(targetModels.map(runModel))

  // Compute winner badges
  const successful = results.filter((r) => !r.error)
  const fastest = successful.reduce((a, b) => (a.durationMs < b.durationMs ? a : b), successful[0])
  const cheapest = successful.reduce((a, b) => (a.costUsd < b.costUsd ? a : b), successful[0])
  const mostDetailed = successful.reduce((a, b) => (a.outputTokens > b.outputTokens ? a : b), successful[0])

  const annotated = results.map((r) => ({
    ...r,
    badges: [
      ...(r.model === fastest?.model ? ['fastest'] : []),
      ...(r.model === cheapest?.model ? ['cheapest'] : []),
      ...(r.model === mostDetailed?.model ? ['most_detailed'] : []),
    ],
  }))

  ok(res, { results: annotated, prompt, systemPrompt: systemPrompt ?? '' })
})
