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
  type: 'text' | 'tool_use' | 'done'
  text?: string
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
}

// ─── Response Types ──────────────────────────────────────────────────────────

export interface ClaudeResponse {
  content: string
  usage: UsageStats
  stopReason: string | null
}

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
