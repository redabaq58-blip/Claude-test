import type Anthropic from '@anthropic-ai/sdk'

// ─── Model Types ────────────────────────────────────────────────────────────

export type ClaudeModel =
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001'
  | 'auto'

export type ModelTier = 'opus' | 'sonnet' | 'haiku'

// ─── Task Complexity Signals ─────────────────────────────────────────────────

export interface TaskConfig {
  complexity?: 'low' | 'medium' | 'high'
  requiresReasoning?: boolean
  requiresSpeed?: boolean
  volume?: 'low' | 'medium' | 'high'
  estimatedTokens?: number
}

// ─── Message Types ───────────────────────────────────────────────────────────

export type Message = Anthropic.MessageParam

export interface StreamChunk {
  type: 'text' | 'thinking' | 'tool_use' | 'done'
  text?: string
  thinking?: string
  toolName?: string
  toolInput?: Record<string, unknown>
}

// ─── Tool Types ──────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>

export interface Tool {
  definition: ToolDefinition
  handler: ToolHandler
}

// ─── Usage & Cost ────────────────────────────────────────────────────────────

export interface UsageStats {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
  model: ClaudeModel
  durationMs: number
  // Prompt caching stats (optional)
  cacheReadTokens?: number
  cacheCreationTokens?: number
}

// ─── Response Types ──────────────────────────────────────────────────────────

export interface ClaudeResponse {
  content: string
  usage: UsageStats
  stopReason: string | null
  // Extended thinking content (optional)
  thinkingContent?: string
}

// ─── Token Count Estimate ─────────────────────────────────────────────────────

export interface TokenCountEstimate {
  inputTokens: number
  estimatedCostUsd: number
  withinBudget: boolean
}

// ─── Batch Types ──────────────────────────────────────────────────────────────

export interface BatchRequest {
  customId: string
  messages: Message[]
  systemPrompt?: string
  model?: ClaudeModel
  maxTokens?: number
}

export interface BatchJobResponse {
  batchId: string
  status: string
  inputCount: number
  createdAt: string
}

export interface BatchJobStatus {
  batchId: string
  status: 'submitted' | 'processing' | 'ended' | 'cancelled' | 'errored'
  requestCounts: {
    processing: number
    succeeded: number
    errored: number
    canceled: number
    expired: number
  }
  endedAt?: string
}

export interface BatchResultItem {
  customId: string
  result: {
    type: 'succeeded' | 'errored' | 'canceled' | 'expired'
    message?: { content: Array<{ type: string; text?: string }>; usage?: { input_tokens: number; output_tokens: number } }
    error?: { type: string; message: string }
  }
}

// ─── Image / Multimodal Types ─────────────────────────────────────────────────

export interface ImageContentBlock {
  type: 'image'
  source: {
    type: 'base64'
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    data: string
  }
}

export interface TextContentBlock {
  type: 'text'
  text: string
}

export type ContentBlock = TextContentBlock | ImageContentBlock

// ─── Error Types ─────────────────────────────────────────────────────────────

export class ClaudeForgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'ClaudeForgeError'
  }
}

// ─── API Response Envelope ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  meta?: Record<string, unknown>
}
