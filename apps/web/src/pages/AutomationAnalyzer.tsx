import { useState, useEffect } from 'react'

interface AnalysisResult {
  occupation: { id: string; title: string; industry: string; icon: string }
  automationAnalysis: {
    automationRisk: number
    aiAugmentation: number
    automationTier: string
    timelineYears: string
    growthOutlook: string
  }
  taskBreakdown: {
    total: number
    aiAutomates: { count: number; percent: number }
    aiAssists: { count: number; percent: number }
    humanRequired: { count: number; percent: number }
    tasks: { description: string; aiHandles: boolean; aiAssists: boolean; humanRequired: boolean }[]
  }
  roiEstimate: {
    hoursPerWeekSaved: number
    annualHoursSaved: number
    productivityGainPercent: number
  }
  recommendedAgents: {
    id: string
    name: string
    icon: string
    description: string
    model: string
  }[]
  upskillingRecommendations: {
    name: string
    category: string
    reason: string
    demandTrend: string
  }[]
  domains: {
    id: string
    name: string
    icon: string
    automationPotential: number
    topUseCases: string[]
  }[]
}

interface LeaderboardEntry {
  rank: number
  id: string
  title: string
  icon: string
  industry: string
  automationRisk: number
  aiAugmentation: number
  automationTier: string
  growthOutlook: string
  estimatedUSJobs: number
}

const TIER_LABELS: Record<string, string> = {
  'at-risk': 'At Risk',
  transforming: 'Transforming',
  augmented: 'AI-Augmented',
  resilient: 'Resilient',
}

const TIER_COLOURS: Record<string, string> = {
  'at-risk': 'text-red-400',
  transforming: 'text-orange-400',
  augmented: 'text-blue-400',
  resilient: 'text-green-400',
}

const GROWTH_ICONS: Record<string, string> = {
  'high-growth': '↑↑ High Growth',
  growing: '↑ Growing',
  stable: '→ Stable',
  declining: '↓ Declining',
}

function GaugeBar({ value, label, colour }: { value: number; label: string; colour: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span className={`font-bold ${colour}`}>{value}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2.5">
        <div className={`h-2.5 rounded-full transition-all duration-700 ${colour.replace('text-', 'bg-')}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export default function AutomationAnalyzer() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardSort, setLeaderboardSort] = useState<'automationRisk' | 'aiAugmentation'>('automationRisk')

  useEffect(() => {
    // Check if coming from WorkforceIntelligence with pre-selected role
    const params = new URLSearchParams(window.location.search)
    const role = params.get('role')
    if (role) {
      analyzeById(role)
    }
    // Load leaderboard
    loadLeaderboard('automationRisk')
  }, [])

  const loadLeaderboard = (sortBy: 'automationRisk' | 'aiAugmentation') => {
    setLeaderboardSort(sortBy)
    fetch(`/api/automation/leaderboard?sortBy=${sortBy}&limit=10`)
      .then((r) => r.json())
      .then((d) => setLeaderboard(d.data?.leaderboard ?? []))
  }

  const analyzeById = async (id: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/automation/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occupationId: id }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setResult(null)
      } else {
        setResult(data.data)
      }
    } catch {
      setError('Failed to run analysis. Check API connection.')
    } finally {
      setLoading(false)
    }
  }

  const analyzeByTitle = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/automation/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: query }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setResult(null)
      } else {
        setResult(data.data)
        setQuery('')
      }
    } catch {
      setError('Failed to run analysis. Check API connection.')
    } finally {
      setLoading(false)
    }
  }

  const riskColour = (v: number) => v >= 60 ? 'text-red-400' : v >= 35 ? 'text-orange-400' : 'text-green-400'

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Automation Analyzer</h1>
        <p className="text-sm text-gray-400 mt-1">
          Enter any job title to get an instant AI automation risk assessment, task breakdown, ROI estimate, and ClaudeForge agent recommendations.
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && analyzeByTitle()}
          placeholder="e.g. Financial Analyst, Paralegal, Marketing Manager…"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500"
        />
        <button
          onClick={analyzeByTitle}
          disabled={loading || !query.trim()}
          className="px-6 py-3 bg-brand-600 hover:bg-brand-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 text-sm text-red-300">
          {error} — Try searching from the <a href="/workforce" className="underline">Workforce Intelligence</a> page.
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column: core analysis */}
          <div className="lg:col-span-2 space-y-4">
            {/* Role header */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="text-4xl">{result.occupation.icon}</div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">{result.occupation.title}</h2>
                  <div className="text-sm text-gray-400">{result.occupation.industry}</div>
                  <div className={`mt-1 text-sm font-semibold ${TIER_COLOURS[result.automationAnalysis.automationTier] ?? 'text-gray-400'}`}>
                    {TIER_LABELS[result.automationAnalysis.automationTier]} · {result.automationAnalysis.timelineYears} year horizon
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-black ${riskColour(result.automationAnalysis.automationRisk)}`}>
                    {result.automationAnalysis.automationRisk}%
                  </div>
                  <div className="text-xs text-gray-500">automation risk</div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <GaugeBar
                  value={result.automationAnalysis.automationRisk}
                  label="Automation Risk"
                  colour={riskColour(result.automationAnalysis.automationRisk)}
                />
                <GaugeBar
                  value={result.automationAnalysis.aiAugmentation}
                  label="AI Augmentation Potential"
                  colour="text-blue-400"
                />
              </div>
              <div className="mt-3 text-xs text-gray-500">
                Growth Outlook: <span className="font-medium text-gray-300">{GROWTH_ICONS[result.automationAnalysis.growthOutlook] ?? result.automationAnalysis.growthOutlook}</span>
              </div>
            </div>

            {/* Task breakdown */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Task Breakdown ({result.taskBreakdown.total} tasks)</h3>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">{result.taskBreakdown.aiAutomates.percent}%</div>
                  <div className="text-xs text-purple-300 mt-1">AI Automates</div>
                  <div className="text-xs text-gray-500">{result.taskBreakdown.aiAutomates.count} tasks</div>
                </div>
                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-400">{result.taskBreakdown.aiAssists.percent}%</div>
                  <div className="text-xs text-blue-300 mt-1">AI Assists</div>
                  <div className="text-xs text-gray-500">{result.taskBreakdown.aiAssists.count} tasks</div>
                </div>
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{result.taskBreakdown.humanRequired.percent}%</div>
                  <div className="text-xs text-green-300 mt-1">Human Only</div>
                  <div className="text-xs text-gray-500">{result.taskBreakdown.humanRequired.count} tasks</div>
                </div>
              </div>
              <div className="space-y-2">
                {result.taskBreakdown.tasks.map((t, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm py-1.5 border-b border-gray-700 last:border-0">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5
                      ${t.aiHandles ? 'bg-purple-900 text-purple-300' : t.aiAssists ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}`}>
                      {t.aiHandles ? 'A' : t.aiAssists ? '~' : 'H'}
                    </span>
                    <span className="text-gray-300 flex-1">{t.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ROI estimate */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Estimated ROI with ClaudeForge</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-750 border border-gray-700 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-brand-400">{result.roiEstimate.hoursPerWeekSaved}h</div>
                  <div className="text-xs text-gray-400 mt-1">Hours saved / week</div>
                </div>
                <div className="bg-gray-750 border border-gray-700 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-brand-400">{result.roiEstimate.annualHoursSaved}h</div>
                  <div className="text-xs text-gray-400 mt-1">Hours saved / year</div>
                </div>
                <div className="bg-gray-750 border border-gray-700 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-brand-400">+{result.roiEstimate.productivityGainPercent}%</div>
                  <div className="text-xs text-gray-400 mt-1">Productivity gain</div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Estimates based on AI augmentation potential and typical 40h/week work patterns. Actual results vary by workflow and adoption.
              </p>
            </div>

            {/* Domain knowledge areas */}
            {result.domains.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Domain Knowledge Areas</h3>
                <div className="space-y-4">
                  {result.domains.map((d) => (
                    <div key={d.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{d.icon}</span>
                        <span className="font-medium text-gray-200 text-sm">{d.name}</span>
                        <span className="ml-auto text-xs text-brand-400 font-bold">{d.automationPotential}% automatable</span>
                      </div>
                      <ul className="space-y-1 pl-7">
                        {d.topUseCases.map((uc, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                            <span className="text-brand-500 mt-0.5">→</span>
                            {uc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column: agents + upskilling */}
          <div className="space-y-4">
            {/* Recommended agents */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Recommended Agents</h3>
              <div className="space-y-3">
                {result.recommendedAgents.map((a) => (
                  <div key={a.id} className="border border-gray-700 rounded-lg p-3 hover:border-brand-500 cursor-pointer transition-colors"
                    onClick={() => window.location.href = '/templates'}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{a.icon}</span>
                      <span className="text-sm font-medium text-gray-200">{a.name}</span>
                    </div>
                    <p className="text-xs text-gray-500">{a.description}</p>
                    <div className="mt-2 text-xs text-gray-600 font-mono">{a.model.split('-').slice(1, 3).join('-')}</div>
                  </div>
                ))}
                {result.recommendedAgents.length === 0 && (
                  <p className="text-xs text-gray-500">Browse all templates to find relevant agents.</p>
                )}
              </div>
              <a href="/templates" className="block mt-3 text-center text-xs text-brand-400 hover:text-brand-300">
                View all templates →
              </a>
            </div>

            {/* Upskilling */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Upskilling Priorities</h3>
              <div className="space-y-3">
                {result.upskillingRecommendations.map((s, i) => (
                  <div key={i} className="border border-gray-700 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-gray-200">{s.name}</span>
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                        s.demandTrend === 'surging' ? 'bg-green-900/40 text-green-300' :
                        s.demandTrend === 'rising' ? 'bg-blue-900/40 text-blue-300' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {s.demandTrend}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{s.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard (shown when no analysis) */}
      {!result && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-gray-300">Automation Leaderboard</h2>
            <div className="flex gap-2">
              <button
                onClick={() => loadLeaderboard('automationRisk')}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${leaderboardSort === 'automationRisk' ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}
              >
                Highest Risk
              </button>
              <button
                onClick={() => loadLeaderboard('aiAugmentation')}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${leaderboardSort === 'aiAugmentation' ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}
              >
                Most Augmented
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase hidden md:table-cell">Industry</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  {leaderboardSort === 'automationRisk' ? 'Risk' : 'Augment'}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase hidden md:table-cell">US Jobs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {leaderboard.map((entry) => (
                <tr
                  key={entry.id}
                  onClick={() => analyzeById(entry.id)}
                  className="hover:bg-gray-750 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-gray-500 text-xs">{entry.rank}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{entry.icon}</span>
                      <span className="text-gray-200 font-medium">{entry.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{entry.industry}</td>
                  <td className="px-4 py-3 text-right font-bold">
                    <span className={leaderboardSort === 'automationRisk' ? riskColour(entry.automationRisk) : 'text-blue-400'}>
                      {leaderboardSort === 'automationRisk' ? entry.automationRisk : entry.aiAugmentation}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs hidden md:table-cell">
                    {(entry.estimatedUSJobs / 1000).toFixed(0)}K
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-gray-700 text-xs text-gray-500">
            Click any row to run a full automation analysis. Sources: Oxford Martin School, McKinsey Global Institute, WEF Future of Jobs.
          </div>
        </div>
      )}
    </div>
  )
}
