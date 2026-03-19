import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { agentsApi, streamPlayground } from '../api'
import type { StreamChunk } from '../api'
import MarkdownRenderer from '../components/MarkdownRenderer'

const MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku', badge: 'bg-yellow-950 text-yellow-400 border-yellow-800' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet', badge: 'bg-green-950 text-green-400 border-green-800' },
  { value: 'claude-opus-4-6', label: 'Opus', badge: 'bg-purple-950 text-purple-400 border-purple-800' },
  { value: 'auto', label: 'Auto', badge: 'bg-gray-800 text-gray-300 border-gray-600' },
]

const MODEL_BADGE: Record<string, string> = {
  'claude-opus-4-6': 'bg-purple-950 text-purple-400 border-purple-800',
  'claude-sonnet-4-6': 'bg-green-950 text-green-400 border-green-800',
  'claude-haiku-4-5-20251001': 'bg-yellow-950 text-yellow-400 border-yellow-800',
}
const MODEL_SHORT: Record<string, string> = {
  'claude-opus-4-6': 'Opus',
  'claude-sonnet-4-6': 'Sonnet',
  'claude-haiku-4-5-20251001': 'Haiku',
  auto: 'Auto',
}

function formatCost(usd: number) {
  if (!usd || usd < 0.00001) return ''
  if (usd < 0.001) return `<$0.001`
  return `$${usd.toFixed(4)}`
}

export default function Playground() {
  const navigate = useNavigate()

  const [model, setModel] = useState('claude-sonnet-4-6')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [systemPromptOpen, setSystemPromptOpen] = useState(false)
  const [userMessage, setUserMessage] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [output, setOutput] = useState('')
  const [streamBuffer, setStreamBuffer] = useState('')
  const [usage, setUsage] = useState<StreamChunk['usage'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [savedAgentName, setSavedAgentName] = useState('Playground Agent')
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const abortRef = useRef(false)
  const outputRef = useRef<HTMLDivElement>(null)

  const handleRun = async () => {
    if (!userMessage.trim() || streaming) return
    abortRef.current = false
    setStreaming(true)
    setStreamBuffer('')
    setOutput('')
    setUsage(null)
    setError(null)

    let acc = ''
    try {
      for await (const chunk of streamPlayground(
        userMessage,
        model,
        systemPrompt.trim() || undefined
      )) {
        if (abortRef.current) break
        if (chunk.type === 'text' && chunk.text) {
          acc += chunk.text
          setStreamBuffer(acc)
          outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
        } else if (chunk.type === 'done') {
          setOutput(acc)
          if (chunk.usage) setUsage(chunk.usage)
        } else if (chunk.type === 'error') {
          setError(chunk.error ?? 'Unknown error')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setStreaming(false)
      setStreamBuffer('')
    }
  }

  const handleStop = () => {
    abortRef.current = true
    setStreaming(false)
    if (streamBuffer) setOutput(streamBuffer)
    setStreamBuffer('')
  }

  const handleSave = async () => {
    if (!savedAgentName.trim()) return
    setSaving(true)
    try {
      await agentsApi.create({
        name: savedAgentName.trim(),
        model,
        systemPrompt,
        description: 'Created from Playground',
      })
      setSavedSuccess(true)
      setTimeout(() => {
        setShowSaveModal(false)
        setSavedSuccess(false)
        navigate('/agents')
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agent')
      setShowSaveModal(false)
    } finally {
      setSaving(false)
    }
  }

  const showOutput = streaming || output || error

  return (
    <div className="min-h-full bg-gray-950 p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Playground</h1>
          <p className="text-gray-400 text-sm mt-1">
            Test any prompt instantly — no agent setup required.
          </p>
        </div>

        {/* Model Picker */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Model</label>
          <div className="flex gap-2 flex-wrap">
            {MODELS.map((m) => (
              <button
                key={m.value}
                onClick={() => setModel(m.value)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  model === m.value
                    ? m.badge + ' ring-1 ring-offset-0 ring-current'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* System Prompt (collapsible) */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setSystemPromptOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            <span className="font-medium">
              System Prompt{' '}
              <span className="text-gray-600 font-normal">(optional)</span>
            </span>
            <span className="text-lg leading-none">{systemPromptOpen ? '▴' : '▾'}</span>
          </button>
          {systemPromptOpen && (
            <div className="px-4 pb-4">
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant…"
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500 resize-none placeholder-gray-600"
              />
            </div>
          )}
        </div>

        {/* User Message */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Message</label>
          <textarea
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleRun()
            }}
            placeholder="Write your prompt here… (⌘Enter to run)"
            rows={5}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500 resize-none placeholder-gray-600"
          />
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            {streaming ? (
              <button
                onClick={handleStop}
                className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                ■ Stop
              </button>
            ) : (
              <button
                onClick={handleRun}
                disabled={!userMessage.trim()}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                ▶ Run
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setSavedAgentName('Playground Agent')
              setShowSaveModal(true)
            }}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium border border-gray-700 rounded-lg transition-colors"
          >
            Save as Agent
          </button>
        </div>

        {/* Output */}
        {showOutput && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Output</div>

            {error && (
              <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            {(streaming || output) && (
              <div className="text-sm text-gray-200 leading-relaxed">
                <MarkdownRenderer content={streaming ? streamBuffer : output} />
                {streaming && (
                  <span className="inline-block w-2 h-4 bg-brand-500 animate-pulse ml-1 align-middle" />
                )}
              </div>
            )}

            {usage && (
              <div className="flex items-center gap-3 pt-3 border-t border-gray-800">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded border ${
                    MODEL_BADGE[usage.model] ?? 'bg-gray-800 text-gray-400 border-gray-700'
                  }`}
                >
                  {MODEL_SHORT[usage.model] ?? usage.model}
                </span>
                <span className="text-xs text-gray-600">
                  {(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens
                </span>
                {formatCost(usage.costUsd) && (
                  <span className="text-xs text-gray-600 font-mono">{formatCost(usage.costUsd)}</span>
                )}
                <span className="text-xs text-gray-600">{usage.durationMs}ms</span>
              </div>
            )}
          </div>
        )}

        <div ref={outputRef} />
      </div>

      {/* Save as Agent modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h2 className="text-white font-semibold">Save as Agent</h2>
            {savedSuccess ? (
              <p className="text-green-400 text-sm">Agent saved! Redirecting…</p>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Agent name</label>
                  <input
                    value={savedAgentName}
                    onChange={(e) => setSavedAgentName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    autoFocus
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="px-4 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !savedAgentName.trim()}
                    className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
