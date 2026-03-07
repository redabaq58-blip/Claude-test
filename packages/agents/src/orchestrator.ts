import { ClaudeClient, MODELS } from '@claudeforge/core'
import type { Tool, UsageStats } from '@claudeforge/core'
import { ClaudeAgent } from './agent.js'
import type { AgentRunResult } from './agent.js'

// ─── Subtask Types ────────────────────────────────────────────────────────────

export interface Subtask {
  id: string
  description: string
  input: string
  assignedModel?: string
}

export interface OrchestratorConfig {
  name?: string
  maxParallel?: number    // Max concurrent subagents (default: 5)
  synthesizeResults?: boolean  // Whether to synthesize with Opus (default: true)
  subagentTools?: Tool[]
}

export interface OrchestrationResult {
  input: string
  subtasks: Subtask[]
  subtaskResults: AgentRunResult[]
  finalOutput: string
  totalUsage: UsageStats
  success: boolean
  error?: string
  durationMs: number
}

// ─── MultiAgentOrchestrator ───────────────────────────────────────────────────
// Implements Anthropic's proven multi-agent pattern:
//   1. Decompose: Opus breaks complex task into parallel subtasks
//   2. Execute: Sonnet/Haiku agents handle subtasks in parallel
//   3. Synthesize: Opus combines all results into final output
//
// Proven to yield 90%+ improvement over single-agent approaches for
// complex research and analysis tasks.

export class MultiAgentOrchestrator {
  private client: ClaudeClient
  private config: Required<OrchestratorConfig>

  constructor(config: OrchestratorConfig = {}) {
    this.client = new ClaudeClient()
    this.config = {
      name: config.name ?? 'Orchestrator',
      maxParallel: config.maxParallel ?? 5,
      synthesizeResults: config.synthesizeResults ?? true,
      subagentTools: config.subagentTools ?? [],
    }
  }

  // ─── Step 1: Decompose task into subtasks ────────────────────────────────

  private async decompose(task: string): Promise<Subtask[]> {
    const prompt = `You are a task decomposition expert. Break the following complex task into 3-8 independent, parallel subtasks that can be executed simultaneously.

Task: ${task}

Return a JSON array of subtasks with this exact structure:
[
  {
    "id": "1",
    "description": "Brief subtask description",
    "input": "Detailed input/prompt for this subtask"
  }
]

Rules:
- Each subtask must be completely independent (no dependencies between them)
- Each subtask should be self-contained with enough context to execute alone
- Prefer 4-6 subtasks for most tasks
- Return ONLY the JSON array, no other text`

    const response = await this.client.ask(prompt, {
      model: MODELS.OPUS,
      taskConfig: { requiresReasoning: true },
    })

    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('No JSON array found in decomposition response')
      return JSON.parse(jsonMatch[0]) as Subtask[]
    } catch {
      // Fallback: treat as single task
      return [{ id: '1', description: task, input: task }]
    }
  }

  // ─── Step 2: Execute subtasks in parallel ────────────────────────────────

  private async executeParallel(subtasks: Subtask[]): Promise<AgentRunResult[]> {
    const batches: Subtask[][] = []

    // Split into batches based on maxParallel
    for (let i = 0; i < subtasks.length; i += this.config.maxParallel) {
      batches.push(subtasks.slice(i, i + this.config.maxParallel))
    }

    const allResults: AgentRunResult[] = []

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map((subtask) => this.executeSubtask(subtask))
      )
      allResults.push(...batchResults)
    }

    return allResults
  }

  private async executeSubtask(subtask: Subtask): Promise<AgentRunResult> {
    const subagent = new ClaudeAgent({
      name: `Subagent-${subtask.id}`,
      description: subtask.description,
      model: 'claude-sonnet-4-6',
      tools: this.config.subagentTools,
      logUsage: false,
    })

    return subagent.run(subtask.input)
  }

  // ─── Step 3: Synthesize results ──────────────────────────────────────────

  private async synthesize(
    originalTask: string,
    subtasks: Subtask[],
    results: AgentRunResult[]
  ): Promise<string> {
    const resultsSummary = results
      .map((r, i) => {
        const subtask = subtasks[i]
        return `## Subtask ${subtask?.id}: ${subtask?.description}\n${r.success ? r.output : `Error: ${r.error}`}`
      })
      .join('\n\n---\n\n')

    const prompt = `You are a synthesis expert. Combine the following subtask results into a comprehensive, well-structured final response for the original task.

Original Task: ${originalTask}

Subtask Results:
${resultsSummary}

Provide a complete, unified response that:
1. Integrates all relevant findings from the subtasks
2. Resolves any conflicts or inconsistencies
3. Is well-organized and easy to read
4. Directly addresses the original task`

    return this.client.ask(prompt, {
      model: MODELS.OPUS,
      taskConfig: { requiresReasoning: true },
    })
  }

  // ─── Main orchestration entry point ──────────────────────────────────────

  async run(task: string): Promise<OrchestrationResult> {
    const startTime = Date.now()

    let subtasks: Subtask[] = []
    let subtaskResults: AgentRunResult[] = []
    let finalOutput = ''

    try {
      // Step 1: Decompose
      subtasks = await this.decompose(task)

      // Step 2: Execute in parallel
      subtaskResults = await this.executeParallel(subtasks)

      // Step 3: Synthesize
      if (this.config.synthesizeResults) {
        finalOutput = await this.synthesize(task, subtasks, subtaskResults)
      } else {
        finalOutput = subtaskResults.map((r) => r.output).join('\n\n')
      }

      // Aggregate usage
      const totalUsage = subtaskResults.reduce(
        (acc, r) => ({
          inputTokens: acc.inputTokens + r.usage.inputTokens,
          outputTokens: acc.outputTokens + r.usage.outputTokens,
          totalTokens: acc.totalTokens + r.usage.totalTokens,
          costUsd: acc.costUsd + r.usage.costUsd,
          model: 'claude-sonnet-4-6' as const,
          durationMs: Date.now() - startTime,
        }),
        { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, model: 'claude-sonnet-4-6' as const, durationMs: 0 }
      )

      return {
        input: task,
        subtasks,
        subtaskResults,
        finalOutput,
        totalUsage,
        success: true,
        durationMs: Date.now() - startTime,
      }
    } catch (err) {
      return {
        input: task,
        subtasks,
        subtaskResults,
        finalOutput,
        totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, model: 'claude-sonnet-4-6', durationMs: 0 },
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      }
    }
  }
}
