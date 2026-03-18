import { ClaudeClient, ClaudeForgeError, MODELS } from '@claudeforge/core'
import type { ClaudeModel, ClaudeResponse, Message, RunOptions, Tool, UsageStats } from '@claudeforge/core'
import { HookManager, createUsageLoggerHook } from './hooks.js'
import type { HookHandler } from './hooks.js'
import { AgentMemory } from './memory.js'
import { SkillRegistry } from './skills.js'
import type { Skill } from './skills.js'

// ─── Agent Config ─────────────────────────────────────────────────────────────

export interface AgentConfig {
  name: string
  description?: string
  model?: ClaudeModel | 'auto'
  systemPrompt?: string
  tools?: Tool[]
  skills?: Skill[]
  hooks?: HookHandler[]
  maxTokens?: number
  temperature?: number
  maxToolRounds?: number
  logUsage?: boolean
  // Feature flags
  cacheSystemPrompt?: boolean
  thinkingEnabled?: boolean
  thinkingBudget?: number
}

// ─── Agent Run Result ─────────────────────────────────────────────────────────

export interface AgentRunResult {
  runId: string
  agentName: string
  input: string
  output: string
  usage: UsageStats
  success: boolean
  error?: string
  startedAt: Date
  completedAt: Date
  thinkingContent?: string
}

// ─── ClaudeAgent Base Class ───────────────────────────────────────────────────

export class ClaudeAgent {
  readonly name: string
  readonly description: string
  protected client: ClaudeClient
  protected model: ClaudeModel | 'auto'
  protected baseSystemPrompt: string
  protected tools: Tool[]
  protected hookManager: HookManager
  protected memory: AgentMemory
  protected skillRegistry: SkillRegistry
  protected maxTokens: number
  protected temperature: number
  protected maxToolRounds: number
  protected cacheSystemPrompt: boolean
  protected thinkingEnabled: boolean
  protected thinkingBudget: number

  constructor(config: AgentConfig) {
    this.name = config.name
    this.description = config.description ?? ''
    this.model = config.model ?? 'auto'
    this.baseSystemPrompt = config.systemPrompt ?? `You are ${config.name}, a helpful AI agent.`
    this.tools = config.tools ?? []
    this.maxTokens = config.maxTokens ?? 8192
    this.temperature = config.temperature ?? 1.0
    this.maxToolRounds = config.maxToolRounds ?? 10
    this.cacheSystemPrompt = config.cacheSystemPrompt ?? false
    this.thinkingEnabled = config.thinkingEnabled ?? false
    this.thinkingBudget = config.thinkingBudget ?? 8000

    this.client = new ClaudeClient({
      defaultModel: this.model,
      maxTokens: this.maxTokens,
    })

    this.hookManager = new HookManager()
    this.memory = new AgentMemory()
    this.skillRegistry = new SkillRegistry()

    // Register hooks
    if (config.logUsage !== false) {
      this.hookManager.register(createUsageLoggerHook())
    }
    for (const hook of config.hooks ?? []) {
      this.hookManager.register(hook)
    }

    // Load skills
    for (const skill of config.skills ?? []) {
      this.skillRegistry.register(skill)
    }
  }

  // ─── Add tools at runtime ─────────────────────────────────────────────────

  addTool(tool: Tool): this {
    this.tools.push(tool)
    return this
  }

  addHook(handler: HookHandler): this {
    this.hookManager.register(handler)
    return this
  }

  loadSkill(skill: Skill): this {
    this.skillRegistry.register(skill)
    return this
  }

  // ─── Build effective system prompt ────────────────────────────────────────

  protected buildSystemPrompt(): string {
    return this.skillRegistry.buildSystemPrompt(this.baseSystemPrompt)
  }

  // ─── Core run method ─────────────────────────────────────────────────────

  async run(input: string): Promise<AgentRunResult> {
    const runId = crypto.randomUUID()
    const startedAt = new Date()

    // Pre-run hook
    const preRun = await this.hookManager.fire('pre-run', {
      agentId: runId,
      agentName: this.name,
      runId,
      input,
      timestamp: startedAt,
    })

    if (preRun.action === 'block') {
      return {
        runId,
        agentName: this.name,
        input,
        output: '',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, model: 'claude-sonnet-4-6', durationMs: 0 },
        success: false,
        error: preRun.reason,
        startedAt,
        completedAt: new Date(),
      }
    }

    // Add user message to memory
    this.memory.add({ role: 'user', content: input })

    let response: ClaudeResponse
    try {
      response = await this.client.run(this.memory.getContextMessages(), {
        model: this.model,
        systemPrompt: this.buildSystemPrompt(),
        tools: this.tools,
        maxTokens: this.maxTokens,
        maxToolRounds: this.maxToolRounds,
        cachingEnabled: this.cacheSystemPrompt,
        ...(this.thinkingEnabled && { thinking: { type: 'enabled' as const, budget_tokens: this.thinkingBudget } }),
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      await this.hookManager.fire('on-error', {
        agentName: this.name,
        runId,
        error: err instanceof Error ? err : new Error(error),
        timestamp: new Date(),
      })
      return {
        runId,
        agentName: this.name,
        input,
        output: '',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, model: 'claude-sonnet-4-6', durationMs: 0 },
        success: false,
        error,
        startedAt,
        completedAt: new Date(),
      }
    }

    // Add assistant response to memory
    this.memory.add({ role: 'assistant', content: response.content })

    const completedAt = new Date()

    // Post-run hook
    await this.hookManager.fire('post-run', {
      agentName: this.name,
      runId,
      input,
      output: response.content,
      usage: response.usage,
      timestamp: completedAt,
    })

    return {
      runId,
      agentName: this.name,
      input,
      output: response.content,
      usage: response.usage,
      success: true,
      startedAt,
      completedAt,
      ...(response.thinkingContent && { thinkingContent: response.thinkingContent }),
    }
  }

  // ─── Stateless one-shot run (no memory) ──────────────────────────────────

  async ask(prompt: string): Promise<string> {
    const response = await this.client.ask(prompt, {
      model: this.model,
      systemPrompt: this.buildSystemPrompt(),
      tools: this.tools,
    })
    return response
  }

  // ─── Clear memory ─────────────────────────────────────────────────────────

  clearMemory(): void {
    this.memory.reset()
  }

  get memoryLength(): number {
    return this.memory.length
  }
}
