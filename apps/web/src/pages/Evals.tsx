import { useEffect, useState } from 'react'

interface EvalCase {
  id: string
  input: string
  expectedOutput?: string
  criteria?: string
  scoreMethod: 'exact_match' | 'contains' | 'llm_judge' | 'regex'
  pattern?: string
}

interface EvalSuite {
  id: string
  name: string
  description: string
  agentId?: string
  cases: string  // JSON
  createdAt: string
}

interface EvalRun {
  id: string
  suiteId: string
  agentId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  averageScore?: number
  caseResults: string  // JSON
  costUsd: number
  createdAt: string
  completedAt?: string
}

interface CaseResult {
  caseId: string
  input: string
  output: string
  score: number
  rationale?: string
  passed: boolean
}

interface Agent {
  id: string
  name: string
}

const API = '/api'

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 4 ? 'text-green-400 border-green-800 bg-green-950'
    : score >= 3 ? 'text-yellow-400 border-yellow-800 bg-yellow-950'
    : 'text-red-400 border-red-800 bg-red-950'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${color}`}>{score}/5</span>
  )
}

export default function Evals() {
  const [suites, setSuites] = useState<EvalSuite[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [runs, setRuns] = useState<EvalRun[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSuite, setSelectedSuite] = useState<EvalSuite | null>(null)
  const [selectedRun, setSelectedRun] = useState<EvalRun | null>(null)
  const [showCreateSuite, setShowCreateSuite] = useState(false)
  const [runningFor, setRunningFor] = useState<string | null>(null)
  const [runAgentId, setRunAgentId] = useState('')
  const [error, setError] = useState<string | null>(null)

  // New suite form
  const [suiteName, setSuiteName] = useState('')
  const [suiteDesc, setSuiteDesc] = useState('')
  const [cases, setCases] = useState<Omit<EvalCase, 'id'>[]>([
    { input: '', scoreMethod: 'llm_judge', criteria: 'The response should be helpful and accurate.' }
  ])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/evals/suites`).then((r) => r.json()),
      fetch(`${API}/agents`).then((r) => r.json()),
      fetch(`${API}/evals/runs`).then((r) => r.json()),
    ]).then(([sRes, aRes, rRes]) => {
      setSuites((sRes.data as EvalSuite[]) ?? [])
      setAgents((aRes.data as Agent[]) ?? [])
      setRuns((rRes.data as EvalRun[]) ?? [])
    }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false))
  }, [])

  const createSuite = async () => {
    if (!suiteName) { setError('Suite name is required'); return }
    if (cases.some((c) => !c.input)) { setError('All cases need an input'); return }
    setSaving(true); setError(null)
    try {
      const casesWithIds = cases.map((c, i) => ({ ...c, id: `case-${i + 1}` }))
      const res = await fetch(`${API}/evals/suites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: suiteName, description: suiteDesc, cases: casesWithIds }),
      })
      const json = await res.json() as { data: EvalSuite; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to create')
      setSuites((prev) => [json.data, ...prev])
      setShowCreateSuite(false)
      setSuiteName(''); setSuiteDesc(''); setCases([{ input: '', scoreMethod: 'llm_judge', criteria: 'The response should be helpful and accurate.' }])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const runEval = async (suiteId: string, agentId: string) => {
    if (!agentId) { setError('Select an agent to run against'); return }
    setRunningFor(suiteId); setError(null)
    try {
      const res = await fetch(`${API}/evals/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiteId, agentId }),
      })
      const json = await res.json() as { data: { runId: string; status: string }; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to start run')
      const newRun: EvalRun = {
        id: json.data.runId,
        suiteId,
        agentId,
        status: 'running',
        caseResults: '[]',
        costUsd: 0,
        createdAt: new Date().toISOString(),
      }
      setRuns((prev) => [newRun, ...prev])

      // Poll for completion
      const poll = setInterval(async () => {
        const r = await fetch(`${API}/evals/runs/${json.data.runId}`)
        const rj = await r.json() as { data: EvalRun }
        if (['completed', 'failed'].includes(rj.data.status)) {
          clearInterval(poll)
          setRuns((prev) => prev.map((x) => x.id === json.data.runId ? rj.data : x))
          setRunningFor(null)
        }
      }, 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setRunningFor(null)
    }
  }

  const deleteSuite = async (id: string) => {
    if (!confirm('Delete this suite?')) return
    await fetch(`${API}/evals/suites/${id}`, { method: 'DELETE' })
    setSuites((prev) => prev.filter((s) => s.id !== id))
  }

  const addCase = () => setCases((prev) => [...prev, { input: '', scoreMethod: 'llm_judge', criteria: '' }])
  const removeCase = (i: number) => setCases((prev) => prev.filter((_, j) => j !== i))
  const updateCase = (i: number, update: Partial<Omit<EvalCase, 'id'>>) =>
    setCases((prev) => prev.map((c, j) => j === i ? { ...c, ...update } : c))

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Evaluations</h1>
          <p className="text-gray-500 text-sm mt-1">Test your agents with structured eval suites. Claude Haiku scores responses automatically.</p>
        </div>
        <button
          onClick={() => setShowCreateSuite(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Suite
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Run detail modal */}
      {selectedRun && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">Run Results</h2>
                {selectedRun.averageScore !== undefined && (
                  <p className="text-gray-400 text-xs mt-0.5">Average score: {selectedRun.averageScore.toFixed(1)}/5</p>
                )}
              </div>
              <button onClick={() => setSelectedRun(null)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(JSON.parse(selectedRun.caseResults ?? '[]') as CaseResult[]).map((r, i) => (
                <div key={i} className={`p-3 rounded-lg border text-sm ${r.passed ? 'border-gray-700 bg-gray-800' : 'border-red-900 bg-red-950'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <ScoreBadge score={r.score} />
                    <span className={`text-xs ${r.passed ? 'text-green-400' : 'text-red-400'}`}>{r.passed ? '✓ Passed' : '✗ Failed'}</span>
                  </div>
                  <div className="text-gray-400 text-xs mb-1"><span className="text-gray-600">Input:</span> {r.input}</div>
                  <div className="text-gray-300 text-xs whitespace-pre-wrap mb-1"><span className="text-gray-600">Output:</span> {r.output}</div>
                  {r.rationale && <div className="text-amber-400 text-xs italic">Judge: {r.rationale}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create suite modal */}
      {showCreateSuite && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-white font-semibold text-lg">Create Eval Suite</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Suite Name</label>
                <input value={suiteName} onChange={(e) => setSuiteName(e.target.value)} placeholder="e.g. Summarization Quality" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Description (optional)</label>
                <input value={suiteDesc} onChange={(e) => setSuiteDesc(e.target.value)} placeholder="What are you testing?" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400 text-xs">Test Cases</label>
                  <button onClick={addCase} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">+ Add Case</button>
                </div>
                {cases.map((c, i) => (
                  <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-500 text-xs">Case {i + 1}</span>
                      {cases.length > 1 && <button onClick={() => removeCase(i)} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Remove</button>}
                    </div>
                    <textarea
                      value={c.input}
                      onChange={(e) => updateCase(i, { input: e.target.value })}
                      placeholder="Input prompt to test..."
                      rows={2}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none mb-2"
                    />
                    <select
                      value={c.scoreMethod}
                      onChange={(e) => updateCase(i, { scoreMethod: e.target.value as EvalCase['scoreMethod'] })}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm mb-2"
                    >
                      <option value="llm_judge">LLM Judge (Haiku scores 1-5)</option>
                      <option value="contains">Contains (output must contain expected)</option>
                      <option value="exact_match">Exact Match</option>
                      <option value="regex">Regex Pattern</option>
                    </select>
                    {c.scoreMethod === 'llm_judge' && (
                      <input
                        value={c.criteria ?? ''}
                        onChange={(e) => updateCase(i, { criteria: e.target.value })}
                        placeholder="Evaluation criteria (e.g. 'Should be concise and factually correct')"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    )}
                    {['contains', 'exact_match'].includes(c.scoreMethod) && (
                      <input
                        value={c.expectedOutput ?? ''}
                        onChange={(e) => updateCase(i, { expectedOutput: e.target.value })}
                        placeholder="Expected output"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    )}
                    {c.scoreMethod === 'regex' && (
                      <input
                        value={c.pattern ?? ''}
                        onChange={(e) => updateCase(i, { pattern: e.target.value })}
                        placeholder="Regex pattern (e.g. \\d{4})"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-800 flex gap-3">
              <button onClick={() => setShowCreateSuite(false)} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">Cancel</button>
              <button onClick={createSuite} disabled={saving} className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Create Suite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suites + runs */}
      {loading ? (
        <div className="text-center text-gray-600 py-16">Loading evaluations…</div>
      ) : suites.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🧪</div>
          <div className="text-white font-medium mb-1">No eval suites yet</div>
          <div className="text-gray-500 text-sm">Create a suite to start measuring your agents' quality</div>
        </div>
      ) : (
        <div className="space-y-4">
          {suites.map((suite) => {
            const suiteRuns = runs.filter((r) => r.suiteId === suite.id).slice(0, 5)
            const parsedCases = (() => { try { return JSON.parse(suite.cases) as EvalCase[] } catch { return [] } })()
            return (
              <div key={suite.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <button onClick={() => setSelectedSuite(s => s?.id === suite.id ? null : suite)} className="text-white font-medium text-sm hover:text-brand-400 transition-colors text-left">
                        {suite.name}
                        <span className="ml-2 text-gray-600 text-xs font-normal">{parsedCases.length} case{parsedCases.length !== 1 ? 's' : ''}</span>
                      </button>
                      {suite.description && <p className="text-gray-500 text-xs mt-0.5">{suite.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={runAgentId}
                        onChange={(e) => setRunAgentId(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">Select agent…</option>
                        {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <button
                        onClick={() => runEval(suite.id, runAgentId)}
                        disabled={runningFor === suite.id || !runAgentId}
                        className="px-3 py-1.5 bg-brand-700 hover:bg-brand-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
                      >
                        {runningFor === suite.id ? 'Running…' : '▶ Run'}
                      </button>
                      <button onClick={() => deleteSuite(suite.id)} className="px-2 py-1.5 text-gray-600 hover:text-red-400 text-xs transition-colors">×</button>
                    </div>
                  </div>
                </div>

                {/* Run history */}
                {suiteRuns.length > 0 && (
                  <div className="border-t border-gray-800 px-4 py-3">
                    <div className="text-gray-600 text-xs mb-2">Recent Runs</div>
                    <div className="space-y-1.5">
                      {suiteRuns.map((run) => {
                        const agent = agents.find((a) => a.id === run.agentId)
                        return (
                          <div key={run.id} className="flex items-center gap-3 text-xs">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              run.status === 'completed' ? 'bg-green-400' :
                              run.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                              run.status === 'failed' ? 'bg-red-400' : 'bg-gray-600'
                            }`} />
                            <span className="text-gray-400 flex-1">{agent?.name ?? run.agentId}</span>
                            {run.averageScore !== undefined && run.averageScore !== null && (
                              <ScoreBadge score={Math.round(run.averageScore)} />
                            )}
                            <span className="text-gray-600">{new Date(run.createdAt).toLocaleString()}</span>
                            {run.status === 'completed' && (
                              <button onClick={() => setSelectedRun(run)} className="text-brand-400 hover:text-brand-300 transition-colors">View</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
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
