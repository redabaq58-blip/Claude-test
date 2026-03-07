// ─── API Client ───────────────────────────────────────────────────────────────
// Typed fetch wrapper for all ClaudeForge API calls.

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data as T
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Agent {
  id: string
  name: string
  description: string
  model: string
  systemPrompt: string
  isActive: boolean
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
