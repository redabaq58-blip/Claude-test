import { useState } from 'react'
import { compareApi } from '../api'
import type { CompareResult } from '../api'
import MarkdownRenderer from '../components/MarkdownRenderer'

const MODEL_INFO: Record<string, { label: string; color: string; badge: string; desc: string }> = {
  'claude-opus-4-6': {
    label: 'Opus',
    color: 'border-purple-700',
    badge: 'bg-purple-950 text-purple-400 border-purple-800',
    desc: 'Most capable · Complex reasoning',
  },
  'claude-sonnet-4-6': {
    label: 'Sonnet',
    color: 'border-green-700',
    badge: 'bg-green-950 text-green-400 border-green-800',
    desc: 'Balanced · Best all-around',
  },
  'claude-haiku-4-5-20251001': {
    label: 'Haiku',
    color: 'border-yellow-700',
    badge: 'bg-yellow-950 text-yellow-400 border-yellow-800',
    desc: 'Fastest · Most affordable',
  },
}

const BADGE_ICONS: Record<string, { icon: string; label: string; color: string }> = {
  fastest: { icon: '⚡', label: 'Fastest', color: 'text-yellow-400' },
  cheapest: { icon: '💰', label: 'Cheapest', color: 'text-green-400' },
  most_detailed: { icon: '📝', label: 'Most Detailed', color: 'text-blue-400' },
}

const EXAMPLE_PROMPTS = [
  'Explain the concept of quantum entanglement to a curious 12-year-old.',
  'Write a Python function to find the nth Fibonacci number, with error handling.',
  'What are the key differences between REST and GraphQL APIs?',
  'Analyze the pros and cons of remote work for both employees and companies.',
  'Write a haiku about artificial intelligence.',
]

function formatMs(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatCost(usd: number) {
  if (!usd) return '$0.000'
  return `$${usd.toFixed(5)}`
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-3 bg-gray-800 rounded w-3/4" />
      <div className="h-3 bg-gray-800 rounded w-full" />
      <div className="h-3 bg-gray-800 rounded w-5/6" />
      <div className="h-3 bg-gray-800 rounded w-2/3" />
      <div className="h-3 bg-gray-800 rounded w-full" />
      <div className="h-3 bg-gray-800 rounded w-4/5" />
    </div>
  )
}

export default function Compare() {
  const [prompt, setPrompt] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [showSystem, setShowSystem] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<CompareResult[] | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleCompare = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const data = await compareApi.compare(prompt.trim(), systemPrompt.trim() || undefined)
      setResults(data.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  const copyMarkdown = () => {
    if (!results) return
    const md = results
      .map((r) => {
        const info = MODEL_INFO[r.model]
        return `## ${info?.label ?? r.model}\n\n${r.output}\n\n*Cost: ${formatCost(r.costUsd)} · Time: ${formatMs(r.durationMs)} · Tokens: ${r.inputTokens + r.outputTokens}*`
      })
      .join('\n\n---\n\n')
    const full = `# Model Comparison\n\n**Prompt:** ${prompt}\n\n---\n\n${md}`
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Model Comparator</h1>
        <p className="text-gray-500 text-sm">
          Run the same prompt on all Claude models simultaneously. See which is best for your use case.
        </p>
      </div>

      {/* Input area */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCompare()
          }}
          placeholder="Enter your prompt here… (⌘+Enter to compare)"
          rows={4}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm outline-none focus:border-brand-500 resize-none"
        />

        {/* System prompt toggle */}
        <div className="mt-3">
          <button
            onClick={() => setShowSystem(!showSystem)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showSystem ? '▼' : '▶'} System prompt (optional)
          </button>
          {showSystem && (
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Optional system prompt applied to all models…"
              rows={2}
              className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm outline-none focus:border-brand-500 resize-none"
            />
          )}
        </div>

        {/* Example prompts */}
        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLE_PROMPTS.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="text-xs bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 border border-gray-700 rounded-lg px-2.5 py-1 transition-colors truncate max-w-[220px]"
            >
              {ex.slice(0, 40)}{ex.length > 40 ? '…' : ''}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-3">
            {results && (
              <button
                onClick={copyMarkdown}
                className="px-3 py-1.5 text-xs bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy as Markdown'}
              </button>
            )}
          </div>
          <button
            onClick={handleCompare}
            disabled={!prompt.trim() || loading}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Comparing…
              </>
            ) : (
              '⚖ Compare All Models'
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-950/30 border border-red-800 text-red-400 rounded-lg px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Results grid */}
      {(loading || results) && (
        <div className="grid grid-cols-3 gap-5">
          {(['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] as const).map((model) => {
            const info = MODEL_INFO[model]
            const result = results?.find((r) => r.model === model)

            return (
              <div
                key={model}
                className={`bg-gray-900 border rounded-xl overflow-hidden flex flex-col ${info.color}`}
              >
                {/* Column header */}
                <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${info.badge}`}>
                    {info.label}
                  </span>
                  <span className="text-gray-500 text-xs">{info.desc}</span>
                </div>

                {/* Stats bar */}
                {result && !result.error && (
                  <div className="px-4 py-2 border-b border-gray-800 flex gap-4 text-xs">
                    {result.badges.map((b) => {
                      const badge = BADGE_ICONS[b]
                      return badge ? (
                        <span key={b} className={`font-medium ${badge.color}`}>
                          {badge.icon} {badge.label}
                        </span>
                      ) : null
                    })}
                    <span className="text-gray-500 ml-auto">{formatMs(result.durationMs)}</span>
                    <span className="text-gray-500">{formatCost(result.costUsd)}</span>
                    <span className="text-gray-600">{(result.inputTokens + result.outputTokens).toLocaleString()}t</span>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 p-4 overflow-y-auto max-h-[600px]">
                  {loading && !result ? (
                    <Skeleton />
                  ) : result?.error ? (
                    <div className="text-red-400 text-sm bg-red-950/30 border border-red-900 rounded-lg p-3">
                      {result.error}
                    </div>
                  ) : result?.output ? (
                    <MarkdownRenderer content={result.output} />
                  ) : null}
                </div>

                {/* Copy button */}
                {result?.output && (
                  <div className="px-4 py-2 border-t border-gray-800">
                    <button
                      onClick={() => navigator.clipboard.writeText(result.output)}
                      className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      Copy response
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && !results && !error && (
        <div className="text-center py-20 text-gray-600">
          <div className="text-5xl mb-4">⚖</div>
          <p className="text-sm">Enter a prompt above and click Compare to see all three Claude models respond simultaneously.</p>
          <p className="text-xs mt-2 text-gray-700">Results appear side-by-side with cost, speed, and detail badges.</p>
        </div>
      )}
    </div>
  )
}
