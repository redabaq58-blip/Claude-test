import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { templatesApi } from '../api'
import type { AgentTemplate } from '../api'

const CATEGORY_LABELS: Record<string, string> = {
  research: 'Research',
  coding: 'Coding',
  writing: 'Writing',
  analysis: 'Analysis',
  productivity: 'Productivity',
}

const CATEGORY_COLORS: Record<string, string> = {
  research: 'bg-blue-950 text-blue-400 border-blue-800',
  coding: 'bg-purple-950 text-purple-400 border-purple-800',
  writing: 'bg-green-950 text-green-400 border-green-800',
  analysis: 'bg-orange-950 text-orange-400 border-orange-800',
  productivity: 'bg-pink-950 text-pink-400 border-pink-800',
}

const MODEL_LABELS: Record<string, string> = {
  'claude-opus-4-6': 'Opus',
  'claude-sonnet-4-6': 'Sonnet',
  'claude-haiku-4-5-20251001': 'Haiku',
}

export default function Templates() {
  const [templates, setTemplates] = useState<AgentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const navigate = useNavigate()

  useEffect(() => {
    templatesApi.list().then(setTemplates).finally(() => setLoading(false))
  }, [])

  const categories = ['all', ...Object.keys(CATEGORY_LABELS)]
  const filtered = filter === 'all' ? templates : templates.filter((t) => t.category === filter)

  const handleCreate = async (template: AgentTemplate) => {
    setCreating(template.id)
    try {
      await templatesApi.create(template.id, template.name)
      navigate('/agents')
    } catch (err) {
      alert(`Failed to create agent: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCreating(null)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Agent Templates</h1>
        <p className="text-gray-500 text-sm">
          Pre-configured Claude agents ready to use. Click any template to create your own copy.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === cat
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-500'
            }`}
          >
            {cat === 'all' ? 'All Templates' : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading templates…</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {filtered.map((template) => (
            <div
              key={template.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col hover:border-gray-700 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="text-3xl">{template.icon}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm">{template.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium border ${
                        CATEGORY_COLORS[template.category] ?? 'bg-gray-800 text-gray-400 border-gray-700'
                      }`}
                    >
                      {CATEGORY_LABELS[template.category]}
                    </span>
                    <span className="text-gray-600 text-xs">{MODEL_LABELS[template.model] ?? template.model}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-gray-400 text-sm mb-4 flex-1">{template.description}</p>

              {/* Suggested prompts preview */}
              <div className="mb-4">
                <p className="text-gray-600 text-xs mb-2">Example prompts:</p>
                <div className="space-y-1">
                  {template.suggestedPrompts.slice(0, 2).map((p, i) => (
                    <div key={i} className="text-gray-500 text-xs bg-gray-800/50 rounded px-2 py-1 truncate">
                      "{p}"
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-4">
                {template.tags.map((tag) => (
                  <span key={tag} className="px-1.5 py-0.5 bg-gray-800 text-gray-500 rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Use button */}
              <button
                onClick={() => handleCreate(template)}
                disabled={creating === template.id}
                className="w-full py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {creating === template.id ? 'Creating…' : 'Use This Agent →'}
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          No templates in this category.
        </div>
      )}
    </div>
  )
}
