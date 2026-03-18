import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { agentsApi, streamAgent, enhancePrompt, agentCloneExportApi } from '../api'
import type { Agent, EnhanceResult } from '../api'
import MarkdownRenderer from '../components/MarkdownRenderer'

const MODELS = [
  { value: 'auto', label: 'Auto (smart routing)' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (balanced)' },
  { value: 'claude-opus-4-6', label: 'Opus 4.6 (powerful)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (fast)' },
]

const MODEL_BADGE: Record<string, string> = {
  'auto': 'bg-gray-800 text-gray-400',
  'claude-opus-4-6': 'bg-purple-950 text-purple-400',
  'claude-sonnet-4-6': 'bg-green-950 text-green-400',
  'claude-haiku-4-5-20251001': 'bg-yellow-950 text-yellow-400',
}

export default function AgentStudio() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editAgent, setEditAgent] = useState<Agent | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importError, setImportError] = useState('')

  // Run state
  const [runInput, setRunInput] = useState<Record<string, string>>({})
  const [runResults, setRunResults] = useState<Record<string, string>>({})
  const [runUsage, setRunUsage] = useState<Record<string, { costUsd: number; totalTokens: number }>>({})
  const [running, setRunning] = useState<Record<string, boolean>>({})
  const abortRef = useRef<Record<string, boolean>>({})

  // Enhance state
  const [enhancing, setEnhancing] = useState<Record<string, boolean>>({})
  const [enhanceResult, setEnhanceResult] = useState<Record<string, EnhanceResult | null>>({})

  // Three-dot menu
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', description: '', model: 'auto', systemPrompt: '',
    cacheEnabled: false, thinkingEnabled: false, thinkingBudget: 8000,
  })

  const load = () => agentsApi.list().then(setAgents).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  // Close menu on click outside
  useEffect(() => {
    const handler = () => setMenuOpen(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [])

  const openCreate = () => {
    setEditAgent(null)
    setForm({ name: '', description: '', model: 'auto', systemPrompt: '', cacheEnabled: false, thinkingEnabled: false, thinkingBudget: 8000 })
    setShowForm(true)
  }

  const openEdit = (agent: Agent) => {
    setEditAgent(agent)
    setForm({
      name: agent.name, description: agent.description, model: agent.model, systemPrompt: agent.systemPrompt,
      cacheEnabled: (agent as { cacheEnabled?: boolean }).cacheEnabled ?? false,
      thinkingEnabled: (agent as { thinkingEnabled?: boolean }).thinkingEnabled ?? false,
      thinkingBudget: (agent as { thinkingBudget?: number }).thinkingBudget ?? 8000,
    })
    setShowForm(true)
    setMenuOpen(null)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    if (editAgent) { await agentsApi.update(editAgent.id, form) }
    else { await agentsApi.create(form) }
    setShowForm(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agent? This cannot be undone.')) return
    await agentsApi.delete(id)
    setMenuOpen(null)
    load()
  }

  const handleClone = async (id: string) => {
    await agentCloneExportApi.clone(id)
    setMenuOpen(null)
    load()
  }

  const handleExport = (id: string) => {
    window.open(agentCloneExportApi.exportUrl(id), '_blank')
    setMenuOpen(null)
  }

  const handleImport = async () => {
    setImportError('')
    try {
      const data = JSON.parse(importJson)
      await agentCloneExportApi.import(data)
      setShowImport(false)
      setImportJson('')
      load()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Invalid JSON or format')
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImportJson(ev.target?.result as string ?? '')
    reader.readAsText(file)
  }

  const handleRun = async (agent: Agent) => {
    const input = runInput[agent.id]?.trim()
    if (!input) return
    setRunning((r) => ({ ...r, [agent.id]: true }))
    setRunResults((r) => ({ ...r, [agent.id]: '' }))
    setRunUsage((u) => ({ ...u, [agent.id]: { costUsd: 0, totalTokens: 0 } }))
    setEnhanceResult((e) => ({ ...e, [agent.id]: null }))
    abortRef.current[agent.id] = false
    try {
      for await (const chunk of streamAgent(agent.id, input)) {
        if (abortRef.current[agent.id]) break
        if (chunk.type === 'text' && chunk.text) {
          setRunResults((r) => ({ ...r, [agent.id]: (r[agent.id] ?? '') + chunk.text }))
        } else if (chunk.type === 'done' && chunk.usage) {
          setRunUsage((u) => ({
            ...u,
            [agent.id]: { costUsd: chunk.usage!.costUsd, totalTokens: chunk.usage!.inputTokens + chunk.usage!.outputTokens },
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

  const handleEnhance = async (agentId: string) => {
    const prompt = runInput[agentId]?.trim()
    if (!prompt) return
    setEnhancing((e) => ({ ...e, [agentId]: true }))
    setEnhanceResult((e) => ({ ...e, [agentId]: null }))
    try {
      const result = await enhancePrompt(prompt)
      setEnhanceResult((e) => ({ ...e, [agentId]: result }))
      setRunInput((r) => ({ ...r, [agentId]: result.enhanced }))
    } catch {
      // silently fail — keep original
    } finally {
      setEnhancing((e) => ({ ...e, [agentId]: false }))
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Agent Studio</h1>
          <p className="text-gray-500 text-sm">Create, run, and manage your Claude agents</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Import Agent
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + New Agent
          </button>
        </div>
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
                  autoFocus
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
                  {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">System Prompt</label>
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500 h-32 resize-none"
                  value={form.systemPrompt}
                  onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                  placeholder="You are a helpful assistant specialized in…"
                />
                <div className="text-xs text-gray-600 text-right mt-1">{form.systemPrompt.length} chars</div>
              </div>

              {/* Feature flags */}
              <div className="space-y-3 pt-2 border-t border-gray-800">
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Advanced Features</div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.cacheEnabled}
                    onChange={(e) => setForm({ ...form, cacheEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-brand-500"
                  />
                  <div>
                    <div className="text-white text-sm">Prompt Caching</div>
                    <div className="text-gray-500 text-xs">Cache system prompt for up to 90% cost reduction on repeat calls</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.thinkingEnabled}
                    onChange={(e) => setForm({ ...form, thinkingEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-brand-500"
                  />
                  <div>
                    <div className="text-white text-sm">Extended Thinking</div>
                    <div className="text-gray-500 text-xs">Enable Claude's reasoning chain — visible in Chat as amber panel (Opus only)</div>
                  </div>
                </label>
                {form.thinkingEnabled && (
                  <div className="ml-7">
                    <label className="text-gray-400 text-xs mb-1 block">Thinking Budget (tokens): {form.thinkingBudget.toLocaleString()}</label>
                    <input
                      type="range"
                      min={1024}
                      max={32000}
                      step={1024}
                      value={form.thinkingBudget}
                      onChange={(e) => setForm({ ...form, thinkingBudget: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                      <span>1K</span><span>32K</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
                Cancel
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium">
                {editAgent ? 'Save Changes' : 'Create Agent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold text-white mb-5">Import Agent</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Upload .json file</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-700 file:text-gray-300 file:text-sm hover:file:bg-gray-600"
                />
              </div>
              <div className="text-xs text-gray-600 text-center">— or paste JSON —</div>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs font-mono outline-none focus:border-brand-500 h-36 resize-none"
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder='{"claudeforge_version": "1.0", "agent": {"name": "..."}}'
              />
              {importError && <div className="text-red-400 text-xs bg-red-950/30 border border-red-900 rounded px-3 py-2">{importError}</div>}
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => { setShowImport(false); setImportJson(''); setImportError('') }} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
                Cancel
              </button>
              <button onClick={handleImport} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium">
                Import
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
          <p className="text-gray-400 text-sm mb-4">No agents yet. Create your first one or browse Templates.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={openCreate} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium">
              Create Agent
            </button>
            <button onClick={() => navigate('/templates')} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg text-sm">
              Browse Templates
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-white">{agent.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MODEL_BADGE[agent.model] ?? 'bg-gray-800 text-gray-400'}`}>
                      {agent.model.replace('claude-', '').replace('-20251001', '')}
                    </span>
                    {agent.isActive && <span className="w-2 h-2 bg-green-400 rounded-full" title="Active" />}
                  </div>
                  {agent.description && <p className="text-gray-500 text-sm mt-1 truncate max-w-lg">{agent.description}</p>}
                </div>

                {/* Actions: Chat button + 3-dot menu */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => navigate(`/chat?agentId=${agent.id}`)}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    ◉ Chat
                  </button>
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === agent.id ? null : agent.id) }}
                      className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-sm transition-colors"
                    >
                      ···
                    </button>
                    {menuOpen === agent.id && (
                      <div
                        className="absolute right-0 top-9 z-20 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-1 w-40"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button onClick={() => openEdit(agent)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white">
                          Edit
                        </button>
                        <button onClick={() => handleClone(agent.id)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white">
                          Clone
                        </button>
                        <button onClick={() => handleExport(agent.id)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white">
                          Export JSON
                        </button>
                        <div className="h-px bg-gray-800 my-1" />
                        <button onClick={() => handleDelete(agent.id)} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-950/40">
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick run */}
              <div className="mt-3 pt-3 border-t border-gray-800">
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500 placeholder-gray-600"
                    placeholder="Quick run — Enter a prompt…"
                    value={runInput[agent.id] ?? ''}
                    onChange={(e) => setRunInput((r) => ({ ...r, [agent.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !running[agent.id] && handleRun(agent)}
                  />
                  {/* Enhance button */}
                  <button
                    onClick={() => handleEnhance(agent.id)}
                    disabled={!runInput[agent.id]?.trim() || enhancing[agent.id]}
                    title="✨ Use Claude to improve this prompt"
                    className="px-3 py-2 bg-gray-800 hover:bg-yellow-950 text-gray-400 hover:text-yellow-400 border border-gray-700 hover:border-yellow-800 rounded-lg text-sm transition-colors disabled:opacity-40"
                  >
                    {enhancing[agent.id] ? (
                      <span className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin inline-block" />
                    ) : '✨'}
                  </button>
                  {/* Run/Stop */}
                  <button
                    onClick={() => running[agent.id] ? (abortRef.current[agent.id] = true) : handleRun(agent)}
                    disabled={!runInput[agent.id]?.trim() && !running[agent.id]}
                    className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
                      running[agent.id] ? 'bg-red-700 hover:bg-red-800' : 'bg-brand-600 hover:bg-brand-700'
                    }`}
                  >
                    {running[agent.id] ? '■' : '▶'}
                  </button>
                </div>

                {/* Enhance result */}
                {enhanceResult[agent.id] && (
                  <div className="mt-2 bg-yellow-950/20 border border-yellow-900/50 rounded-lg px-3 py-2">
                    <div className="text-xs font-medium text-yellow-400 mb-1">✨ Prompt enhanced</div>
                    <div className="flex flex-wrap gap-1">
                      {enhanceResult[agent.id]!.improvements.map((imp, i) => (
                        <span key={i} className="text-xs bg-yellow-950/40 text-yellow-500 border border-yellow-900/50 px-2 py-0.5 rounded-full">
                          {imp}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        setRunInput((r) => ({ ...r, [agent.id]: enhanceResult[agent.id]!.original }))
                        setEnhanceResult((e) => ({ ...e, [agent.id]: null }))
                      }}
                      className="text-xs text-gray-600 hover:text-gray-400 mt-1 transition-colors"
                    >
                      ↩ Undo enhancement
                    </button>
                  </div>
                )}

                {/* Streaming output */}
                {runResults[agent.id] && (
                  <div className="mt-3 bg-gray-950 border border-gray-800 rounded-lg p-4 max-h-80 overflow-auto">
                    <MarkdownRenderer content={runResults[agent.id]} />
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
