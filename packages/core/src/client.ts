import Anthropic from '@anthropic-ai/sdk'
import { calculateCost, resolveModel } from './models.js'
import type {
  ClaudeModel,
  ClaudeResponse,
  Message,
  StreamChunk,
  TaskConfig,
  Tool,
  ToolDefinition,
  UsageStats,
} from './types.js'
import { ClaudeForgeError } from './types.js'

export interface ClaudeClientOptions {
  apiKey?: string
  defaultModel?: ClaudeModel | 'auto'
  maxTokens?: number
  temperature?: number
}

export interface RunOptions {
  model?: ClaudeModel | 'auto'
  taskConfig?: TaskConfig
  systemPrompt?: string
  tools?: Tool[]
  maxTokens?: number
  temperature?: number
  maxToolRounds?: number
}

// ─── Unified Claude Client ───────────────────────────────────────────────────

export class ClaudeClient {
  private client: Anthropic
  private defaultModel: ClaudeModel | 'auto'
  private defaultMaxTokens: number
  private defaultTemperature: number

  constructor(options: ClaudeClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new ClaudeForgeError(
        'ANTHROPIC_API_KEY is required. Set it as an environment variable or pass it in options.',
        'MISSING_API_KEY'
      )
    }
    this.client = new Anthropic({ apiKey })
    this.defaultModel = options.defaultModel ?? 'auto'
    this.defaultMaxTokens = options.maxTokens ?? 8192
    this.defaultTemperature = options.temperature ?? 1.0
  }

  // ─── Single-turn completion ─────────────────────────────────────────────

  async complete(
    messages: Message[],
    options: RunOptions = {}
  ): Promise<ClaudeResponse> {
    const startTime = Date.now()
    const model = resolveModel(
      options.model ?? this.defaultModel,
      options.taskConfig
    )
    const maxTokens = options.maxTokens ?? this.defaultMaxTokens
    const tools = options.tools ?? []

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        system: options.systemPrompt,
        messages,
        tools: tools.length > 0 ? tools.map((t) => t.definition as ToolDefinition) : undefined,
      } as Parameters<typeof this.client.messages.create>[0])

      const durationMs = Date.now() - startTime
      const inputTokens = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      const costUsd = calculateCost(model, inputTokens, outputTokens)

      const usage: UsageStats = {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsd,
        model,
        durationMs,
      }

      const textContent = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as Anthropic.TextBlock).text)
        .join('')

      return {
        content: textContent,
        usage,
        stopReason: response.stop_reason,
      }
    } catch (err) {
      throw new ClaudeForgeError(
        `Claude API call failed: ${err instanceof Error ? err.message : String(err)}`,
        'API_ERROR',
        err
      )
    }
  }

  // ─── Agentic loop (handles tool calls automatically) ────────────────────

  async run(
    messages: Message[],
    options: RunOptions = {}
  ): Promise<ClaudeResponse> {
    const model = resolveModel(
      options.model ?? this.defaultModel,
      options.taskConfig
    )
    const maxTokens = options.maxTokens ?? this.defaultMaxTokens
    const tools = options.tools ?? []
    const maxRounds = options.maxToolRounds ?? 10

    const currentMessages: Message[] = [...messages]
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let finalContent = ''
    let lastStopReason: string | null = null
    const startTime = Date.now()

    for (let round = 0; round < maxRounds; round++) {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        system: options.systemPrompt,
        messages: currentMessages,
        tools: tools.length > 0 ? tools.map((t) => t.definition as ToolDefinition) : undefined,
      } as Parameters<typeof this.client.messages.create>[0])

      totalInputTokens += response.usage.input_tokens
      totalOutputTokens += response.usage.output_tokens
      lastStopReason = response.stop_reason

      // Extract text content
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.TextBlock).text)
        .join('')
      if (text) finalContent = text

      // Stop if no tool calls
      if (response.stop_reason !== 'tool_use') break

      // Process tool calls
      const toolUseBlocks = response.content.filter(
        (b) => b.type === 'tool_use'
      ) as Anthropic.ToolUseBlock[]

      if (toolUseBlocks.length === 0) break

      // Add assistant's response to messages
      currentMessages.push({ role: 'assistant', content: response.content })

      // Execute tools and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const toolBlock of toolUseBlocks) {
        const tool = tools.find((t) => t.definition.name === toolBlock.name)
        let result: unknown
        if (tool) {
          try {
            result = await tool.handler(toolBlock.input as Record<string, unknown>)
          } catch (err) {
            result = `Error: ${err instanceof Error ? err.message : String(err)}`
          }
        } else {
          result = `Error: Tool "${toolBlock.name}" not found`
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        })
      }

      currentMessages.push({ role: 'user', content: toolResults })
    }

    const durationMs = Date.now() - startTime
    const costUsd = calculateCost(model, totalInputTokens, totalOutputTokens)

    return {
      content: finalContent,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        costUsd,
        model,
        durationMs,
      },
      stopReason: lastStopReason,
    }
  }

  // ─── Streaming ───────────────────────────────────────────────────────────

  async *stream(
    messages: Message[],
    options: RunOptions = {}
  ): AsyncGenerator<StreamChunk> {
    const model = resolveModel(
      options.model ?? this.defaultModel,
      options.taskConfig
    )
    const maxTokens = options.maxTokens ?? this.defaultMaxTokens

    const stream = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: options.systemPrompt,
      messages,
      stream: true,
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield { type: 'text', text: event.delta.text }
      }
    }

    yield { type: 'done' }
  }

  // ─── Simple helper for one-shot prompts ─────────────────────────────────

  async ask(prompt: string, options: RunOptions = {}): Promise<string> {
    const response = await this.complete(
      [{ role: 'user', content: prompt }],
      options
    )
    return response.content
  }
}
