/**
 * forge() — Universal One-Line Agent Executor
 *
 * The simplest possible API for multi-agent systems:
 *   - Define agents like team members (role, goal, tools)
 *   - Claude orchestrates routing, sequencing, and handoffs automatically
 *   - State persists after every agent turn (LangGraph-style checkpointing)
 *   - Human-in-the-loop interrupts built in
 *   - Conditional routing via natural language `when` conditions
 *
 * Absorbs the best of: CrewAI (roles) + LangGraph (persistence + HITL)
 *                    + OpenAI Swarm (handoffs) + N8N (visibility/streaming)
 */

import { ClaudeClient, selectModel } from '@claudeforge/core'
import type { ClaudeModel, Tool } from '@claudeforge/core'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * An agent in a forge run — described in plain English, like a team member.
 */
export interface ForgeAgent {
  /** Human role title: "Research Analyst", "Content Writer", "QA Reviewer" */
  role: string
  /** What this agent's goal is. Use {variable} for input interpolation. */
  goal?: string
  /** Personality and context. Shapes how the agent responds. */
  backstory?: string
  /** MCP server names to equip: 'web', 'filesystem', 'git', 'database', 'code' */
  tools?: Tool[]
  /** Claude model to use. 'auto' lets forge() pick based on role complexity. */
  model?: ClaudeModel | 'auto'
  /**
   * Short alias for conditional routing references.
   * Example: `as: '$research'` lets later agents use `when: '$research.score > 7'`
   */
  as?: string
  /**
   * Natural language condition for when this agent should run.
   * Evaluated against the accumulated forge state.
   * Example: `when: '$review.verdict === "pass"'`
   */
  when?: string
  /**
   * After this agent runs, loop back to another agent (by `as` alias or role name).
   * Example: `goto: '$review'` loops back to the reviewer agent.
   */
  goto?: string
}

/**
 * Options for a forge() run.
 */
export interface ForgeOptions {
  /** Input variables to inject into goal/backstory templates. */
  inputs?: Record<string, string>
  /**
   * Persist state to SQLite after every agent turn.
   * Enables crash recovery and thread-based resumption.
   * Default: true
   */
  persist?: boolean
  /**
   * Thread ID to resume a previously interrupted or partially completed run.
   * Pair with `resume` to continue after a human checkpoint.
   */
  threadId?: string
  /**
   * Resume value for an interrupted run (human-in-the-loop response).
   * Only valid when `threadId` is provided and thread status is 'interrupted'.
   */
  resume?: string
  /**
   * Pause after each agent turn for human review.
   * The run returns with `status: 'interrupted'` and a `resumePrompt`.
   * Call forge() again with the same `threadId` and a `resume` value to continue.
   */
  hitl?: boolean
  /** Called after each agent completes, with the agent name, output, and cost. */
  onProgress?: (event: ForgeEvent) => void
  /** Maximum number of agent steps to prevent infinite loops. Default: 50. */
  maxSteps?: number
}

/**
 * Progress event emitted after each agent turn.
 */
export interface ForgeEvent {
  type: 'agent_start' | 'agent_complete' | 'handoff' | 'interrupted' | 'complete' | 'error'
  threadId: string
  agent: string
  step: number
  output?: string
  costUsd?: number
  error?: string
}

/**
 * The result of a forge() run.
 */
export interface ForgeResult {
  /** Final synthesized output. */
  output: string
  /** Status of the run. */
  status: 'completed' | 'interrupted' | 'failed'
  /** Thread ID — use this to resume an interrupted run. */
  threadId: string
  /** When interrupted, the question/prompt being shown to the human. */
  resumePrompt?: string
  /** Per-step execution record. */
  steps: ForgeStep[]
  /** Total cost of the run in USD. */
  costUsd: number
  /** Total duration in milliseconds. */
  durationMs: number
}

export interface ForgeStep {
  agent: string
  role: string
  input: string
  output: string
  costUsd: number
  durationMs: number
  status: 'completed' | 'skipped' | 'interrupted'
}

// ─── In-memory checkpoint store ───────────────────────────────────────────────

interface ForgeCheckpoint {
  threadId: string
  agents: ForgeAgent[]
  goal: string
  options: ForgeOptions
  state: ForgeState
  steps: ForgeStep[]
  currentStep: number
  status: 'running' | 'interrupted' | 'completed' | 'failed'
  resumePrompt?: string
  createdAt: Date
  updatedAt: Date
}

interface ForgeState {
  inputs: Record<string, string>
  outputs: Record<string, string>  // keyed by agent.as or agent.role
  history: Array<{ role: string; output: string }>
}

// Simple in-memory store (API layer replaces this with SQLite persistence)
const checkpoints = new Map<string, ForgeCheckpoint>()

// ─── Main forge() function ────────────────────────────────────────────────────

/**
 * Execute a multi-agent workflow with a single function call.
 *
 * @example
 * ```typescript
 * const result = await forge(
 *   [
 *     { role: 'Researcher',  goal: 'Find facts about {topic}', tools: webTools },
 *     { role: 'Writer',      goal: 'Write an article using the research'       },
 *   ],
 *   'Create a market analysis on {topic}',
 *   { inputs: { topic: 'AI infrastructure 2025' }, persist: true, hitl: true }
 * )
 * ```
 */
export async function forge(
  agents: ForgeAgent[],
  goal: string,
  options: ForgeOptions = {}
): Promise<ForgeResult> {
  const startTime = Date.now()
  const {
    inputs = {},
    persist = true,
    threadId: existingThreadId,
    resume,
    hitl = false,
    onProgress,
    maxSteps = 50,
  } = options

  // ── Resume an existing thread ────────────────────────────────────────────
  if (existingThreadId) {
    const checkpoint = checkpoints.get(existingThreadId)
    if (!checkpoint) {
      throw new Error(`Thread '${existingThreadId}' not found. It may have expired or never existed.`)
    }
    if (checkpoint.status !== 'interrupted') {
      throw new Error(`Thread '${existingThreadId}' is not interrupted (status: ${checkpoint.status}). Cannot resume.`)
    }
    if (resume !== undefined) {
      // Inject the human's response into state and continue
      checkpoint.state.outputs['__human__'] = resume
      checkpoint.state.history.push({ role: '__human__', output: resume })
      checkpoint.status = 'running'
      return _runFromCheckpoint(checkpoint, onProgress, maxSteps, startTime)
    }
    // No resume value — return current state
    return {
      output: checkpoint.state.history.at(-1)?.output ?? '',
      status: 'interrupted',
      threadId: existingThreadId,
      resumePrompt: checkpoint.resumePrompt,
      steps: checkpoint.steps,
      costUsd: checkpoint.steps.reduce((s, t) => s + t.costUsd, 0),
      durationMs: Date.now() - startTime,
    }
  }

  // ── New run ──────────────────────────────────────────────────────────────
  const threadId = crypto.randomUUID()
  const resolvedGoal = interpolate(goal, inputs)

  const state: ForgeState = {
    inputs,
    outputs: {},
    history: [],
  }

  const checkpoint: ForgeCheckpoint = {
    threadId,
    agents,
    goal: resolvedGoal,
    options,
    state,
    steps: [],
    currentStep: 0,
    status: 'running',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  if (persist) {
    checkpoints.set(threadId, checkpoint)
  }

  return _runFromCheckpoint(checkpoint, onProgress, maxSteps, startTime)
}

// ─── Internal execution engine ────────────────────────────────────────────────

async function _runFromCheckpoint(
  checkpoint: ForgeCheckpoint,
  onProgress: ForgeOptions['onProgress'],
  maxSteps: number,
  startTime: number
): Promise<ForgeResult> {
  const { agents, goal, options, state } = checkpoint
  const { inputs = {}, hitl = false } = options
  let stepCount = checkpoint.currentStep

  // Build a list of agents to execute (respecting `when` conditions + gotos)
  let queue = buildExecutionQueue(agents, state)

  while (queue.length > 0 && stepCount < maxSteps) {
    const agentDef = queue.shift()!

    // Evaluate `when` condition
    if (agentDef.when && !evaluateCondition(agentDef.when, state)) {
      checkpoint.steps.push({
        agent: agentDef.role,
        role: agentDef.role,
        input: '',
        output: '',
        costUsd: 0,
        durationMs: 0,
        status: 'skipped',
      })
      continue
    }

    // HITL — pause before this agent if requested
    if (hitl && stepCount > 0) {
      const lastOutput = state.history.at(-1)?.output ?? ''
      const resumePrompt = `Review the output from ${state.history.at(-1)?.role ?? 'previous agent'} before ${agentDef.role} continues. Type your feedback or 'continue' to proceed.`
      checkpoint.status = 'interrupted'
      checkpoint.resumePrompt = resumePrompt
      checkpoint.currentStep = stepCount
      checkpoint.updatedAt = new Date()

      onProgress?.({
        type: 'interrupted',
        threadId: checkpoint.threadId,
        agent: agentDef.role,
        step: stepCount,
        output: lastOutput,
      })

      return {
        output: lastOutput,
        status: 'interrupted',
        threadId: checkpoint.threadId,
        resumePrompt,
        steps: checkpoint.steps,
        costUsd: checkpoint.steps.reduce((s, t) => s + t.costUsd, 0),
        durationMs: Date.now() - startTime,
      }
    }

    // Emit start event
    onProgress?.({
      type: 'agent_start',
      threadId: checkpoint.threadId,
      agent: agentDef.role,
      step: stepCount,
    })

    // Build the input for this agent
    const agentInput = buildAgentInput(agentDef, goal, state, inputs)
    const agentStepStart = Date.now()

    // Execute the agent
    const { output, costUsd, error } = await runSingleAgent(agentDef, agentInput)
    const agentDurationMs = Date.now() - agentStepStart

    if (error) {
      checkpoint.status = 'failed'
      const step: ForgeStep = { agent: agentDef.role, role: agentDef.role, input: agentInput, output: '', costUsd: 0, durationMs: agentDurationMs, status: 'completed' }
      checkpoint.steps.push(step)
      return {
        output: '',
        status: 'failed',
        threadId: checkpoint.threadId,
        steps: checkpoint.steps,
        costUsd: checkpoint.steps.reduce((s, t) => s + t.costUsd, 0),
        durationMs: Date.now() - startTime,
      }
    }

    // Store output in state
    const key = agentDef.as ?? agentDef.role
    state.outputs[key] = output
    state.history.push({ role: agentDef.role, output })

    const step: ForgeStep = {
      agent: agentDef.role,
      role: agentDef.role,
      input: agentInput,
      output,
      costUsd,
      durationMs: agentDurationMs,
      status: 'completed',
    }
    checkpoint.steps.push(step)
    stepCount++
    checkpoint.currentStep = stepCount
    checkpoint.updatedAt = new Date()

    // Emit complete event
    onProgress?.({
      type: 'agent_complete',
      threadId: checkpoint.threadId,
      agent: agentDef.role,
      step: stepCount,
      output,
      costUsd,
    })

    // Handle `goto` — loop back by inserting the target agent(s) at front of queue
    if (agentDef.goto) {
      const gotoAgents = resolveGoto(agentDef.goto, agents, state)
      if (gotoAgents.length > 0) {
        queue = [...gotoAgents, ...queue]
        onProgress?.({
          type: 'handoff',
          threadId: checkpoint.threadId,
          agent: gotoAgents[0].role,
          step: stepCount,
        })
      }
    }

    // Detect agent handoff — if output contains HANDOFF: <role>, route there
    const handoffTarget = detectHandoff(output, agents)
    if (handoffTarget) {
      queue = [handoffTarget, ...queue]
      onProgress?.({
        type: 'handoff',
        threadId: checkpoint.threadId,
        agent: handoffTarget.role,
        step: stepCount,
      })
    }
  }

  // Synthesize final output
  const finalOutput = await synthesizeOutput(goal, state, checkpoint.steps)
  checkpoint.status = 'completed'
  checkpoint.updatedAt = new Date()

  onProgress?.({
    type: 'complete',
    threadId: checkpoint.threadId,
    agent: 'synthesizer',
    step: stepCount,
    output: finalOutput,
    costUsd: checkpoint.steps.reduce((s, t) => s + t.costUsd, 0),
  })

  return {
    output: finalOutput,
    status: 'completed',
    threadId: checkpoint.threadId,
    steps: checkpoint.steps,
    costUsd: checkpoint.steps.reduce((s, t) => s + t.costUsd, 0),
    durationMs: Date.now() - startTime,
  }
}

// ─── Execute a single agent ───────────────────────────────────────────────────

async function runSingleAgent(
  agentDef: ForgeAgent,
  input: string
): Promise<{ output: string; costUsd: number; error?: string }> {
  try {
    const model = resolveModel(agentDef)
    const client = new ClaudeClient({ defaultModel: model })

    const systemPrompt = buildSystemPrompt(agentDef)

    const response = await client.run(
      [{ role: 'user', content: input }],
      {
        model,
        systemPrompt,
        tools: agentDef.tools ?? [],
        maxTokens: 8192,
        maxToolRounds: 10,
        cachingEnabled: true,
      }
    )

    return { output: response.content, costUsd: response.usage.costUsd }
  } catch (err) {
    return { output: '', costUsd: 0, error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildExecutionQueue(agents: ForgeAgent[], _state: ForgeState): ForgeAgent[] {
  // Default: run agents in the order they were defined
  return [...agents]
}

function buildSystemPrompt(agent: ForgeAgent): string {
  const parts: string[] = []
  parts.push(`You are a ${agent.role}.`)
  if (agent.goal) parts.push(`Your goal: ${agent.goal}`)
  if (agent.backstory) parts.push(`\nContext about you: ${agent.backstory}`)
  parts.push('\nBe focused, accurate, and deliver exactly what is asked. Output only your work product — no meta-commentary.')
  return parts.join('\n')
}

function buildAgentInput(
  agent: ForgeAgent,
  goal: string,
  state: ForgeState,
  inputs: Record<string, string>
): string {
  const parts: string[] = []

  // The overarching goal
  parts.push(`Overall objective: ${goal}`)

  // Previous agents' outputs as context
  if (state.history.length > 0) {
    parts.push('\n--- Context from previous agents ---')
    for (const h of state.history) {
      parts.push(`\n[${h.role}]:\n${h.output}`)
    }
    parts.push('--- End context ---\n')
  }

  // Human feedback if available
  if (state.outputs['__human__']) {
    parts.push(`\nHuman feedback: ${state.outputs['__human__']}`)
    // Clear after use
    delete state.outputs['__human__']
  }

  // This agent's specific goal (with variable interpolation)
  const agentGoal = agent.goal ? interpolate(agent.goal, inputs) : `Complete your part of the objective as ${agent.role}`
  parts.push(`\nYour specific task: ${agentGoal}`)

  return parts.join('\n')
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

function evaluateCondition(condition: string, state: ForgeState): boolean {
  try {
    // Build evaluation context from state outputs
    // e.g., '$review.score' becomes the parsed value from state.outputs['$review']
    const context = buildConditionContext(state)
    // Replace $alias.field references with actual values
    const resolved = condition.replace(/\$(\w+)\.(\w+)/g, (_, alias, field) => {
      const key = `$${alias}`
      const val = context[key]
      if (val === undefined) return 'undefined'
      try {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val
        const fieldVal = parsed[field]
        return JSON.stringify(fieldVal)
      } catch {
        return JSON.stringify(val)
      }
    })
    // Safe evaluation using Function constructor (limited scope)
    // eslint-disable-next-line no-new-func
    return Boolean(new Function(`return (${resolved})`)())
  } catch {
    // If condition can't be evaluated, default to running the agent
    return true
  }
}

function buildConditionContext(state: ForgeState): Record<string, string> {
  const ctx: Record<string, string> = {}
  for (const [key, val] of Object.entries(state.outputs)) {
    // Normalize: both 'Research Analyst' and '$research' map to their keys
    ctx[key] = val
    if (!key.startsWith('$')) {
      ctx[`$${key.toLowerCase().replace(/\s+/g, '_')}`] = val
    }
  }
  return ctx
}

function detectHandoff(output: string, agents: ForgeAgent[]): ForgeAgent | null {
  // Detect "HANDOFF: <Role Name>" pattern in agent output
  const match = output.match(/HANDOFF:\s*([^\n]+)/i)
  if (!match) return null
  const targetRole = match[1].trim()
  return agents.find(a =>
    a.role.toLowerCase() === targetRole.toLowerCase() ||
    (a.as && a.as.toLowerCase() === targetRole.toLowerCase())
  ) ?? null
}

function resolveGoto(gotoTarget: string, agents: ForgeAgent[], _state: ForgeState): ForgeAgent[] {
  // Find agents matching the goto target (by `as` alias or role name)
  const target = gotoTarget.replace(/^\$/, '')
  const found = agents.find(a =>
    a.role.toLowerCase() === target.toLowerCase() ||
    (a.as && a.as.replace(/^\$/, '').toLowerCase() === target.toLowerCase())
  )
  return found ? [found] : []
}

function resolveModel(agent: ForgeAgent): ClaudeModel {
  if (agent.model && agent.model !== 'auto') return agent.model
  // Auto-select based on role keywords
  const role = agent.role.toLowerCase()
  if (role.includes('orchestrat') || role.includes('architect') || role.includes('strateg') || role.includes('lead')) {
    return 'claude-opus-4-6'
  }
  if (role.includes('classif') || role.includes('review') || role.includes('check') || role.includes('triage') || role.includes('score')) {
    return 'claude-haiku-4-5-20251001'
  }
  return 'claude-sonnet-4-6'
}

async function synthesizeOutput(
  goal: string,
  state: ForgeState,
  steps: ForgeStep[]
): Promise<string> {
  // If only one agent ran, return its output directly (no synthesis needed)
  const completedSteps = steps.filter(s => s.status === 'completed')
  if (completedSteps.length === 1) {
    return completedSteps[0].output
  }

  // If the last agent's output is substantial, use it directly
  const lastOutput = state.history.at(-1)?.output ?? ''
  if (lastOutput.length > 200) {
    return lastOutput
  }

  // Synthesize using Haiku (cheap)
  try {
    const client = new ClaudeClient({ defaultModel: 'claude-haiku-4-5-20251001' })
    const summaryPrompt = [
      `Goal: ${goal}`,
      '',
      'Agent outputs:',
      ...state.history.map(h => `[${h.role}]: ${h.output.slice(0, 1000)}`),
      '',
      'Synthesize the above into a single coherent answer that best fulfills the original goal.',
    ].join('\n')

    const response = await client.ask(summaryPrompt, { model: 'claude-haiku-4-5-20251001' })
    return response
  } catch {
    return lastOutput
  }
}

// ─── Thread management helpers (used by API layer) ────────────────────────────

export function getForgeCheckpoint(threadId: string): ForgeCheckpoint | undefined {
  return checkpoints.get(threadId)
}

export function setForgeCheckpoint(threadId: string, checkpoint: ForgeCheckpoint): void {
  checkpoints.set(threadId, checkpoint)
}

export function listForgeThreads(): ForgeCheckpoint[] {
  return Array.from(checkpoints.values())
}

export function deleteForgeThread(threadId: string): boolean {
  return checkpoints.delete(threadId)
}

// ─── Role Library (Pre-built agent definitions) ───────────────────────────────

/**
 * Pre-built agent role definitions that work great out of the box.
 * Drag from the Forge Studio sidebar or use directly in forge() calls.
 */
export const ROLE_LIBRARY: Record<string, Omit<ForgeAgent, 'tools'>> = {
  'research-analyst': {
    role: 'Research Analyst',
    goal: 'Conduct thorough research on {topic} and synthesize key findings',
    backstory: 'You are a meticulous researcher with expertise in finding and evaluating information. You prioritize accuracy, cite sources, and distinguish between facts and opinions.',
    model: 'claude-sonnet-4-6',
  },
  'content-writer': {
    role: 'Content Writer',
    goal: 'Write engaging, well-structured content that serves the audience',
    backstory: 'You are a skilled writer who transforms complex information into clear, compelling content. You adapt tone and format to the audience and purpose.',
    model: 'claude-sonnet-4-6',
  },
  'code-reviewer': {
    role: 'Code Reviewer',
    goal: 'Review code for quality, security, performance, and best practices',
    backstory: 'You are an experienced software engineer who provides constructive, specific code review feedback. You prioritize security vulnerabilities, then performance, then style.',
    model: 'claude-opus-4-6',
  },
  'data-analyst': {
    role: 'Data Analyst',
    goal: 'Analyze data and extract actionable insights',
    backstory: 'You are a data analyst who turns raw data into clear insights. You write SQL queries, interpret results, and communicate findings to non-technical stakeholders.',
    model: 'claude-sonnet-4-6',
  },
  'qa-reviewer': {
    role: 'QA Reviewer',
    goal: 'Evaluate quality, identify gaps, and score output on a scale of 1-10',
    backstory: 'You are a quality assurance specialist with a critical eye. You evaluate work objectively, identify specific improvement areas, and provide a numeric quality score.',
    model: 'claude-haiku-4-5-20251001',
  },
  'customer-support': {
    role: 'Customer Support Specialist',
    goal: 'Resolve customer issues with empathy and accuracy',
    backstory: 'You are a helpful customer support agent who listens carefully, understands the customer\'s problem, and provides clear solutions. You escalate when needed.',
    model: 'claude-haiku-4-5-20251001',
  },
  'developer': {
    role: 'Senior Developer',
    goal: 'Write clean, production-ready code that solves the problem',
    backstory: 'You are a senior software engineer who writes well-structured, commented, testable code. You follow best practices and consider edge cases.',
    model: 'claude-opus-4-6',
  },
  'product-manager': {
    role: 'Product Manager',
    goal: 'Define requirements, user stories, and acceptance criteria',
    backstory: 'You are an experienced product manager who bridges business goals and technical execution. You write clear, actionable requirements with measurable outcomes.',
    model: 'claude-sonnet-4-6',
  },
  'financial-analyst': {
    role: 'Financial Analyst',
    goal: 'Analyze financial data and produce clear investment or business insights',
    backstory: 'You are a financial analyst who interprets financial statements, market data, and economic trends to produce well-reasoned, evidence-based analysis.',
    model: 'claude-opus-4-6',
  },
  'devops-engineer': {
    role: 'DevOps Engineer',
    goal: 'Analyze infrastructure, diagnose issues, and recommend solutions',
    backstory: 'You are a DevOps engineer who understands distributed systems, CI/CD pipelines, and cloud infrastructure. You diagnose problems methodically and follow runbooks.',
    model: 'claude-sonnet-4-6',
  },
}
