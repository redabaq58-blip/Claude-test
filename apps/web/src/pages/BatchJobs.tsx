import { useEffect, useState } from 'react'

interface BatchJob {
  id: string
  agentId?: string
  anthropicBatchId: string
  status: 'submitted' | 'processing' | 'ended' | 'cancelled' | 'errored'
  inputCount: number
  completedCount: number
  costUsd: number
  savedCostUsd: number
  createdAt: string
  completedAt?: string
}

interface BatchResult {
  customId: string
  output: string
  error?: string
  inputTokens: number
  outputTokens: number
}

interface Agent {
  id: string
  name: string
}

const API = '/api'

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-950 text-blue-400 border-blue-800',
  processing: 'bg-yellow-950 text-yellow-400 border-yellow-800',
  ended: 'bg-green-950 text-green-400 border-green-800',
  cancelled: 'bg-gray-800 text-gray-500 border-gray-700',
  errored: 'bg-red-950 text-red-400 border-red-800',
}

export default function BatchJobs() {
  const [jobs, setJobs] = useState<BatchJob[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedJobResults, setSelectedJobResults] = useState<{ job: BatchJob; results: BatchResult[] } | null>(null)
  const [form, setForm] = useState({ agentId: '', inputs: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/batches`).then((r) => r.json()),
      fetch(`${API}/agents`).then((r) => r.json()),
    ]).then(([bRes, aRes]) => {
      setJobs((bRes.data as BatchJob[]) ?? [])
      setAgents((aRes.data as Agent[]) ?? [])
    }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false))
  }, [])

  const createBatch = async () => {
    const lines = form.inputs.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) { setError('At least one input is required'); return }
    setCreating(true); setError(null)
    try {
      const requests = lines.map((input, i) => ({ customId: `req-${i + 1}`, input }))
      const res = await fetch(`${API}/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: form.agentId || undefined, requests }),
      })
      const json = await res.json() as { data: BatchJob; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to create')
      setJobs((prev) => [json.data, ...prev])
      setShowCreate(false)
      setForm({ agentId: '', inputs: '' })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  const loadResults = async (job: BatchJob) => {
    if (job.status !== 'ended') return
    try {
      const res = await fetch(`${API}/batches/${job.id}/results`)
      const json = await res.json() as { data: BatchResult[] }
      setSelectedJobResults({ job, results: json.data ?? [] })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const cancelJob = async (id: string) => {
    await fetch(`${API}/batches/${id}/cancel`, { method: 'DELETE' })
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, status: 'cancelled' as const } : j))
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Batch Jobs</h1>
          <p className="text-gray-500 text-sm mt-1">Process multiple prompts at 50% cost using the Anthropic Batch API</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Batch
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-white font-semibold text-lg mb-4">New Batch Job</h2>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Agent (optional)</label>
                <select
                  value={form.agentId}
                  onChange={(e) => setForm((f) => ({ ...f, agentId: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">Default (no agent system prompt)</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Inputs (one per line, max 100)</label>
                <textarea
                  value={form.inputs}
                  onChange={(e) => setForm((f) => ({ ...f, inputs: e.target.value }))}
                  placeholder={'Summarize this article: ...\nTranslate to French: ...\nExplain in simple terms: ...'}
                  rows={8}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none font-mono"
                />
                <div className="text-gray-600 text-xs mt-1">
                  {form.inputs.split('\n').filter((l) => l.trim()).length} inputs · Results delivered within 24 hours at 50% cost
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">Cancel</button>
              <button onClick={createBatch} disabled={creating} className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                {creating ? 'Submitting…' : 'Submit Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results modal */}
      {selectedJobResults && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-semibold">Batch Results — {selectedJobResults.results.length} items</h2>
              <button onClick={() => setSelectedJobResults(null)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedJobResults.results.map((r) => (
                <div key={r.customId} className={`p-3 rounded-lg border text-sm ${r.error ? 'bg-red-950 border-red-800' : 'bg-gray-800 border-gray-700'}`}>
                  <div className="text-gray-500 text-xs mb-1 font-mono">{r.customId} · {(r.inputTokens + r.outputTokens).toLocaleString()} tokens</div>
                  {r.error ? (
                    <div className="text-red-400">{r.error}</div>
                  ) : (
                    <div className="text-gray-300 whitespace-pre-wrap">{r.output}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Job list */}
      {loading ? (
        <div className="text-center text-gray-600 py-16">Loading batch jobs…</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📦</div>
          <div className="text-white font-medium mb-1">No batch jobs yet</div>
          <div className="text-gray-500 text-sm">Process multiple prompts at 50% cost using the Batch API</div>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const agent = agents.find((a) => a.id === job.agentId)
            return (
              <div key={job.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[job.status] ?? ''}`}>
                        {job.status}
                      </span>
                      {agent && <span className="text-gray-400 text-xs">{agent.name}</span>}
                    </div>
                    <div className="text-gray-400 text-xs font-mono mt-1">{job.anthropicBatchId}</div>
                    <div className="flex gap-4 mt-1 text-xs text-gray-600">
                      <span>{job.completedCount}/{job.inputCount} completed</span>
                      <span>Created {new Date(job.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {job.status === 'ended' && (
                      <button
                        onClick={() => loadResults(job)}
                        className="px-3 py-1.5 bg-brand-700 hover:bg-brand-600 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        View Results
                      </button>
                    )}
                    {['submitted', 'processing'].includes(job.status) && (
                      <button
                        onClick={() => cancelJob(job.id)}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-red-950 text-gray-400 hover:text-red-400 rounded-lg text-xs border border-gray-700 hover:border-red-800 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
