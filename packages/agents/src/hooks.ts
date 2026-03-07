import type { Tool, UsageStats } from '@claudeforge/core'

// ─── Hook Event Types ────────────────────────────────────────────────────────

export type HookEvent =
  | 'pre-run'
  | 'post-run'
  | 'pre-tool-use'
  | 'post-tool-use'
  | 'pre-message'
  | 'post-message'
  | 'on-error'
  | 'on-stop'
  | 'pre-stream'
  | 'post-stream'
  | 'on-compaction'
  | 'on-cost-limit'

export interface HookContext {
  agentId?: string
  agentName?: string
  runId?: string
  model?: string
  input?: string
  output?: string
  tool?: string
  toolInput?: Record<string, unknown>
  toolOutput?: unknown
  usage?: UsageStats
  error?: Error
  timestamp: Date
}

export type HookResult =
  | { action: 'allow' }
  | { action: 'block'; reason: string }
  | { action: 'modify'; data: unknown }

export type HookHandler = (
  event: HookEvent,
  context: HookContext
) => Promise<HookResult> | HookResult

// ─── Built-in Hook Templates ─────────────────────────────────────────────────

// Audit log hook — logs all tool uses to console/file
export function createAuditLogHook(
  logger: (message: string) => void = console.log
): HookHandler {
  return (event, ctx) => {
    if (event === 'pre-tool-use') {
      logger(
        `[AUDIT] ${new Date().toISOString()} | Agent: ${ctx.agentName} | Tool: ${ctx.tool} | Input: ${JSON.stringify(ctx.toolInput)}`
      )
    }
    if (event === 'post-tool-use') {
      logger(
        `[AUDIT] ${new Date().toISOString()} | Agent: ${ctx.agentName} | Tool: ${ctx.tool} | Done`
      )
    }
    return { action: 'allow' }
  }
}

// Cost guard hook — blocks run if estimated cost exceeds limit
export function createCostGuardHook(maxCostUsd: number): HookHandler {
  return (event, ctx) => {
    if (event === 'on-cost-limit' && ctx.usage) {
      if (ctx.usage.costUsd >= maxCostUsd) {
        return {
          action: 'block',
          reason: `Cost limit of $${maxCostUsd} exceeded (current: $${ctx.usage.costUsd.toFixed(4)})`,
        }
      }
    }
    return { action: 'allow' }
  }
}

// Safety hook — blocks dangerous tool patterns
export function createSafetyHook(blockedPatterns: string[]): HookHandler {
  return (event, ctx) => {
    if (event === 'pre-tool-use' && ctx.toolInput) {
      const inputStr = JSON.stringify(ctx.toolInput).toLowerCase()
      for (const pattern of blockedPatterns) {
        if (inputStr.includes(pattern.toLowerCase())) {
          return {
            action: 'block',
            reason: `Safety: blocked pattern "${pattern}" detected in tool input`,
          }
        }
      }
    }
    return { action: 'allow' }
  }
}

// Usage logger hook — prints cost after every run
export function createUsageLoggerHook(): HookHandler {
  return (event, ctx) => {
    if (event === 'post-run' && ctx.usage) {
      console.log(
        `[USAGE] Model: ${ctx.usage.model} | Tokens: ${ctx.usage.totalTokens} | Cost: $${ctx.usage.costUsd.toFixed(6)} | Duration: ${ctx.usage.durationMs}ms`
      )
    }
    return { action: 'allow' }
  }
}

// ─── Hook Manager ────────────────────────────────────────────────────────────

export class HookManager {
  private handlers: HookHandler[] = []

  register(handler: HookHandler): this {
    this.handlers.push(handler)
    return this
  }

  async fire(event: HookEvent, context: HookContext): Promise<HookResult> {
    for (const handler of this.handlers) {
      const result = await handler(event, { ...context, timestamp: new Date() })
      if (result.action === 'block') return result
    }
    return { action: 'allow' }
  }
}
