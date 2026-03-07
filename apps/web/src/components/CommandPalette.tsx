import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { agentsApi } from '../api'
import type { Agent } from '../api'

interface Command {
  id: string
  label: string
  description?: string
  group: 'Navigation' | 'Agents' | 'Actions'
  icon: string
  action: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [agents, setAgents] = useState<Agent[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Load agents for dynamic commands
  useEffect(() => {
    agentsApi.list().then(setAgents).catch(() => {})
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  const go = useCallback(
    (path: string) => {
      navigate(path)
      onClose()
    },
    [navigate, onClose]
  )

  const staticCommands: Command[] = [
    // Navigation
    { id: 'nav-dash', label: 'Go to Dashboard', icon: '⬡', group: 'Navigation', action: () => go('/') },
    { id: 'nav-agents', label: 'Go to Agent Studio', icon: '◈', group: 'Navigation', action: () => go('/agents') },
    { id: 'nav-chat', label: 'Open Chat', icon: '◉', group: 'Navigation', action: () => go('/chat') },
    { id: 'nav-compare', label: 'Compare Models', icon: '⚖', group: 'Navigation', action: () => go('/compare') },
    { id: 'nav-templates', label: 'Browse Templates', icon: '⬛', group: 'Navigation', action: () => go('/templates') },
    { id: 'nav-workflows', label: 'Go to Workflows', icon: '⟳', group: 'Navigation', action: () => go('/workflows') },
    { id: 'nav-mcp', label: 'Go to MCP Hub', icon: '⬢', group: 'Navigation', action: () => go('/mcp') },
    { id: 'nav-analytics', label: 'Go to Analytics', icon: '◎', group: 'Navigation', action: () => go('/analytics') },
    { id: 'nav-history', label: 'View Run History', icon: '◷', group: 'Navigation', action: () => go('/history') },

    // Actions
    { id: 'action-new-agent', label: 'New Agent', description: 'Create a new agent', icon: '+', group: 'Actions', action: () => go('/agents') },
    { id: 'action-new-workflow', label: 'New Workflow', description: 'Create a workflow pipeline', icon: '+', group: 'Actions', action: () => go('/workflows') },
    { id: 'action-new-chat', label: 'New Chat', description: 'Start a conversation', icon: '◉', group: 'Actions', action: () => go('/chat') },
  ]

  const agentCommands: Command[] = agents.map((a) => ({
    id: `agent-${a.id}`,
    label: `Chat with ${a.name}`,
    description: a.description || a.model,
    icon: '◈',
    group: 'Agents' as const,
    action: () => go(`/chat?agentId=${a.id}`),
  }))

  const allCommands = [...staticCommands, ...agentCommands]

  const filtered = query.trim()
    ? allCommands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.description?.toLowerCase().includes(query.toLowerCase())
      )
    : allCommands

  // Group filtered commands
  const groups = ['Navigation', 'Agents', 'Actions'] as const
  const grouped = groups
    .map((g) => ({ group: g, commands: filtered.filter((c) => c.group === g) }))
    .filter((g) => g.commands.length > 0)

  const flat = grouped.flatMap((g) => g.commands)

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => Math.min(s + 1, flat.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        flat[selected]?.action()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, flat, selected, onClose])

  // Reset selection when filter changes
  useEffect(() => setSelected(0), [query])

  if (!open) return null

  let itemIndex = 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <span className="text-gray-500 text-lg">⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, agents, pages…"
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
          />
          <kbd className="hidden sm:block text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto py-2">
          {grouped.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">No commands found</div>
          ) : (
            grouped.map(({ group, commands }) => (
              <div key={group}>
                <div className="px-4 py-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {group}
                </div>
                {commands.map((cmd) => {
                  const idx = itemIndex++
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => cmd.action()}
                      onMouseEnter={() => setSelected(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        selected === idx ? 'bg-brand-600/20 text-white' : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span className="text-base w-5 text-center flex-shrink-0">{cmd.icon}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{cmd.label}</div>
                        {cmd.description && (
                          <div className="text-xs text-gray-500 truncate">{cmd.description}</div>
                        )}
                      </div>
                      {selected === idx && (
                        <span className="ml-auto text-xs text-gray-500 flex-shrink-0">↵ Enter</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-800 flex items-center gap-4 text-xs text-gray-600">
          <span><kbd className="bg-gray-800 px-1.5 rounded border border-gray-700">↑↓</kbd> navigate</span>
          <span><kbd className="bg-gray-800 px-1.5 rounded border border-gray-700">↵</kbd> select</span>
          <span><kbd className="bg-gray-800 px-1.5 rounded border border-gray-700">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
