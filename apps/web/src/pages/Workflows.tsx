import { useEffect, useState } from 'react'
import { workflowsApi, agentsApi } from '../api'
import type { Workflow, Agent } from '../api'

export default function Workflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [runResults, setRunResults] = useState<Record<string, string>>({})
  const [running, setRunning] = useState<Record<string, boolean>>({})

  const [form, setForm] = useState({
    name: '',
    description: '',
    steps: [{ agentId: '', inputTemplate: '{{input}}', outputKey: 'step1' }],
  })

  const load = () =>
    Promise.all([workflowsApi.list(), agentsApi.list()])
      .then(([w, a]) => { setWorkflows(w); setAgents(a) })
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const addStep = () =>
    setForm((f) => ({
      ...f,
      steps: [...f.steps, { agentId: '', inputTemplate: '{{previous}}', outputKey: `step${f.steps.length + 1}` }],
    }))

  const updateStep = (i: number, key: string, value: string) =>
    setForm((f) => {
      const steps = [...f.steps]
      steps[i] = { ...steps[i], [key]: value }
      return { ...f, steps }
    })

  const removeStep = (i: number) =>
    setForm((f) => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }))

  const handleCreate = async () => {
    if (!form.name.trim()) return
    await workflowsApi.create({ name: form.name, description: form.description, steps: form.steps })
    setShowForm(false)
    setForm({ name: '', description: '', steps: [{ agentId: '', inputTemplate: '{{input}}', outputKey: 'step1' }] })
    load()
  }

  const handleRun = async (workflow: Workflow) => {
    const input = prompt(`Enter input for workflow "${workflow.name}":`)
    if (!input) return
    setRunning((r) => ({ ...r, [workflow.id]: true }))
    try {
      const result = await workflowsApi.run(workflow.id, { input })
      const steps = JSON.parse(result.stepResults ?? '[]') as Array<{ step: number; output: string }>
      const last = steps[steps.length - 1]
      setRunResults((r) => ({ ...r, [workflow.id]: last?.output ?? 'No output' }))
    } catch (err) {
      setRunResults((r) => ({
        ...r,
        [workflow.id]: `Error: ${err instanceof Error ? err.message : String(err)}`,
      }))
    } finally {
      setRunning((r) => ({ ...r, [workflow.id]: false }))
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Workflows</h1>
          <p className="text-gray-500 text-sm">Chain multiple agents into automated pipelines</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium"
        >
          + New Workflow
        </button>
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-xl max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-semibold text-white mb-5">Create Workflow</h2>
            <div className="space-y-4">
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500"
                placeholder="Workflow name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500"
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm text-gray-400">Steps</label>
                  <button onClick={addStep} className="text-brand-500 hover:text-brand-400 text-xs">
                    + Add Step
                  </button>
                </div>
                <div className="space-y-3">
                  {form.steps.map((step, i) => (
                    <div key={i} className="bg-gray-800 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium">Step {i + 1}</span>
                        {form.steps.length > 1 && (
                          <button onClick={() => removeStep(i)} className="text-red-500 hover:text-red-400 text-xs">
                            Remove
                          </button>
                        )}
                      </div>
                      <select
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-xs outline-none"
                        value={step.agentId}
                        onChange={(e) => updateStep(i, 'agentId', e.target.value)}
                      >
                        <option value="">Select agent…</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                      <input
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-xs outline-none"
                        placeholder="Input template (use {{input}} or {{previous}})"
                        value={step.inputTemplate}
                        onChange={(e) => updateStep(i, 'inputTemplate', e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow list */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading…</div>
      ) : workflows.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-12 text-center">
          <div className="text-gray-600 text-4xl mb-3">⟳</div>
          <p className="text-gray-400 text-sm">No workflows yet. Chain agents into pipelines.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((wf) => {
            const steps = JSON.parse(wf.steps ?? '[]') as unknown[]
            return (
              <div key={wf.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white">{wf.name}</h3>
                  <button
                    onClick={() => handleRun(wf)}
                    disabled={running[wf.id]}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
                  >
                    {running[wf.id] ? 'Running…' : '▶ Run'}
                  </button>
                </div>
                {wf.description && <p className="text-gray-500 text-sm mb-2">{wf.description}</p>}
                <p className="text-gray-600 text-xs">{steps.length} step{steps.length !== 1 ? 's' : ''}</p>
                {runResults[wf.id] && (
                  <div className="mt-3 bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-gray-300 whitespace-pre-wrap max-h-40 overflow-auto">
                    {runResults[wf.id]}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
