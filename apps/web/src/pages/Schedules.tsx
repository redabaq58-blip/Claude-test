import { useEffect, useState } from 'react'

interface Schedule {
  id: string
  workflowId: string
  name: string
  type: 'cron' | 'webhook'
  cronExpression?: string
  webhookSecret?: string
  isActive: boolean
  lastRunAt?: string
  nextRunAt?: string
  createdAt: string
}

interface Workflow {
  id: string
  name: string
}

const API = '/api'

function formatDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

// Human-readable cron descriptions for common patterns
function describeCron(expr: string): string {
  const map: Record<string, string> = {
    '0 9 * * *': 'Every day at 9:00 AM',
    '0 * * * *': 'Every hour',
    '*/5 * * * *': 'Every 5 minutes',
    '0 0 * * *': 'Every day at midnight',
    '0 9 * * 1': 'Every Monday at 9:00 AM',
    '0 9 * * 1-5': 'Weekdays at 9:00 AM',
  }
  return map[expr] ?? expr
}

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    workflowId: '',
    name: '',
    type: 'cron' as 'cron' | 'webhook',
    cronExpression: '0 9 * * *',
    webhookSecret: '',
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/schedules`).then((r) => r.json()),
      fetch(`${API}/workflows`).then((r) => r.json()),
    ]).then(([sRes, wRes]) => {
      setSchedules((sRes.data as Schedule[]) ?? [])
      setWorkflows((wRes.data as Workflow[]) ?? [])
    }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false))
  }, [])

  const createSchedule = async () => {
    if (!form.workflowId || !form.name) { setError('Workflow and name are required'); return }
    setCreating(true); setError(null)
    try {
      const res = await fetch(`${API}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: form.workflowId,
          name: form.name,
          type: form.type,
          cronExpression: form.type === 'cron' ? form.cronExpression : undefined,
          webhookSecret: form.webhookSecret || undefined,
        }),
      })
      const json = await res.json() as { data: Schedule; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to create')
      setSchedules((prev) => [json.data, ...prev])
      setShowCreate(false)
      setForm({ workflowId: '', name: '', type: 'cron', cronExpression: '0 9 * * *', webhookSecret: '' })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (s: Schedule) => {
    await fetch(`${API}/schedules/${s.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !s.isActive }),
    })
    setSchedules((prev) => prev.map((x) => x.id === s.id ? { ...x, isActive: !x.isActive } : x))
  }

  const deleteSchedule = async (id: string) => {
    if (!confirm('Delete this schedule?')) return
    await fetch(`${API}/schedules/${id}`, { method: 'DELETE' })
    setSchedules((prev) => prev.filter((x) => x.id !== id))
  }

  const CRON_PRESETS = [
    { label: 'Every day at 9 AM', value: '0 9 * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every 5 minutes', value: '*/5 * * * *' },
    { label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
    { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
    { label: 'Daily at midnight', value: '0 0 * * *' },
  ]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Schedules</h1>
          <p className="text-gray-500 text-sm mt-1">Trigger workflows automatically on a cron schedule or via webhook</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Schedule
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-white font-semibold text-lg mb-4">Create Schedule</h2>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Workflow</label>
                <select
                  value={form.workflowId}
                  onChange={(e) => setForm((f) => ({ ...f, workflowId: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">Select a workflow…</option>
                  {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-xs mb-1 block">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Daily report"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>

              <div>
                <label className="text-gray-400 text-xs mb-1 block">Type</label>
                <div className="flex gap-3">
                  {(['cron', 'webhook'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        form.type === t ? 'bg-brand-600 border-brand-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'
                      }`}
                    >
                      {t === 'cron' ? '⏰ Cron' : '🔗 Webhook'}
                    </button>
                  ))}
                </div>
              </div>

              {form.type === 'cron' && (
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Cron Expression</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {CRON_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setForm((f) => ({ ...f, cronExpression: p.value }))}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          form.cronExpression === p.value
                            ? 'bg-brand-700 border-brand-500 text-white'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <input
                    value={form.cronExpression}
                    onChange={(e) => setForm((f) => ({ ...f, cronExpression: e.target.value }))}
                    placeholder="0 9 * * *"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono"
                  />
                  <div className="text-gray-500 text-xs mt-1">{describeCron(form.cronExpression)}</div>
                </div>
              )}

              {form.type === 'webhook' && (
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Webhook Secret (optional)</label>
                  <input
                    value={form.webhookSecret}
                    onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))}
                    placeholder="Leave blank for no signature validation"
                    type="password"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <div className="text-gray-600 text-xs mt-1">If set, requests must include X-Webhook-Signature: sha256=&lt;hmac&gt;</div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
                Cancel
              </button>
              <button onClick={createSchedule} disabled={creating} className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {creating ? 'Creating…' : 'Create Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule list */}
      {loading ? (
        <div className="text-center text-gray-600 py-16">Loading schedules…</div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">⏰</div>
          <div className="text-white font-medium mb-1">No schedules yet</div>
          <div className="text-gray-500 text-sm">Create a schedule to run workflows automatically</div>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => {
            const workflow = workflows.find((w) => w.id === s.workflowId)
            const webhookUrl = `${window.location.origin}/api/schedules/webhook/${s.id}/trigger`
            return (
              <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium text-sm">{s.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        s.type === 'cron' ? 'bg-blue-950 text-blue-400 border-blue-800' : 'bg-purple-950 text-purple-400 border-purple-800'
                      }`}>
                        {s.type === 'cron' ? '⏰ Cron' : '🔗 Webhook'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        s.isActive ? 'bg-green-950 text-green-400 border-green-800' : 'bg-gray-800 text-gray-500 border-gray-700'
                      }`}>
                        {s.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="text-gray-500 text-xs">
                      Workflow: {workflow?.name ?? s.workflowId}
                    </div>
                    {s.type === 'cron' && s.cronExpression && (
                      <div className="text-gray-500 text-xs mt-0.5">
                        Schedule: <span className="text-gray-400 font-mono">{s.cronExpression}</span> — {describeCron(s.cronExpression)}
                      </div>
                    )}
                    {s.type === 'webhook' && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-gray-500 text-xs">URL:</span>
                        <code className="text-xs text-brand-400 bg-gray-800 px-2 py-0.5 rounded font-mono truncate max-w-sm">
                          {webhookUrl}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(webhookUrl)}
                          className="text-xs text-gray-500 hover:text-white transition-colors"
                          title="Copy URL"
                        >
                          ⎘
                        </button>
                      </div>
                    )}
                    <div className="flex gap-4 mt-1 text-xs text-gray-600">
                      <span>Last run: {formatDate(s.lastRunAt)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleActive(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        s.isActive
                          ? 'bg-gray-800 hover:bg-gray-700 text-gray-400 border-gray-700'
                          : 'bg-green-950 hover:bg-green-900 text-green-400 border-green-800'
                      }`}
                    >
                      {s.isActive ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      onClick={() => deleteSchedule(s.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-gray-800 hover:bg-red-950 text-gray-500 hover:text-red-400 border-gray-700 hover:border-red-800 transition-colors"
                    >
                      Delete
                    </button>
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
