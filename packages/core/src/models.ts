import type { ClaudeModel, ModelTier, TaskConfig } from './types.js'

// ─── Pricing (per million tokens, USD) ──────────────────────────────────────

const MODEL_PRICING: Record<ModelTier, { input: number; output: number }> = {
  opus: { input: 5.0, output: 25.0 },
  sonnet: { input: 3.0, output: 15.0 },
  haiku: { input: 1.0, output: 5.0 },
}

const MODEL_IDS: Record<ModelTier, ClaudeModel> = {
  opus: 'claude-opus-4-6',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
}

// ─── Model Registry ──────────────────────────────────────────────────────────

export const MODELS = {
  OPUS: 'claude-opus-4-6' as ClaudeModel,
  SONNET: 'claude-sonnet-4-6' as ClaudeModel,
  HAIKU: 'claude-haiku-4-5-20251001' as ClaudeModel,
}

// ─── Smart Model Router ───────────────────────────────────────────────────────
// Automatically selects the best Claude model based on task signals.
// Default: sonnet (best balance of quality + cost for most tasks)

export function selectModel(task: TaskConfig = {}): ClaudeModel {
  const { complexity, requiresReasoning, requiresSpeed, volume, estimatedTokens } = task

  // Opus: complex reasoning, orchestration, synthesis
  if (complexity === 'high' || requiresReasoning === true) {
    return MODELS.OPUS
  }

  // Haiku: speed-critical, high-volume, or very small tasks
  if (
    requiresSpeed === true ||
    volume === 'high' ||
    (estimatedTokens !== undefined && estimatedTokens < 500)
  ) {
    return MODELS.HAIKU
  }

  // Default: Sonnet — balanced quality + cost
  return MODELS.SONNET
}

// ─── Cost Calculator ─────────────────────────────────────────────────────────

export function calculateCost(
  model: ClaudeModel,
  inputTokens: number,
  outputTokens: number
): number {
  const tier = getTier(model)
  const pricing = MODEL_PRICING[tier]
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
}

export function getTier(model: ClaudeModel): ModelTier {
  if (model === MODELS.OPUS) return 'opus'
  if (model === MODELS.HAIKU) return 'haiku'
  return 'sonnet'
}

export function resolveModel(model: ClaudeModel | 'auto', task?: TaskConfig): ClaudeModel {
  if (model === 'auto') return selectModel(task)
  return model
}
