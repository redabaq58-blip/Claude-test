import type { Message } from '@claudeforge/core'

// ─── Context Window Manager ───────────────────────────────────────────────────
// Manages conversation history and handles context compaction
// to prevent hitting token limits during long-running agent sessions.

export interface MemoryOptions {
  maxMessages?: number        // Max messages before compaction (default: 100)
  maxTokenEstimate?: number   // Estimated max tokens before compaction (default: 150000)
  summaryModel?: string       // Model to use for compaction summaries
}

export class AgentMemory {
  private messages: Message[] = []
  private summaries: string[] = []
  private maxMessages: number
  private maxTokenEstimate: number

  constructor(options: MemoryOptions = {}) {
    this.maxMessages = options.maxMessages ?? 100
    this.maxTokenEstimate = options.maxTokenEstimate ?? 150_000
  }

  add(message: Message): void {
    this.messages.push(message)
  }

  getMessages(): Message[] {
    return [...this.messages]
  }

  // Rough token estimate (4 chars ≈ 1 token)
  estimateTokens(): number {
    return JSON.stringify(this.messages).length / 4
  }

  needsCompaction(): boolean {
    return (
      this.messages.length > this.maxMessages ||
      this.estimateTokens() > this.maxTokenEstimate
    )
  }

  // Compact: keep system context + recent messages, summarize the rest
  compact(summary: string): void {
    this.summaries.push(summary)

    // Keep the last 20 messages for recency
    const recentMessages = this.messages.slice(-20)
    this.messages = recentMessages
  }

  // Build a summary injection message to prepend to compacted context
  buildSummaryMessage(): Message | null {
    if (this.summaries.length === 0) return null
    return {
      role: 'user',
      content: `[Context Summary]\n${this.summaries.join('\n\n')}\n[End Summary — continuing conversation]`,
    }
  }

  // Get messages with summary prepended if available
  getContextMessages(): Message[] {
    const summary = this.buildSummaryMessage()
    return summary ? [summary, ...this.messages] : [...this.messages]
  }

  reset(): void {
    this.messages = []
    this.summaries = []
  }

  get length(): number {
    return this.messages.length
  }
}
