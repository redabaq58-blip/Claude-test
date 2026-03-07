import { useEffect, useState, useCallback } from 'react'
import { historyApi } from '../api'
import type { RunRecord } from '../api'
import MarkdownRenderer from '../components/MarkdownRenderer'

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-950 text-green-400 border-green-800',
  failed: 'bg-red-950 text-red-400 border-red-800',
  running: 'bg-yellow-950 text-yellow-400 border-yellow-800',
}

const MODEL_SHORT: Record<string, string> = {
  'claude-opus-4-6': 'Opus',
  'claude-sonnet-4-6': 'Sonnet',
  'claude-haiku-4-5-20251001': 'Haiku',
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatCost(usd: number | null): string {
  if (!usd) return '—'
  if (usd < 0.001) return '<$0.001'
  return `$${usd.toFixed(4)}`
}

export default function History() {
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')

  const LIMIT = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await historyApi.list({
        limit: LIMIT,
        offset: page * LIMIT,
        status: statusFilter || undefined,
        agentId: agentFilter || undefined,
      })
      setRuns(result.data)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, agentFilter])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.ceil(total / LIMIT)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(runs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'agent-runs.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCsv = () => {
    const headers = ['id', 'agent_name', 'model', 'status', 'cost_usd', 'duration_ms', 'created_at', 'input_preview']
    const rows = runs.map((r) => [
      r.id,
      r.agent_name ?? '',
      r.model ?? '',
      r.status,
      r.cost_usd ?? '',
      r.duration_ms ?? '',
      r.created_at,
      (r.input ?? '').replace(/"/g, '""').slice(0, 100),
    ])
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'agent-runs.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Run History</h1>
          <p className="text-gray-500 text-sm">Complete audit trail of every agent interaction.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportJson}
            className="px-3 py-1.5 text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
          >
            Export JSON
          </button>
          <button
            onClick={exportCsv}
            className="px-3 py-1.5 text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
          className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-500"
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </select>
        <input
          type="text"
          placeholder="Filter by agent ID…"
          value={agentFilter}
          onChange={(e) => { setAgentFilter(e.target.value); setPage(0) }}
          className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-500 w-52"
        />
        <span className="text-gray-600 text-sm self-center">{total} total runs</span>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading history…</div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm">No runs found. Run an agent from Agent Studio to see history here.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_80px_80px_80px_100px] gap-4 px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wide">
            <span>Agent / Input</span>
            <span>Model</span>
            <span>Status</span>
            <span>Cost</span>
            <span>Duration</span>
            <span>Date</span>
          </div>

          {runs.map((run) => (
            <div key={run.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              {/* Row */}
              <button
                onClick={() => setExpanded(expanded === run.id ? null : run.id)}
                className="w-full grid grid-cols-[1fr_100px_80px_80px_80px_100px] gap-4 px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-white text-sm font-medium truncate">{run.agent_name ?? run.agent_id}</div>
                  <div className="text-gray-500 text-xs truncate mt-0.5">
                    {run.input?.slice(0, 80) ?? '—'}
                  </div>
                </div>
                <div className="text-gray-400 text-sm self-center">
                  {MODEL_SHORT[run.model ?? ''] ?? run.model ?? '—'}
                </div>
                <div className="self-center">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium border ${
                      STATUS_COLORS[run.status] ?? 'bg-gray-800 text-gray-400 border-gray-700'
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
                <div className="text-gray-400 text-sm self-center">{formatCost(run.cost_usd)}</div>
                <div className="text-gray-400 text-sm self-center">{formatDuration(run.duration_ms)}</div>
                <div className="text-gray-500 text-xs self-center">{formatDate(run.created_at)}</div>
              </button>

              {/* Expanded detail */}
              {expanded === run.id && (
                <div className="border-t border-gray-800 px-4 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                    <div>
                      <span className="text-gray-600 block mb-1">Run ID</span>
                      <code className="text-gray-400 font-mono">{run.id}</code>
                    </div>
                    <div>
                      <span className="text-gray-600 block mb-1">Tokens</span>
                      <span className="text-gray-400">
                        {run.input_tokens != null ? `${run.input_tokens} in` : '—'} /{' '}
                        {run.output_tokens != null ? `${run.output_tokens} out` : '—'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-600 mb-2 font-medium uppercase tracking-wide">Input</p>
                    <div className="bg-gray-800/60 rounded-lg p-3 text-gray-300 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {run.input ?? '—'}
                    </div>
                  </div>

                  {run.output && (
                    <div>
                      <p className="text-xs text-gray-600 mb-2 font-medium uppercase tracking-wide">Output</p>
                      <div className="bg-gray-800/60 rounded-lg p-3 max-h-80 overflow-y-auto">
                        <MarkdownRenderer content={run.output} />
                      </div>
                    </div>
                  )}

                  {run.error && (
                    <div>
                      <p className="text-xs text-red-600 mb-2 font-medium uppercase tracking-wide">Error</p>
                      <div className="bg-red-950/30 border border-red-900 rounded-lg p-3 text-red-400 text-sm font-mono">
                        {run.error}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 text-sm bg-gray-800 text-gray-300 border border-gray-700 rounded-lg disabled:opacity-40 hover:border-gray-500 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-gray-500 text-sm">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 text-sm bg-gray-800 text-gray-300 border border-gray-700 rounded-lg disabled:opacity-40 hover:border-gray-500 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
