import { useState, useEffect } from 'react'

interface WorkforceInsights {
  summary: {
    totalOccupations: number
    totalUSJobs: number
    atRiskUSJobs: number
    atRiskPercent: number
    avgAutomationRisk: number
    avgAiAugmentation: number
  }
  topAtRisk: { id: string; title: string; automationRisk: number; icon: string }[]
  mostAugmented: { id: string; title: string; aiAugmentation: number; icon: string }[]
  highGrowth: { id: string; title: string; icon: string; industry: string }[]
  surgingSkills: { id: string; name: string; aiImpact: string }[]
  domains: { id: string; name: string; icon: string; automationPotential: number }[]
}

interface Occupation {
  id: string
  title: string
  industry: string
  description: string
  icon: string
  automationRisk: number
  aiAugmentation: number
  automationTier: string
  growthOutlook: string
  estimatedUSJobs: number
  timelineYears: string
  knowledgeDomains: string[]
}

const TIER_COLOURS: Record<string, string> = {
  'at-risk': 'bg-red-900/40 text-red-300 border-red-700',
  transforming: 'bg-orange-900/40 text-orange-300 border-orange-700',
  augmented: 'bg-blue-900/40 text-blue-300 border-blue-700',
  resilient: 'bg-green-900/40 text-green-300 border-green-700',
}

const TIER_LABEL: Record<string, string> = {
  'at-risk': 'At Risk',
  transforming: 'Transforming',
  augmented: 'AI-Augmented',
  resilient: 'Resilient',
}

const GROWTH_COLOURS: Record<string, string> = {
  'high-growth': 'text-green-400',
  growing: 'text-emerald-400',
  stable: 'text-yellow-400',
  declining: 'text-red-400',
}

const GROWTH_ICONS: Record<string, string> = {
  'high-growth': '↑↑',
  growing: '↑',
  stable: '→',
  declining: '↓',
}

function RiskBar({ value, colour }: { value: number; colour: string }) {
  return (
    <div className="w-full bg-gray-700 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full ${colour}`} style={{ width: `${value}%` }} />
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

export default function WorkforceIntelligence() {
  const [insights, setInsights] = useState<WorkforceInsights | null>(null)
  const [occupations, setOccupations] = useState<Occupation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [selected, setSelected] = useState<Occupation | null>(null)
  const [detail, setDetail] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/workforce/insights').then((r) => r.json()),
      fetch('/api/workforce/occupations').then((r) => r.json()),
    ]).then(([ins, occs]) => {
      setInsights(ins.data)
      setOccupations(occs.data?.occupations ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (tierFilter) params.set('tier', tierFilter)
    fetch(`/api/workforce/occupations?${params}`).then((r) => r.json()).then((d) => {
      setOccupations(d.data?.occupations ?? [])
    })
  }, [search, tierFilter])

  const openDetail = async (occ: Occupation) => {
    setSelected(occ)
    const d = await fetch(`/api/workforce/occupations/${occ.id}`).then((r) => r.json())
    setDetail(d.data)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-sm animate-pulse">Loading Workforce Intelligence…</div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Main panel */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white">Workforce Intelligence</h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-world automation risk, AI augmentation potential, and upskilling intelligence — powered by ClaudeForge.
          </p>
        </div>

        {/* Summary stats */}
        {insights && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="Occupations tracked"
              value={insights.summary.totalOccupations.toString()}
            />
            <StatCard
              label="US jobs analysed"
              value={`${(insights.summary.totalUSJobs / 1_000_000).toFixed(1)}M`}
            />
            <StatCard
              label="Jobs at risk"
              value={`${(insights.summary.atRiskUSJobs / 1_000_000).toFixed(1)}M`}
              sub={`${insights.summary.atRiskPercent}% of tracked workforce`}
            />
            <StatCard
              label="Avg automation risk"
              value={`${insights.summary.avgAutomationRisk}%`}
            />
            <StatCard
              label="Avg AI augmentation"
              value={`${insights.summary.avgAiAugmentation}%`}
            />
            <StatCard
              label="Surging skills"
              value={insights.surgingSkills.length.toString()}
              sub="High demand, AI-resilient"
            />
          </div>
        )}

        {/* Domain Knowledge Areas */}
        {insights && (
          <div>
            <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Domain Knowledge Areas</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {insights.domains.map((d) => (
                <div key={d.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-brand-500 cursor-pointer transition-colors"
                  onClick={() => window.location.href = `/domains#${d.id}`}
                >
                  <div className="text-2xl mb-2">{d.icon}</div>
                  <div className="text-sm font-medium text-white">{d.name}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <RiskBar value={d.automationPotential} colour="bg-brand-500" />
                    <span className="text-xs text-gray-400 w-8">{d.automationPotential}%</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Automation potential</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top At-Risk + Most Augmented */}
        {insights && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-red-400 mb-3">Highest Automation Risk</h3>
              <div className="space-y-2">
                {insights.topAtRisk.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-4">{i + 1}</span>
                    <span>{o.icon}</span>
                    <span className="text-sm text-gray-200 flex-1">{o.title}</span>
                    <span className="text-sm font-bold text-red-400">{o.automationRisk}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-blue-400 mb-3">Highest AI Augmentation Potential</h3>
              <div className="space-y-2">
                {insights.mostAugmented.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-4">{i + 1}</span>
                    <span>{o.icon}</span>
                    <span className="text-sm text-gray-200 flex-1">{o.title}</span>
                    <span className="text-sm font-bold text-blue-400">{o.aiAugmentation}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Surging Skills */}
        {insights && insights.surgingSkills.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Surging Skills to Develop</h2>
            <div className="flex flex-wrap gap-2">
              {insights.surgingSkills.map((s) => (
                <span key={s.id} className="px-3 py-1.5 bg-brand-900/40 border border-brand-700 text-brand-300 text-xs rounded-full font-medium">
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Occupations table */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex-1">All Occupations</h2>
            <input
              type="text"
              placeholder="Search roles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500 w-48"
            />
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-brand-500"
            >
              <option value="">All tiers</option>
              <option value="at-risk">At Risk</option>
              <option value="transforming">Transforming</option>
              <option value="augmented">Augmented</option>
              <option value="resilient">Resilient</option>
            </select>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Industry</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Tier</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Risk</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Augment</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Growth</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">US Jobs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {occupations.map((occ) => (
                  <tr
                    key={occ.id}
                    onClick={() => openDetail(occ)}
                    className="hover:bg-gray-750 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{occ.icon}</span>
                        <div>
                          <div className="font-medium text-gray-200">{occ.title}</div>
                          <div className="text-xs text-gray-500 hidden sm:block">{occ.timelineYears} yr timeline</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell text-xs">{occ.industry}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded border text-xs font-medium ${TIER_COLOURS[occ.automationTier] ?? 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                        {TIER_LABEL[occ.automationTier] ?? occ.automationTier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${occ.automationRisk >= 60 ? 'text-red-400' : occ.automationRisk >= 35 ? 'text-orange-400' : 'text-green-400'}`}>
                        {occ.automationRisk}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-blue-400 font-medium hidden md:table-cell">{occ.aiAugmentation}%</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`font-medium ${GROWTH_COLOURS[occ.growthOutlook] ?? 'text-gray-400'}`}>
                        {GROWTH_ICONS[occ.growthOutlook]} {occ.growthOutlook.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 hidden lg:table-cell text-xs">
                      {(occ.estimatedUSJobs / 1000).toFixed(0)}K
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-96 flex-shrink-0 border-l border-gray-800 bg-gray-900 overflow-auto p-5 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-3xl mb-1">{selected.icon}</div>
              <h2 className="text-lg font-bold text-white">{selected.title}</h2>
              <div className="text-xs text-gray-400">{selected.industry}</div>
            </div>
            <button onClick={() => { setSelected(null); setDetail(null) }} className="text-gray-500 hover:text-gray-300 text-xl leading-none">✕</button>
          </div>

          <p className="text-sm text-gray-400">{selected.description}</p>

          <div className={`px-3 py-2 rounded-lg border text-sm font-medium ${TIER_COLOURS[selected.automationTier]}`}>
            {TIER_LABEL[selected.automationTier]} · {selected.timelineYears} yr timeline
          </div>

          {/* Risk bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Automation Risk</span>
                <span className={selected.automationRisk >= 60 ? 'text-red-400 font-bold' : 'text-gray-300'}>{selected.automationRisk}%</span>
              </div>
              <RiskBar value={selected.automationRisk} colour={selected.automationRisk >= 60 ? 'bg-red-500' : selected.automationRisk >= 35 ? 'bg-orange-500' : 'bg-green-500'} />
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>AI Augmentation Potential</span>
                <span className="text-blue-400 font-bold">{selected.aiAugmentation}%</span>
              </div>
              <RiskBar value={selected.aiAugmentation} colour="bg-blue-500" />
            </div>
          </div>

          {/* Tasks breakdown */}
          {detail?.occupation?.tasks && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Task Breakdown</h3>
              <div className="space-y-1.5">
                {detail.occupation.tasks.map((t: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs
                      ${t.aiHandles ? 'bg-purple-900 text-purple-300' : t.aiAssists ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}`}>
                      {t.aiHandles ? 'AI' : t.aiAssists ? '~' : 'H'}
                    </span>
                    <span className="text-gray-300">{t.description}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-2 text-xs text-gray-500">
                <span><span className="text-purple-400 font-medium">AI</span> = automates</span>
                <span><span className="text-blue-400 font-medium">~</span> = assists</span>
                <span><span className="text-green-400 font-medium">H</span> = human only</span>
              </div>
            </div>
          )}

          {/* Recommended agents */}
          {detail?.occupation?.recommendedAgents?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recommended ClaudeForge Agents</h3>
              <div className="flex flex-wrap gap-1.5">
                {detail.occupation.recommendedAgents.map((a: string) => (
                  <span key={a} className="px-2 py-1 bg-brand-900/40 border border-brand-700 text-brand-300 text-xs rounded-lg">
                    {a.replace(/-/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Knowledge domains */}
          {selected.knowledgeDomains?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Knowledge Domains</h3>
              <div className="flex flex-wrap gap-1.5">
                {selected.knowledgeDomains.map((d) => (
                  <span key={d} className="px-2 py-1 bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg">{d}</span>
                ))}
              </div>
            </div>
          )}

          {/* Related skills from taxonomy */}
          {detail?.relatedSkills?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Skills Taxonomy</h3>
              <div className="space-y-1.5">
                {detail.relatedSkills.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300">{s.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      s.aiImpact === 'resilient' ? 'bg-green-900/40 text-green-300' :
                      s.aiImpact === 'augments' ? 'bg-blue-900/40 text-blue-300' :
                      'bg-red-900/40 text-red-300'
                    }`}>
                      {s.aiImpact}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-gray-800">
            <a
              href={`/automation?role=${selected.id}`}
              className="block w-full text-center px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg transition-colors font-medium"
            >
              Run Automation Analysis →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
