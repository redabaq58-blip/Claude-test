import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AgentStudio from './pages/AgentStudio'
import Workflows from './pages/Workflows'
import MCPHub from './pages/MCPHub'
import Analytics from './pages/Analytics'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '⬡' },
  { to: '/agents', label: 'Agent Studio', icon: '◈' },
  { to: '/workflows', label: 'Workflows', icon: '⟳' },
  { to: '/mcp', label: 'MCP Hub', icon: '⬢' },
  { to: '/analytics', label: 'Analytics', icon: '◎' },
]

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-gray-950">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
          {/* Logo */}
          <div className="px-5 py-5 border-b border-gray-800">
            <div className="text-brand-500 font-bold text-lg tracking-tight">ClaudeForge</div>
            <div className="text-gray-500 text-xs mt-0.5">Claude Agent Platform</div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-brand-600 text-white font-medium'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`
                }
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-600">
            v1.0.0 · Anthropic Ecosystem
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agents" element={<AgentStudio />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/mcp" element={<MCPHub />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
