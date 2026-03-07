import { useEffect, useRef, useState } from 'react'
import { agentsApi, streamAgent } from '../api'
import type { Agent } from '../api'

const MODELS = [
  { value: 'auto', label: 'Auto (smart routing)' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (balanced)' },
  { value: 'claude-opus-4-6', label: 'Opus 4.6 (powerful)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (fast)' },
]

function Badge({ text, color }: { text: string; color: 'green' | 'gray' | 'red' }) {
  const cls = {
    green: 'bg-green-950 text-green-400',
    gray: 'bg-gray-800 text-gray-400',
    red: 'bg-red-950 text-red-400',
  }[color]
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{text}</span>
}

export default function AgentStudio() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editAgent, setEditAgent] = useState<Agent | null>(null)
  const [runInput, setRunInput] = useState<Record<string, string>>({})
  const [runResults, setRunResults] = useState<Record<string, string>>({})
  const [runUsage, setRunUsage] = useState<Record<string, { costUsd: number; totalTokens: number }>>({})
  const [running, setRunning] = useState<Record<string, boolean>>({})
  const abortRef = useRef<Record<string, boolean>>({})

  const [form, setForm] = useState({
    name: '',
    description: '',
    model: 'auto',
    systemPrompt: '',
  })

  const load = () =>
    agentsApi.list().then(setAgents).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditAgent(null)
    setForm({ name: '', description: '', model: 'auto', systemPrompt: '' })
    setShowForm(true)
  }

  const openEdit = (agent: Agent) => {
    setEditAgent(agent)
    setForm({
      name: agent.name,
      description: agent.description,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    if (editAgent) {
      await agentsApi.update(editAgent.id, form)
    } else {
      await agentsApi.create(form)
    }
    setShowForm(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agent?')) return
    await agentsApi.delete(id)
    load()
  }

  const handleRun = async (agent: Agent) => {
    const input = runInput[agent.id]?.trim()
    if (!input) return
    setRunning((r) => ({ ...r, [agent.id]: true }))
    setRunResults((r) => ({ ...r, [agent.id]: '' }))
    setRunUsage((u) => ({ ...u, [agent.id]: { costUsd: 0, totalTokens: 0 } }))
    abortRef.current[agent.id] = false
    try {
      for await (const chunk of streamAgent(agent.id, input)) {
        if (abortRef.current[agent.id]) break
        if (chunk.type === 'text' && chunk.text) {
          setRunResults((r) => ({ ...r, [agent.id]: (r[agent.id] ?? '') + chunk.text }))
        } else if (chunk.type === 'done' && chunk.usage) {
          setRunUsage((u) => ({
            ...u,
            [agent.id]: {
              costUsd: chunk.usage!.costUsd,
              totalTokens: chunk.usage!.inputTokens + chunk.usage!.outputTokens,
            },
          }))
        } else if (chunk.type === 'error') {
          setRunResults((r) => ({ ...r, [agent.id]: `Error: ${chunk.error}` }))
        }
      }
    } catch (err) {
      setRunResults((r) => ({ ...r, [agent.id]: `Error: ${err instanceof Error ? err.message : String(err)}` }))
    } finally {
      setRunning((r) => ({ ...r, [agent.id]: false }))
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Agent Studio</h1>
          <p className="text-gray-500 text-sm">Create and manage Claude agents</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Agent
        </button>
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold text-white mb-5">
              {editAgent ? 'Edit Agent' : 'Create Agent'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="My Research Agent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does this agent do?"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Model</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                >
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">System Prompt</label>
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500 h-28 resize-none"
                  value={form.systemPrompt}
                  onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                  placeholder="You are a helpful assistant specialized in..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {editAgent ? 'Save Changes' : 'Create Agent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent cards */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading agents…</div>
      ) : agents.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-12 text-center">
          <div className="text-gray-600 text-4xl mb-3">◈</div>
          <p className="text-gray-400 text-sm mb-4">No agents yet. Create your first Claude agent.</p>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium"
          >
            Create Agent
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{agent.name}</h3>
                    <Badge text={agent.model} color="gray" />
                    <Badge text={agent.isActive ? 'Active' : 'Inactive'} color={agent.isActive ? 'green' : 'gray'} />
                  </div>
                  {agent.description && (
                    <p className="text-gray-500 text-sm mt-1">{agent.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(agent)}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(agent.id)}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-red-950 text-gray-400 hover:text-red-400 rounded-lg text-xs transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Inline run */}
              <div className="mt-4 pt-4 border-t border-gray-800">
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500 placeholder-gray-600"
                    placeholder="Enter a prompt to run this agent…"
                    value={runInput[agent.id] ?? ''}
                    onChange={(e) => setRunInput((r) => ({ ...r, [agent.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && !running[agent.id] && handleRun(agent)}
                  />
                  <button
                    onClick={() => {
                      if (running[agent.id]) {
                        abortRef.current[agent.id] = true
                      } else {
                        handleRun(agent)
                      }
                    }}
                    className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${
                      running[agent.id]
                        ? 'bg-red-700 hover:bg-red-800'
                        : 'bg-brand-600 hover:bg-brand-700'
                    }`}
                  >
                    {running[agent.id] ? '■ Stop' : 'Run ▶'}
                  </button>
                </div>
                {runResults[agent.id] && (
                  <div className="mt-3 bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-gray-300 whitespace-pre-wrap max-h-48 overflow-auto font-mono">
                    {runResults[agent.id]}
                    {running[agent.id] && (
                      <span className="inline-block w-1.5 h-4 bg-brand-500 animate-pulse ml-0.5 align-text-bottom" />
                    )}
                  </div>
                )}
                {runUsage[agent.id]?.costUsd > 0 && !running[agent.id] && (
                  <div className="mt-1.5 flex gap-4 text-xs text-gray-600">
                    <span>{runUsage[agent.id].totalTokens.toLocaleString()} tokens</span>
                    <span>${runUsage[agent.id].costUsd.toFixed(5)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
