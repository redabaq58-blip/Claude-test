import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AgentStudio from './pages/AgentStudio'
import Chat from './pages/Chat'
import Compare from './pages/Compare'
import Workflows from './pages/Workflows'
import MCPHub from './pages/MCPHub'
import Analytics from './pages/Analytics'
import Templates from './pages/Templates'
import History from './pages/History'
import Prompts from './pages/Prompts'
import Schedules from './pages/Schedules'
import BatchJobs from './pages/BatchJobs'
import Evals from './pages/Evals'
import Playground from './pages/ForgeStudio'
import CommandPalette from './components/CommandPalette'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '⬡' },
  { to: '/forge', label: 'Playground', icon: '⬙' },
  { to: '/chat', label: 'Chat', icon: '◉' },
  { to: '/agents', label: 'Agent Studio', icon: '◈' },
  { to: '/prompts', label: 'Prompt Library', icon: '◧' },
  { to: '/compare', label: 'Compare', icon: '⚖' },
  { to: '/templates', label: 'Templates', icon: '⬛' },
  { to: '/workflows', label: 'Workflows', icon: '⟳' },
  { to: '/schedules', label: 'Schedules', icon: '⏰' },
  { to: '/mcp', label: 'MCP Hub', icon: '⬢' },
  { to: '/analytics', label: 'Analytics', icon: '◎' },
  { to: '/batches', label: 'Batch Jobs', icon: '📦' },
  { to: '/evals', label: 'Evaluations', icon: '🧪' },
  { to: '/history', label: 'History', icon: '◷' },
]

function AppInner() {
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Global Cmd+K / Ctrl+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-800">
          <div className="text-brand-500 font-bold text-lg tracking-tight">ClaudeForge</div>
          <div className="text-gray-500 text-xs mt-0.5">Claude Agent Platform</div>
        </div>

        {/* Cmd+K hint */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          <span className="text-xs">⌘</span>
          <span className="flex-1 text-left text-xs">Search commands…</span>
          <kbd className="text-xs bg-gray-700 px-1.5 py-0.5 rounded border border-gray-600 text-gray-500">K</kbd>
        </button>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white font-medium'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`
              }
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-600">
          v2.2 · Anthropic Ecosystem
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/agents" element={<AgentStudio />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/mcp" element={<MCPHub />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/history" element={<History />} />
          <Route path="/prompts" element={<Prompts />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/batches" element={<BatchJobs />} />
          <Route path="/evals" element={<Evals />} />
          <Route path="/forge" element={<Playground />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Global Command Palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}
