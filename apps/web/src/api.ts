// ─── API Client ───────────────────────────────────────────────────────────────
// Typed fetch wrapper for all ClaudeForge API calls.

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    // Try to extract API error message, fall back to HTTP status
    let msg = `HTTP ${res.status}: ${res.statusText}`
    try {
      const json = await res.json()
      if (json?.error) msg = json.error
    } catch { /* response was not JSON */ }
    throw new Error(msg)
  }
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data as T
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomToolDef {
  name: string
  description: string
  url: string
  method?: string
  headers?: string
  inputSchema?: string
}

export interface Agent {
  id: string
  name: string
  description: string
  model: string
  systemPrompt: string
  isActive: boolean
  mcpServers?: string        // JSON string: ["web","filesystem"]
  tools?: string             // JSON string: CustomToolDef[]
  cacheEnabled?: boolean
  thinkingEnabled?: boolean
  thinkingBudget?: number
  createdAt: string
  updatedAt: string
}

export interface AgentRun {
  id: string
  agentId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  input: string
  output: string
  error?: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs: number
  model: string
  startedAt: string
  completedAt?: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  steps: string
  isActive: boolean
  createdAt: string
}

export interface WorkflowRun {
  id: string
  workflowId: string
  status: string
  stepResults: string
  startedAt: string
  completedAt?: string
}

export interface McpServer {
  id: string
  name: string
  type: string
  config: string
  status: 'connected' | 'error' | 'disabled'
  lastError?: string
  toolCount: number
  createdAt: string
}

export interface Skill {
  id: string
  name: string
  description: string
  version: string
  tags: string
  createdAt: string
}

// ─── Agents API ───────────────────────────────────────────────────────────────

export const agentsApi = {
  list: () => request<Agent[]>('/agents'),
  get: (id: string) => request<Agent>(`/agents/${id}`),
  create: (data: Partial<Agent>) =>
    request<Agent>('/agents', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Agent>) =>
    request<Agent>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/agents/${id}`, { method: 'DELETE' }),
  run: (id: string, input: string) =>
    request<AgentRun>(`/agents/${id}/run`, { method: 'POST', body: JSON.stringify({ input }) }),
  runs: (id: string, limit = 20) =>
    request<AgentRun[]>(`/agents/${id}/runs?limit=${limit}`),
}

// ─── Workflows API ────────────────────────────────────────────────────────────

export const workflowsApi = {
  list: () => request<Workflow[]>('/workflows'),
  get: (id: string) => request<Workflow>(`/workflows/${id}`),
  create: (data: { name: string; description?: string; steps: unknown[] }) =>
    request<Workflow>('/workflows', { method: 'POST', body: JSON.stringify(data) }),
  run: (id: string, context?: Record<string, string>) =>
    request<WorkflowRun>(`/workflows/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({ context }),
    }),
}

// ─── MCP API ──────────────────────────────────────────────────────────────────

export const mcpApi = {
  list: () => request<McpServer[]>('/mcp/servers'),
  create: (data: { name: string; type: string; config?: unknown }) =>
    request<McpServer>('/mcp/servers', { method: 'POST', body: JSON.stringify(data) }),
  test: (id: string) =>
    request<{ connected: boolean; toolCount?: number; tools?: string[]; error?: string }>(
      `/mcp/servers/${id}/test`,
      { method: 'POST' }
    ),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/mcp/servers/${id}`, { method: 'DELETE' }),
}

// ─── Skills API ───────────────────────────────────────────────────────────────

export const skillsApi = {
  list: () => request<Skill[]>('/skills'),
}

// ─── Analytics API ────────────────────────────────────────────────────────────

export interface CostAnalytics {
  byModel: Array<{ model: string; total_cost: number; request_count: number }>
  byDay: Array<{ date: string; total_cost: number }>
  totals: { total_cost: number; total_tokens: number; total_requests: number }
  days: number
}

export interface RunAnalytics {
  byStatus: Array<{ status: string; count: number }>
  byAgent: Array<{
    agent_name: string
    agent_id: string
    run_count: number
    success_count: number
    avg_duration_ms: number
    total_cost: number
  }>
  days: number
}

export const analyticsApi = {
  costs: (days = 30) => request<CostAnalytics>(`/analytics/costs?days=${days}`),
  runs: (days = 30) => request<RunAnalytics>(`/analytics/runs?days=${days}`),
  usage: (days = 30) =>
    request<Array<{ date: string; model: string; total_tokens: number; request_count: number }>>(
      `/analytics/usage?days=${days}`
    ),
}

// ─── Templates API ────────────────────────────────────────────────────────────

export interface AgentTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: string
  model: string
  systemPrompt: string
  suggestedPrompts: string[]
  tags: string[]
}

export const templatesApi = {
  list: () => request<AgentTemplate[]>('/templates'),
  get: (id: string) => request<AgentTemplate>(`/templates/${id}`),
  create: (id: string, name?: string) =>
    request<{ agent: Agent; template: AgentTemplate }>(`/templates/${id}/create`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
}

// ─── Prompts API ──────────────────────────────────────────────────────────────

export interface Prompt {
  id: string
  title: string
  description: string
  category: string
  model: string
  tags: string[]
  content: string
  variables: string[]
}

export const promptsApi = {
  list: () => request<Prompt[]>('/prompts'),
  byCategory: (category: string) => request<Prompt[]>(`/prompts/category/${category}`),
}

// ─── History API ──────────────────────────────────────────────────────────────

export interface RunRecord {
  id: string
  agent_id: string
  agent_name: string
  status: string
  input: string
  output: string
  error?: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  duration_ms: number
  model: string
  created_at: string
  started_at: string
  completed_at?: string
}

export const historyApi = {
  list: async (params?: { agentId?: string; status?: string; from?: string; to?: string; limit?: number; offset?: number }): Promise<{ data: RunRecord[]; total: number }> => {
    const qs = new URLSearchParams()
    if (params?.agentId) qs.set('agentId', params.agentId)
    if (params?.status) qs.set('status', params.status)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    const res = await fetch(`${BASE}/runs?${qs.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      let msg = `HTTP ${res.status}: ${res.statusText}`
      try { const j = await res.json(); if (j?.error) msg = j.error } catch { /* not JSON */ }
      throw new Error(msg)
    }
    const json = await res.json()
    if (json.error) throw new Error(json.error)
    return { data: json.data as RunRecord[], total: json.meta?.total ?? (json.data?.length ?? 0) }
  },
}

// ─── Conversations API ────────────────────────────────────────────────────────

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  usage?: { inputTokens: number; outputTokens: number; costUsd: number; model: string }
}

export interface Conversation {
  id: string
  agentId: string
  title: string
  messages?: ConversationMessage[]
  totalCostUsd: number
  createdAt: string
  updatedAt: string
}

export const conversationsApi = {
  list: () => request<Conversation[]>('/conversations'),
  get: (id: string) => request<Conversation>(`/conversations/${id}`),
  create: (agentId: string, message: string) =>
    request<Conversation>('/conversations', { method: 'POST', body: JSON.stringify({ agentId, message }) }),
  rename: (id: string, title: string) =>
    request<{ id: string; title: string }>(`/conversations/${id}/title`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/conversations/${id}`, { method: 'DELETE' }),
}

// ─── Compare API ──────────────────────────────────────────────────────────────

export interface CompareResult {
  model: string
  output: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs: number
  badges: string[]
  error: string | null
}

export const compareApi = {
  compare: (prompt: string, systemPrompt?: string, models?: string[]) =>
    request<{ results: CompareResult[]; prompt: string }>('/compare', {
      method: 'POST',
      body: JSON.stringify({ prompt, systemPrompt, models }),
    }),
}

// ─── Occupations API ──────────────────────────────────────────────────────────

export interface Occupation {
  id: string
  title: string
  description: string
  icon: string
  category: 'engineering' | 'product' | 'design' | 'data' | 'business' | 'creative' | 'science' | 'other'
  expertiseAreas: string[]
  communicationStyle: string
  systemPromptSuffix: string
}

export const occupationsApi = {
  list: () => request<Occupation[]>('/occupations'),
  get: (id: string) => request<Occupation>(`/occupations/${id}`),
  byCategory: (category: string) => request<Occupation[]>(`/occupations/category/${category}`),
}

// ─── Prompt enhance API ───────────────────────────────────────────────────────

export interface EnhanceResult {
  original: string
  enhanced: string
  improvements: string[]
  model: string
}

export const enhancePrompt = (prompt: string, style?: 'detailed' | 'concise' | 'structured') =>
  request<EnhanceResult>('/prompts/enhance', {
    method: 'POST',
    body: JSON.stringify({ prompt, style }),
  })

// ─── Agent clone/export/import ────────────────────────────────────────────────

export const agentCloneExportApi = {
  clone: (id: string) => request<Agent>(`/agents/${id}/clone`, { method: 'POST' }),
  exportUrl: (id: string) => `${BASE}/agents/${id}/export`,
  import: (data: unknown) =>
    request<Agent>('/agents/import', { method: 'POST', body: JSON.stringify(data) }),
}

// ─── Streaming helper ────────────────────────────────────────────────────────

export interface StreamChunk {
  type: 'text' | 'done' | 'error'
  text?: string
  error?: string
  runId?: string
  usage?: { inputTokens: number; outputTokens: number; costUsd: number; durationMs: number; model: string }
}

export async function* streamAgent(agentId: string, input: string): AsyncGenerator<StreamChunk> {
  const response = await fetch(`/api/agents/${agentId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  })

  if (!response.ok || !response.body) {
    throw new Error(`Stream failed: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const chunk = JSON.parse(line.slice(6)) as StreamChunk
          yield chunk
          if (chunk.type === 'done' || chunk.type === 'error') return
        } catch {
          // skip malformed SSE line
        }
      }
    }
  }
}

// ─── Forge API ─────────────────────────────────────────────────────────────────

export interface ForgeAgent {
  role: string
  goal?: string
  backstory?: string
  model?: string
  when?: string
  goto?: string
  as?: string
}

export interface ForgeThread {
  threadId: string
  goal: string
  status: 'running' | 'interrupted' | 'completed' | 'failed'
  output: string
  resumePrompt?: string
  steps: Array<{ agent: string; output: string; costUsd: number; status: string }>
  costUsd: number
  durationMs: number
  currentStep: number
  createdAt: string
}

export const forgeApi = {
  run: (agents: ForgeAgent[], goal: string, options?: Record<string, unknown>) =>
    request<{ threadId: string; status: string }>('/forge/run', {
      method: 'POST',
      body: JSON.stringify({ agents, goal, options }),
    }),

  listThreads: () => request<ForgeThread[]>('/forge/threads'),

  getThread: (threadId: string) =>
    request<ForgeThread>(`/forge/threads/${threadId}`),

  resume: (threadId: string, value: string) =>
    request<{ threadId: string; status: string }>(`/forge/threads/${threadId}/resume`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    }),

  deleteThread: (threadId: string) =>
    request<{ deleted: boolean }>(`/forge/threads/${threadId}`, { method: 'DELETE' }),

  getRoles: () =>
    request<Array<{ key: string; role: string; goal?: string; backstory?: string; model?: string }>>('/forge/roles'),
}

// ─── Playground API ────────────────────────────────────────────────────────────

export async function* streamPlayground(
  userMessage: string,
  model: string,
  systemPrompt?: string
): AsyncGenerator<StreamChunk> {
  const response = await fetch('/api/playground/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userMessage, model, systemPrompt }),
  })

  if (!response.ok || !response.body) {
    throw new Error(`Stream failed: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const chunk = JSON.parse(line.slice(6)) as StreamChunk
          yield chunk
          if (chunk.type === 'done' || chunk.type === 'error') return
        } catch {
          // skip malformed SSE line
        }
      }
    }
  }
}
