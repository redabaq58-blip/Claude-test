import Anthropic from '@anthropic-ai/sdk'
import { calculateCost, calculateCostWithCache, resolveModel } from './models.js'
import type {
  BatchJobResponse,
  BatchJobStatus,
  BatchRequest,
  BatchResultItem,
  ClaudeModel,
  ClaudeResponse,
  ContentBlock,
  Message,
  StreamChunk,
  TaskConfig,
  TokenCountEstimate,
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
  // Prompt caching
  cachingEnabled?: boolean
  // Extended thinking
  thinking?: { type: 'enabled'; budget_tokens: number }
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

    // Build system parameter — wrap with cache_control when caching is enabled
    const systemParam: Anthropic.MessageCreateParams['system'] = options.cachingEnabled && options.systemPrompt
      ? [{ type: 'text' as const, text: options.systemPrompt, cache_control: { type: 'ephemeral' as const } }]
      : options.systemPrompt

    try {
      const createParams: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        system: systemParam,
        messages,
        tools: tools.length > 0 ? tools.map((t) => t.definition as ToolDefinition) : undefined,
      }

      if (options.thinking) {
        createParams.thinking = options.thinking
        createParams.temperature = 1 // required when thinking is enabled
      }

      const response = await this.client.messages.create(
        createParams as unknown as Parameters<typeof this.client.messages.create>[0]
      ) as Anthropic.Message

      const durationMs = Date.now() - startTime
      const inputTokens = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      const usageAny = response.usage as unknown as Record<string, number>
      const cacheReadTokens = usageAny.cache_read_input_tokens ?? 0
      const cacheCreationTokens = usageAny.cache_creation_input_tokens ?? 0
      const costUsd = calculateCostWithCache(model, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens)

      const usage: UsageStats = {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsd,
        model,
        durationMs,
        ...(cacheReadTokens > 0 && { cacheReadTokens }),
        ...(cacheCreationTokens > 0 && { cacheCreationTokens }),
      }

      const textContent = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as Anthropic.TextBlock).text)
        .join('')

      const thinkingContent = response.content
        .filter((block) => block.type === 'thinking')
        .map((block) => (block as { type: 'thinking'; thinking: string }).thinking)
        .join('')

      return {
        content: textContent,
        usage,
        stopReason: response.stop_reason,
        ...(thinkingContent && { thinkingContent }),
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

    // Build system param with optional caching
    const systemParam: Anthropic.MessageCreateParams['system'] = options.cachingEnabled && options.systemPrompt
      ? [{ type: 'text' as const, text: options.systemPrompt, cache_control: { type: 'ephemeral' as const } }]
      : options.systemPrompt

    let totalCacheReadTokens = 0
    let totalCacheCreationTokens = 0
    let finalThinkingContent = ''

    for (let round = 0; round < maxRounds; round++) {
      const createParams: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        system: systemParam,
        messages: currentMessages,
        tools: tools.length > 0 ? tools.map((t) => t.definition as ToolDefinition) : undefined,
      }

      if (options.thinking) {
        createParams.thinking = options.thinking
        createParams.temperature = 1
      }

      const response = await this.client.messages.create(
        createParams as unknown as Parameters<typeof this.client.messages.create>[0]
      ) as Anthropic.Message

      totalInputTokens += response.usage.input_tokens
      totalOutputTokens += response.usage.output_tokens
      const runUsageAny = response.usage as unknown as Record<string, number>
      totalCacheReadTokens += runUsageAny.cache_read_input_tokens ?? 0
      totalCacheCreationTokens += runUsageAny.cache_creation_input_tokens ?? 0
      lastStopReason = response.stop_reason

      // Capture thinking content from first round
      if (!finalThinkingContent) {
        const thinking = response.content
          .filter((b) => b.type === 'thinking')
          .map((b) => (b as { type: 'thinking'; thinking: string }).thinking)
          .join('')
        if (thinking) finalThinkingContent = thinking
      }

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
    const costUsd = calculateCostWithCache(model, totalInputTokens, totalOutputTokens, totalCacheReadTokens, totalCacheCreationTokens)

    return {
      content: finalContent,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        costUsd,
        model,
        durationMs,
        ...(totalCacheReadTokens > 0 && { cacheReadTokens: totalCacheReadTokens }),
        ...(totalCacheCreationTokens > 0 && { cacheCreationTokens: totalCacheCreationTokens }),
      },
      stopReason: lastStopReason,
      ...(finalThinkingContent && { thinkingContent: finalThinkingContent }),
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
    const temperature = options.temperature ?? this.defaultTemperature

    const streamParams: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      temperature,
      system: options.cachingEnabled && options.systemPrompt
        ? [{ type: 'text' as const, text: options.systemPrompt, cache_control: { type: 'ephemeral' as const } }]
        : options.systemPrompt,
      messages,
      stream: true,
    }

    if (options.thinking) {
      streamParams.thinking = options.thinking
      streamParams.temperature = 1
    }

    const stream = await this.client.messages.create(
      streamParams as unknown as Parameters<typeof this.client.messages.create>[0]
    ) as AsyncIterable<Anthropic.RawMessageStreamEvent>

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text', text: event.delta.text }
        } else if (event.delta.type === 'thinking_delta') {
          yield { type: 'thinking', thinking: (event.delta as { type: 'thinking_delta'; thinking: string }).thinking }
        }
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

  // ─── Token counting pre-flight ───────────────────────────────────────────

  async countTokens(
    messages: Message[],
    options: Pick<RunOptions, 'model' | 'systemPrompt' | 'tools' | 'taskConfig'> = {}
  ): Promise<number> {
    const model = resolveModel(options.model ?? this.defaultModel, options.taskConfig)
    const tools = options.tools ?? []
    try {
      const result = await (this.client.messages as unknown as {
        countTokens: (params: Record<string, unknown>) => Promise<{ input_tokens: number }>
      }).countTokens({
        model,
        system: options.systemPrompt,
        messages,
        tools: tools.length > 0 ? tools.map((t) => t.definition as ToolDefinition) : undefined,
      })
      return result.input_tokens
    } catch {
      // Fallback to rough estimate if API doesn't support it
      return Math.ceil(JSON.stringify(messages).length / 4)
    }
  }

  async estimateRunCost(
    messages: Message[],
    options: Pick<RunOptions, 'model' | 'systemPrompt' | 'tools' | 'taskConfig'> & { budgetUsd?: number } = {}
  ): Promise<TokenCountEstimate> {
    const model = resolveModel(options.model ?? this.defaultModel, options.taskConfig)
    const inputTokens = await this.countTokens(messages, options)
    const { calculateCost: calc } = await import('./models.js')
    const estimatedCostUsd = calc(model, inputTokens, 0)
    const budgetUsd = options.budgetUsd ?? parseFloat(process.env.COST_LIMIT_PER_RUN ?? '1.0')
    return { inputTokens, estimatedCostUsd, withinBudget: estimatedCostUsd <= budgetUsd }
  }

  // ─── Vision helper ───────────────────────────────────────────────────────

  async askWithImage(
    imageBase64: string,
    mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
    prompt: string,
    options: RunOptions = {}
  ): Promise<string> {
    const content: ContentBlock[] = [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
      { type: 'text', text: prompt },
    ]
    const response = await this.complete(
      [{ role: 'user', content: content as unknown as string }],
      options
    )
    return response.content
  }

  // ─── Batch API ───────────────────────────────────────────────────────────

  async batch(requests: BatchRequest[]): Promise<BatchJobResponse> {
    try {
      const batchRequests = requests.map((r) => ({
        custom_id: r.customId,
        params: {
          model: resolveModel(r.model ?? this.defaultModel),
          max_tokens: r.maxTokens ?? this.defaultMaxTokens,
          system: r.systemPrompt,
          messages: r.messages,
        },
      }))

      const result = await (this.client.beta.messages as unknown as {
        batches: {
          create: (params: { requests: typeof batchRequests }) => Promise<{
            id: string; processing_status: string; request_counts: { processing: number; succeeded: number; errored: number; canceled: number; expired: number }; created_at: string
          }>
        }
      }).batches.create({ requests: batchRequests })

      return {
        batchId: result.id,
        status: result.processing_status,
        inputCount: requests.length,
        createdAt: result.created_at,
      }
    } catch (err) {
      throw new ClaudeForgeError(
        `Batch API call failed: ${err instanceof Error ? err.message : String(err)}`,
        'BATCH_ERROR',
        err
      )
    }
  }

  async getBatch(batchId: string): Promise<BatchJobStatus> {
    const result = await (this.client.beta.messages as unknown as {
      batches: {
        retrieve: (id: string) => Promise<{
          id: string; processing_status: string; request_counts: { processing: number; succeeded: number; errored: number; canceled: number; expired: number }; ended_at?: string
        }>
      }
    }).batches.retrieve(batchId)
    return {
      batchId: result.id,
      status: result.processing_status as BatchJobStatus['status'],
      requestCounts: result.request_counts,
      endedAt: result.ended_at,
    }
  }

  async *getBatchResults(batchId: string): AsyncGenerator<BatchResultItem> {
    const stream = await (this.client.beta.messages as unknown as {
      batches: { results: (id: string) => AsyncIterable<BatchResultItem> }
    }).batches.results(batchId)
    for await (const item of stream) {
      yield item
    }
  }
}
