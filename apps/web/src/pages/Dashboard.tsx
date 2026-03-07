import { useEffect, useState } from 'react'
import { agentsApi, analyticsApi } from '../api'
import type { Agent, CostAnalytics, RunAnalytics } from '../api'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-gray-500 text-xs mt-1">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [costs, setCosts] = useState<CostAnalytics | null>(null)
  const [runs, setRuns] = useState<RunAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([agentsApi.list(), analyticsApi.costs(30), analyticsApi.runs(30)])
      .then(([a, c, r]) => {
        setAgents(a)
        setCosts(c)
        setRuns(r)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const totalRuns = runs?.byStatus.reduce((s, r) => s + r.count, 0) ?? 0
  const successRuns = runs?.byStatus.find((r) => r.status === 'completed')?.count ?? 0
  const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">Overview of your Claude agent platform</p>

      {error && (
        <div className="mb-6 bg-red-950 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
          API unavailable — start the API server: <code className="font-mono">npm run start:api</code>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Agents" value={loading ? '…' : String(agents.length)} sub="configured" />
        <StatCard label="Total Runs (30d)" value={loading ? '…' : String(totalRuns)} sub="all agents" />
        <StatCard
          label="Success Rate"
          value={loading ? '…' : `${successRate}%`}
          sub={`${successRuns} completed`}
        />
        <StatCard
          label="Total Cost (30d)"
          value={loading ? '…' : `$${(costs?.totals?.total_cost ?? 0).toFixed(4)}`}
          sub={`${costs?.totals?.total_tokens?.toLocaleString() ?? 0} tokens`}
        />
      </div>

      {/* Recent agents */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Agents</h2>
          <a href="/agents" className="text-brand-500 text-sm hover:text-brand-400">
            Manage →
          </a>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-gray-500 text-sm">Loading…</div>
        ) : agents.length === 0 ? (
          <div className="px-6 py-8 text-gray-500 text-sm">
            No agents yet.{' '}
            <a href="/agents" className="text-brand-500 hover:underline">
              Create one →
            </a>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-800">
                <th className="text-left px-6 py-3 font-medium">Name</th>
                <th className="text-left px-6 py-3 font-medium">Model</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-left px-6 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
                  <td className="px-6 py-3 font-medium text-white">{agent.name}</td>
                  <td className="px-6 py-3 text-gray-400 font-mono text-xs">{agent.model}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                        agent.isActive
                          ? 'bg-green-950 text-green-400'
                          : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${agent.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                      {agent.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500 text-xs">
                    {new Date(agent.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Run stats by agent */}
      {!loading && runs && runs.byAgent.length > 0 && (
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-white">Top Agents by Usage (30d)</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-800">
                <th className="text-left px-6 py-3 font-medium">Agent</th>
                <th className="text-left px-6 py-3 font-medium">Runs</th>
                <th className="text-left px-6 py-3 font-medium">Success</th>
                <th className="text-left px-6 py-3 font-medium">Avg Duration</th>
                <th className="text-left px-6 py-3 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {runs.byAgent.map((row) => (
                <tr key={row.agent_id} className="border-b border-gray-800 last:border-0">
                  <td className="px-6 py-3 font-medium text-white">{row.agent_name ?? row.agent_id}</td>
                  <td className="px-6 py-3 text-gray-400">{row.run_count}</td>
                  <td className="px-6 py-3 text-green-400">
                    {row.run_count > 0
                      ? Math.round((row.success_count / row.run_count) * 100)
                      : 0}
                    %
                  </td>
                  <td className="px-6 py-3 text-gray-400">{Math.round(row.avg_duration_ms)}ms</td>
                  <td className="px-6 py-3 text-gray-400">${(row.total_cost ?? 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
