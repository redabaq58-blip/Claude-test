import React, { useEffect, useState } from 'react'
import { mcpApi } from '../api'
import type { McpServer } from '../api'

const SERVER_TYPES = ['filesystem', 'web', 'git', 'database', 'code']
const TYPE_DESCRIPTIONS: Record<string, string> = {
  filesystem: 'Read, write, and search files',
  web: 'Fetch URLs and extract links',
  git: 'Git log, diff, blame, commit',
  database: 'Query SQLite databases',
  code: 'Execute JS, Python, Bash',
}

function StatusBadge({ status }: { status: string }) {
  const cfg =
    status === 'connected'
      ? 'bg-green-950 text-green-400'
      : status === 'error'
      ? 'bg-red-950 text-red-400'
      : 'bg-gray-800 text-gray-400'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-green-400' : status === 'error' ? 'bg-red-400' : 'bg-gray-400'}`} />
      {status}
    </span>
  )
}

export default function MCPHub() {
  const [servers, setServers] = useState<McpServer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [testResults, setTestResults] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ name: '', type: 'filesystem' })

  const load = () => mcpApi.list().then(setServers).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.name.trim()) return
    await mcpApi.create({ name: form.name, type: form.type })
    setShowForm(false)
    setForm({ name: '', type: 'filesystem' })
    load()
  }

  const handleTest = async (server: McpServer) => {
    setTesting((t) => ({ ...t, [server.id]: true }))
    setTestResults((r) => ({ ...r, [server.id]: '' }))
    try {
      const result = await mcpApi.test(server.id)
      if (result.connected) {
        setTestResults((r) => ({
          ...r,
          [server.id]: `Connected — ${result.toolCount} tools: ${result.tools?.join(', ')}`,
        }))
      } else {
        setTestResults((r) => ({ ...r, [server.id]: `Error: ${result.error}` }))
      }
      load()
    } catch (err) {
      setTestResults((r) => ({ ...r, [server.id]: `Error: ${err instanceof Error ? err.message : String(err)}` }))
    } finally {
      setTesting((t) => ({ ...t, [server.id]: false }))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this MCP server?')) return
    await mcpApi.delete(id)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">MCP Hub</h1>
          <p className="text-gray-500 text-sm">Manage Model Context Protocol tool servers</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium"
        >
          + Add Server
        </button>
      </div>

      {/* Available server types info */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {SERVER_TYPES.map((type) => (
          <div key={type} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <div className="text-brand-400 text-xs font-mono font-bold mb-1">{type}</div>
            <div className="text-gray-500 text-xs">{TYPE_DESCRIPTIONS[type]}</div>
          </div>
        ))}
      </div>

      {/* Add server modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-5">Add MCP Server</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Server Name *</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500"
                  placeholder="my-filesystem"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Server Type *</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {SERVER_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
                Cancel
              </button>
              <button onClick={handleCreate} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium">
                Add Server
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server list */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading…</div>
      ) : servers.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-12 text-center">
          <div className="text-gray-600 text-4xl mb-3">⬢</div>
          <p className="text-gray-400 text-sm mb-4">No MCP servers registered yet.</p>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium">
            Add Server
          </button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-800 bg-gray-900/50">
                <th className="text-left px-6 py-3 font-medium">Name</th>
                <th className="text-left px-6 py-3 font-medium">Type</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-left px-6 py-3 font-medium">Tools</th>
                <th className="text-left px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((server) => (
                <React.Fragment key={server.id}>
                  <tr className="border-b border-gray-800 last:border-0 hover:bg-gray-800/20">
                    <td className="px-6 py-3 font-medium text-white font-mono text-xs">{server.name}</td>
                    <td className="px-6 py-3 text-gray-400">{server.type}</td>
                    <td className="px-6 py-3"><StatusBadge status={server.status} /></td>
                    <td className="px-6 py-3 text-gray-400">{server.toolCount}</td>
                    <td className="px-6 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTest(server)}
                          disabled={testing[server.id]}
                          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded text-xs"
                        >
                          {testing[server.id] ? '…' : 'Test'}
                        </button>
                        <button
                          onClick={() => handleDelete(server.id)}
                          className="px-2 py-1 bg-gray-800 hover:bg-red-950 text-gray-400 hover:text-red-400 rounded text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                  {testResults[server.id] && (
                    <tr className="bg-gray-950">
                      <td colSpan={5} className="px-6 py-2 text-xs text-gray-400 font-mono">
                        {testResults[server.id]}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
