import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'
import { analyticsApi } from '../api'
import type { CostAnalytics, RunAnalytics } from '../api'

const MODEL_COLORS: Record<string, string> = {
  'claude-opus-4-6': '#818cf8',
  'claude-sonnet-4-6': '#34d399',
  'claude-haiku-4-5-20251001': '#fbbf24',
}

const MODEL_SHORT: Record<string, string> = {
  'claude-opus-4-6': 'Opus',
  'claude-sonnet-4-6': 'Sonnet',
  'claude-haiku-4-5-20251001': 'Haiku',
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#34d399',
  failed: '#f87171',
  running: '#60a5fa',
  pending: '#9ca3af',
}

// ─── Token usage types ────────────────────────────────────────────────────────

interface UsageRow {
  date: string
  model: string
  total_tokens: number
  request_count: number
}

// Pivot rows into per-day stacked chart data
function pivotTokensByDay(rows: UsageRow[]) {
  const byDate: Record<string, Record<string, number>> = {}
  for (const row of rows) {
    if (!byDate[row.date]) byDate[row.date] = {}
    byDate[row.date][row.model] = (byDate[row.date][row.model] ?? 0) + row.total_tokens
  }
  return Object.entries(byDate)
    .map(([date, models]) => ({ date, ...models }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

const MODELS_ORDERED = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']

export default function Analytics() {
  const [costs, setCosts] = useState<CostAnalytics | null>(null)
  const [runs, setRuns] = useState<RunAnalytics | null>(null)
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([analyticsApi.costs(days), analyticsApi.runs(days), analyticsApi.usage(days)])
      .then(([c, r, u]) => { setCosts(c); setRuns(r); setUsage(u) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [days])

  const totalRuns = runs?.byStatus.reduce((s, r) => s + r.count, 0) ?? 0
  const tokensByDay = pivotTokensByDay(usage)
  const modelsPresent = MODELS_ORDERED.filter((m) => usage.some((u) => u.model === m))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Analytics</h1>
          <p className="text-gray-500 text-sm">Usage, costs, and performance metrics</p>
        </div>
        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm">
          Failed to load analytics: {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-1">Total Cost</div>
          <div className="text-2xl font-bold text-white">
            {loading ? '…' : `$${(costs?.totals?.total_cost ?? 0).toFixed(4)}`}
          </div>
          <div className="text-gray-500 text-xs mt-1">Last {days} days</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-1">Total Tokens</div>
          <div className="text-2xl font-bold text-white">
            {loading ? '…' : (costs?.totals?.total_tokens ?? 0).toLocaleString()}
          </div>
          <div className="text-gray-500 text-xs mt-1">Input + output</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-1">Total Requests</div>
          <div className="text-2xl font-bold text-white">
            {loading ? '…' : (costs?.totals?.total_requests ?? totalRuns).toLocaleString()}
          </div>
          <div className="text-gray-500 text-xs mt-1">Agent runs</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 border-l-2 border-l-emerald-600">
          <div className="text-emerald-400 text-sm mb-1">Cache Savings</div>
          <div className="text-2xl font-bold text-white">
            {loading ? '…' : `$${((costs?.totals as Record<string, number> | undefined)?.cache_savings_usd ?? 0).toFixed(4)}`}
          </div>
          <div className="text-gray-500 text-xs mt-1">
            {loading ? '' : `${((costs?.totals as Record<string, number> | undefined)?.cache_read_tokens ?? 0).toLocaleString()} cache hits`}
          </div>
        </div>
      </div>

      {/* Token usage over time — full width */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Token Usage Over Time</h2>
          {modelsPresent.length > 0 && (
            <div className="flex items-center gap-3">
              {modelsPresent.map((m) => (
                <div key={m} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: MODEL_COLORS[m] }} />
                  {MODEL_SHORT[m]}
                </div>
              ))}
            </div>
          )}
        </div>
        {loading || tokensByDay.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
            {loading ? 'Loading…' : 'No token data yet — run an agent to see usage here'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={tokensByDay}>
              <defs>
                {modelsPresent.map((m) => (
                  <linearGradient key={m} id={`grad-${m}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={MODEL_COLORS[m]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={MODEL_COLORS[m]} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(v: number, name: string) => [
                  v.toLocaleString(),
                  MODEL_SHORT[name] ?? name,
                ]}
              />
              {modelsPresent.map((m) => (
                <Area
                  key={m}
                  type="monotone"
                  dataKey={m}
                  stackId="tokens"
                  stroke={MODEL_COLORS[m]}
                  fill={`url(#grad-${m})`}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Cost by day */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">Cost Over Time</h2>
          {loading || !costs?.byDay?.length ? (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
              {loading ? 'Loading…' : 'No data yet'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={[...costs.byDay].reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(3)}`} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']}
                />
                <Line type="monotone" dataKey="total_cost" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Cost by model */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">Cost by Model</h2>
          {loading || !costs?.byModel?.length ? (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
              {loading ? 'Loading…' : 'No data yet'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={costs.byModel}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="model"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickFormatter={(v) => v.replace('claude-', '').replace('-20251001', '')}
                />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(3)}`} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']}
                />
                <Bar dataKey="total_cost" radius={[4, 4, 0, 0]}>
                  {costs.byModel.map((entry) => (
                    <Cell key={entry.model} fill={MODEL_COLORS[entry.model] ?? '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Run status breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">Run Status Breakdown</h2>
          {loading || !runs?.byStatus?.length ? (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
              {loading ? 'Loading…' : 'No runs yet'}
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="60%" height={180}>
                <PieChart>
                  <Pie data={runs.byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70}>
                    {runs.byStatus.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {runs.byStatus.map((s) => (
                  <div key={s.status} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ background: STATUS_COLORS[s.status] ?? '#6b7280' }} />
                    <span className="text-gray-400 capitalize">{s.status}</span>
                    <span className="text-white font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top agents */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">Top Agents by Runs</h2>
          {loading || !runs?.byAgent?.length ? (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
              {loading ? 'Loading…' : 'No data yet'}
            </div>
          ) : (
            <div className="space-y-3">
              {runs.byAgent.slice(0, 5).map((row) => {
                const pct = totalRuns > 0 ? (row.run_count / totalRuns) * 100 : 0
                return (
                  <div key={row.agent_id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300 truncate max-w-[160px]">{row.agent_name ?? 'Unknown'}</span>
                      <span className="text-gray-500">{row.run_count} runs</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
