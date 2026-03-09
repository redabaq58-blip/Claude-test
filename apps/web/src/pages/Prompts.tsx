import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { promptsApi, enhancePrompt } from '../api'
import type { Prompt } from '../api'

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
  '': '',
}

function highlightVariables(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, '<mark class="bg-yellow-900/60 text-yellow-300 rounded px-0.5">{{$1}}</mark>')
}

interface VariableFormProps {
  variables: string[]
  values: Record<string, string>
  onChange: (key: string, val: string) => void
}

function VariableForm({ variables, values, onChange }: VariableFormProps) {
  if (variables.length === 0) return null
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Fill in variables</p>
      {variables.map((v) => (
        <div key={v} className="flex items-center gap-2">
          <label className="text-xs text-yellow-400 font-mono w-28 shrink-0">{`{{${v}}}`}</label>
          <input
            type="text"
            value={values[v] ?? ''}
            onChange={(e) => onChange(v, e.target.value)}
            placeholder={`Enter ${v}…`}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-brand-500 placeholder-gray-600"
          />
        </div>
      ))}
    </div>
  )
}

function fillVariables(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`)
}

interface PromptCardProps {
  prompt: Prompt
  onUseInChat: (filled: string) => void
}

function PromptCard({ prompt, onUseInChat }: PromptCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [varValues, setVarValues] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [enhanced, setEnhanced] = useState<string | null>(null)

  const handleVarChange = (key: string, val: string) => {
    setVarValues((prev) => ({ ...prev, [key]: val }))
    setEnhanced(null)
  }

  const filled = fillVariables(prompt.content, varValues)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(filled)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleEnhance = async () => {
    setEnhancing(true)
    try {
      const result = await enhancePrompt(filled, 'detailed')
      setEnhanced(result.enhanced)
    } catch {
      // silently ignore
    } finally {
      setEnhancing(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm truncate">{prompt.title}</h3>
            {prompt.description && (
              <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{prompt.description}</p>
            )}
          </div>
          <span className="text-gray-600 text-sm mt-0.5">{expanded ? '▲' : '▼'}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span
            className={`px-1.5 py-0.5 rounded text-xs font-medium border ${
              CATEGORY_COLORS[prompt.category] ?? 'bg-gray-800 text-gray-400 border-gray-700'
            }`}
          >
            {CATEGORY_LABELS[prompt.category] ?? prompt.category}
          </span>
          {prompt.model && prompt.model !== 'auto' && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-gray-800 text-gray-500 border border-gray-700">
              {MODEL_LABELS[prompt.model] ?? prompt.model}
            </span>
          )}
          {prompt.variables.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-950 text-yellow-500 border border-yellow-900">
              {prompt.variables.length} var{prompt.variables.length !== 1 ? 's' : ''}
            </span>
          )}
          {prompt.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 bg-gray-800 text-gray-600 rounded text-xs">
              {tag}
            </span>
          ))}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-4">
          {/* Variable inputs */}
          <VariableForm
            variables={prompt.variables}
            values={varValues}
            onChange={handleVarChange}
          />

          {/* Prompt content */}
          <div>
            <p className="text-xs text-gray-600 mb-2 font-medium uppercase tracking-wide">Prompt</p>
            <div
              className="bg-gray-800/60 rounded-lg p-3 text-sm text-gray-300 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlightVariables(filled) }}
            />
          </div>

          {/* Enhanced version */}
          {enhanced && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs text-brand-400 font-medium uppercase tracking-wide">AI-Enhanced</p>
                <button
                  onClick={() => setEnhanced(null)}
                  className="text-gray-600 hover:text-gray-400 text-xs"
                >
                  ✕ dismiss
                </button>
              </div>
              <div className="bg-brand-950/30 border border-brand-900/50 rounded-lg p-3 text-sm text-gray-300 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                {enhanced}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleEnhance}
              disabled={enhancing}
              className="px-3 py-1.5 text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:border-gray-500 disabled:opacity-50 transition-colors"
            >
              {enhancing ? 'Enhancing…' : '✦ AI Enhance'}
            </button>
            <button
              onClick={() => onUseInChat(enhanced ?? filled)}
              className="px-3 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
            >
              Use in Chat →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Prompts() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    promptsApi.list().then(setPrompts).finally(() => setLoading(false))
  }, [])

  const categories = ['all', ...Object.keys(CATEGORY_LABELS)]

  const filtered = prompts.filter((p) => {
    const matchCat = filter === 'all' || p.category === filter
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    return matchCat && matchSearch
  })

  const handleUseInChat = useCallback(
    (content: string) => {
      navigate(`/chat?prompt=${encodeURIComponent(content)}`)
    },
    [navigate]
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Prompt Library</h1>
        <p className="text-gray-500 text-sm">
          Battle-tested prompts for every use case. Fill in variables and use directly in chat.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-2 flex-wrap">
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
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search prompts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-500 w-52 placeholder-gray-600"
        />
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading prompt library…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-sm">No prompts match your search.</p>
        </div>
      ) : (
        <>
          <p className="text-gray-600 text-xs mb-4">{filtered.length} prompt{filtered.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filtered.map((prompt) => (
              <PromptCard key={prompt.id} prompt={prompt} onUseInChat={handleUseInChat} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
