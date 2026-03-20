import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { agentsApi, enhancePrompt, streamPlayground } from '../api'
import type { EnhanceResult, StreamChunk } from '../api'
import MarkdownRenderer from '../components/MarkdownRenderer'

// ─── Constants ────────────────────────────────────────────────────────────────

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
  auto: 'bg-gray-800 text-gray-300 border-gray-600',
}

const MODEL_SHORT: Record<string, string> = {
  'claude-opus-4-6': 'Opus',
  'claude-sonnet-4-6': 'Sonnet',
  'claude-haiku-4-5-20251001': 'Haiku',
  auto: 'Auto',
}

function formatCost(usd: number) {
  if (!usd || usd < 0.00001) return ''
  if (usd < 0.001) return '<$0.001'
  return `$${usd.toFixed(4)}`
}

// ─── VariableForm (lifted from Prompts.tsx) ───────────────────────────────────

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

// ─── OutputPanel ──────────────────────────────────────────────────────────────

interface OutputPanelProps {
  label?: string
  streaming: boolean
  streamBuffer: string
  output: string
  thinkingBuffer: string
  thinkingOpen: boolean
  onToggleThinking: () => void
  format: 'markdown' | 'raw' | 'json'
  usage: StreamChunk['usage'] | null
  error: string | null
}

function OutputPanel({
  label,
  streaming,
  streamBuffer,
  output,
  thinkingBuffer,
  thinkingOpen,
  onToggleThinking,
  format,
  usage,
  error,
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false)
  const content = streaming ? streamBuffer : output

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const renderContent = () => {
    if (!content) return null
    if (format === 'raw') {
      return (
        <pre className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-mono">{content}</pre>
      )
    }
    if (format === 'json') {
      try {
        const parsed = JSON.parse(content)
        return (
          <pre className="text-sm text-green-300 leading-relaxed font-mono whitespace-pre-wrap">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        )
      } catch {
        return <pre className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-mono">{content}</pre>
      }
    }
    return <MarkdownRenderer content={content} />
  }

  if (!streaming && !output && !error) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          {label && <span className="text-xs text-gray-500">{label}</span>}
          {usage && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded border ${
                MODEL_BADGE[usage.model] ?? 'bg-gray-800 text-gray-400 border-gray-700'
              }`}
            >
              {MODEL_SHORT[usage.model] ?? usage.model}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          disabled={!content}
          title="Copy output"
          className="text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors text-sm"
        >
          {copied ? '✓' : '⎘'}
        </button>
      </div>

      <div className="p-4 space-y-3">
        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Thinking amber panel */}
        {thinkingBuffer && (
          <div className="bg-amber-950 border border-amber-800 rounded-xl overflow-hidden">
            <button
              onClick={onToggleThinking}
              className="w-full flex items-center gap-2 px-3 py-2 text-amber-400 text-xs font-medium hover:bg-amber-900 transition-colors"
            >
              <span>{thinkingOpen ? '▾' : '▸'}</span>
              Claude's Reasoning
              <span className="ml-auto text-amber-600">{thinkingBuffer.length} chars</span>
            </button>
            {thinkingOpen && (
              <div className="px-3 pb-3 text-amber-300 text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                {thinkingBuffer}
              </div>
            )}
          </div>
        )}

        {/* Main content */}
        {(streaming || output) && (
          <div className="text-sm text-gray-200 leading-relaxed">
            {renderContent()}
            {streaming && (
              <span className="inline-block w-2 h-4 bg-brand-500 animate-pulse ml-1 align-middle" />
            )}
          </div>
        )}

        {/* Usage footer */}
        {usage && (
          <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
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
    </div>
  )
}

// ─── History entry type ───────────────────────────────────────────────────────

interface HistoryEntry {
  model: string
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  output: string
  usage: StreamChunk['usage'] | null
  timestamp: number
}

const HISTORY_KEY = 'playground-history'

// ─── Main component ───────────────────────────────────────────────────────────

export default function Playground() {
  const navigate = useNavigate()

  // Model & settings
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [modelB, setModelB] = useState('claude-opus-4-6')
  const [abMode, setAbMode] = useState(false)
  const [temperature, setTemperature] = useState(0.7)
  const [thinkingEnabled, setThinkingEnabled] = useState(false)
  const [thinkingBudget, setThinkingBudget] = useState(8000)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Prompts
  const [systemPrompt, setSystemPrompt] = useState('')
  const [systemPromptOpen, setSystemPromptOpen] = useState(false)
  const [userMessage, setUserMessage] = useState('')
  const [variables, setVariables] = useState<string[]>([])
  const [varValues, setVarValues] = useState<Record<string, string>>({})

  // Enhancement
  const [enhancingSystem, setEnhancingSystem] = useState(false)
  const [enhanceSysResult, setEnhanceSysResult] = useState<EnhanceResult | null>(null)
  const [enhancingMsg, setEnhancingMsg] = useState(false)
  const [enhanceMsgResult, setEnhanceMsgResult] = useState<EnhanceResult | null>(null)

  // Conversation
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  // Streaming A
  const [streamingA, setStreamingA] = useState(false)
  const [streamBufferA, setStreamBufferA] = useState('')
  const [outputA, setOutputA] = useState('')
  const [thinkingBufferA, setThinkingBufferA] = useState('')
  const [thinkingOpenA, setThinkingOpenA] = useState(false)
  const [usageA, setUsageA] = useState<StreamChunk['usage'] | null>(null)
  const [errorA, setErrorA] = useState<string | null>(null)

  // Streaming B
  const [streamingB, setStreamingB] = useState(false)
  const [streamBufferB, setStreamBufferB] = useState('')
  const [outputB, setOutputB] = useState('')
  const [thinkingBufferB, setThinkingBufferB] = useState('')
  const [thinkingOpenB, setThinkingOpenB] = useState(false)
  const [usageB, setUsageB] = useState<StreamChunk['usage'] | null>(null)
  const [errorB, setErrorB] = useState<string | null>(null)

  // UI
  const [outputFormat, setOutputFormat] = useState<'markdown' | 'raw' | 'json'>('markdown')
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [savedAgentName, setSavedAgentName] = useState('Playground Agent')
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const abortARef = useRef(false)
  const abortBRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) setHistory(JSON.parse(stored))
    } catch {
      // ignore
    }
  }, [])

  // Variable detection (debounced 300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const combined = userMessage + ' ' + systemPrompt
      const found = [...new Set(Array.from(combined.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1]))]
      setVariables(found)
    }, 300)
    return () => clearTimeout(timer)
  }, [userMessage, systemPrompt])

  // Autosave history after run completes
  useEffect(() => {
    if (!streamingA && outputA && messages.length > 0) {
      const entry: HistoryEntry = {
        model,
        systemPrompt,
        messages,
        output: outputA,
        usage: usageA,
        timestamp: Date.now(),
      }
      setHistory((prev) => {
        const updated = [entry, ...prev].slice(0, 10)
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
        } catch {
          // ignore
        }
        return updated
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingA, outputA])

  const runStream = useCallback(
    async (
      targetModel: string,
      conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
      setStreaming: (v: boolean) => void,
      setStreamBuffer: (fn: (prev: string) => string) => void,
      setOutput: (v: string) => void,
      setThinkingBuffer: (fn: (prev: string) => string) => void,
      setUsage: (v: StreamChunk['usage'] | null) => void,
      setError: (v: string | null) => void,
      abortRef: React.MutableRefObject<boolean>
    ) => {
      abortRef.current = false
      setStreaming(true)
      setStreamBuffer(() => '')
      setOutput('')
      setThinkingBuffer(() => '')
      setUsage(null)
      setError(null)

      let acc = ''
      let thinkAcc = ''

      try {
        for await (const chunk of streamPlayground(targetModel, {
          messages: conversationMessages,
          systemPrompt: systemPrompt.trim() || undefined,
          temperature: thinkingEnabled ? 1 : temperature,
          thinkingEnabled,
          thinkingBudget,
        })) {
          if (abortRef.current) break
          if (chunk.type === 'thinking' && chunk.thinking) {
            thinkAcc += chunk.thinking
            setThinkingBuffer(() => thinkAcc)
          } else if (chunk.type === 'text' && chunk.text) {
            acc += chunk.text
            setStreamBuffer(() => acc)
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
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
        setStreamBuffer(() => acc) // keep final text
      }

      return acc
    },
    [systemPrompt, temperature, thinkingEnabled, thinkingBudget]
  )

  const handleRun = async () => {
    if (!userMessage.trim() || streamingA) return

    const filledMessage = fillVariables(userMessage, varValues)
    const newUserMsg = { role: 'user' as const, content: filledMessage }
    const updatedMessages = [...messages, newUserMsg]
    setMessages(updatedMessages)

    if (abMode) {
      const runA = async () => {
        const result = await runStream(
          model,
          updatedMessages,
          setStreamingA,
          (fn) => setStreamBufferA((prev) => fn(prev)),
          setOutputA,
          (fn) => setThinkingBufferA((prev) => fn(prev)),
          setUsageA,
          setErrorA,
          abortARef
        )
        return result
      }
      const runB = async () => {
        await runStream(
          modelB,
          updatedMessages,
          setStreamingB,
          (fn) => setStreamBufferB((prev) => fn(prev)),
          setOutputB,
          (fn) => setThinkingBufferB((prev) => fn(prev)),
          setUsageB,
          setErrorB,
          abortBRef
        )
      }
      const [resultA] = await Promise.all([runA(), runB()])
      if (resultA) {
        setMessages((prev) => [...prev, { role: 'assistant', content: resultA }])
      }
    } else {
      const result = await runStream(
        model,
        updatedMessages,
        setStreamingA,
        (fn) => setStreamBufferA((prev) => fn(prev)),
        setOutputA,
        (fn) => setThinkingBufferA((prev) => fn(prev)),
        setUsageA,
        setErrorA,
        abortARef
      )
      if (result) {
        setMessages((prev) => [...prev, { role: 'assistant', content: result }])
      }
    }

    setUserMessage('')
  }

  const handleStop = () => {
    abortARef.current = true
    abortBRef.current = true
    setStreamingA(false)
    setStreamingB(false)
    if (streamBufferA) setOutputA(streamBufferA)
    if (streamBufferB) setOutputB(streamBufferB)
    setStreamBufferA('')
    setStreamBufferB('')
  }

  const handleClear = () => {
    setMessages([])
    setStreamBufferA('')
    setOutputA('')
    setThinkingBufferA('')
    setStreamBufferB('')
    setOutputB('')
    setThinkingBufferB('')
    setUsageA(null)
    setUsageB(null)
    setErrorA(null)
    setErrorB(null)
    setUserMessage('')
  }

  const handleEnhanceSystem = async () => {
    if (!systemPrompt.trim() || enhancingSystem) return
    setEnhancingSystem(true)
    try {
      const result = await enhancePrompt(systemPrompt)
      setEnhanceSysResult(result)
      setSystemPrompt(result.enhanced)
    } catch {
      // ignore
    } finally {
      setEnhancingSystem(false)
    }
  }

  const handleEnhanceMsg = async () => {
    if (!userMessage.trim() || enhancingMsg) return
    setEnhancingMsg(true)
    try {
      const result = await enhancePrompt(userMessage)
      setEnhanceMsgResult(result)
      setUserMessage(result.enhanced)
    } catch {
      // ignore
    } finally {
      setEnhancingMsg(false)
    }
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
      setErrorA(err instanceof Error ? err.message : 'Failed to save agent')
      setShowSaveModal(false)
    } finally {
      setSaving(false)
    }
  }

  const restoreHistory = (entry: HistoryEntry) => {
    setModel(entry.model)
    setSystemPrompt(entry.systemPrompt)
    setMessages(entry.messages)
    setOutputA(entry.output)
    setUsageA(entry.usage)
    setShowHistory(false)
  }

  const isRunning = streamingA || streamingB

  return (
    <div className="min-h-full bg-gray-950 p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Playground</h1>
            <p className="text-gray-400 text-sm mt-1">
              Rapidly iterate on prompts, test models, and compose reusable patterns.
            </p>
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-700 rounded-lg transition-colors"
            title="Run history"
          >
            🕒 History
          </button>
        </div>

        {/* Model row */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap flex-1">
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

            {/* A/B toggle */}
            <button
              onClick={() => setAbMode((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                abMode
                  ? 'bg-brand-950 text-brand-400 border-brand-700 ring-1 ring-brand-500'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'
              }`}
              title="A/B split-view"
            >
              A/B ⇄
            </button>

            {/* Model B picker (A/B mode) */}
            {abMode && (
              <div className="flex gap-2 flex-wrap">
                {MODELS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setModelB(m.value)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      modelB === m.value
                        ? m.badge + ' ring-1 ring-offset-0 ring-current'
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Advanced panel */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setAdvancedOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            <span className="font-medium">Advanced</span>
            <span className="text-lg leading-none">{advancedOpen ? '▴' : '▾'}</span>
          </button>
          {advancedOpen && (
            <div className="px-4 pb-4 space-y-4">
              {/* Temperature slider */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">
                  Temperature: {temperature.toFixed(2)}
                  <span className="ml-2 text-gray-600 font-normal">Low = precise · High = creative</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={thinkingEnabled ? 1 : temperature}
                  disabled={thinkingEnabled}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full disabled:opacity-40"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                  <span>0.0</span>
                  <span>1.0</span>
                </div>
              </div>

              {/* Extended Thinking */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={thinkingEnabled}
                    onChange={(e) => setThinkingEnabled(e.target.checked)}
                    className="rounded border-gray-600"
                  />
                  <span className="text-sm text-gray-300">Extended Thinking</span>
                  <span className="text-xs text-gray-600">(forces temperature=1)</span>
                </label>

                {thinkingEnabled && (
                  <div className="ml-7">
                    <label className="text-gray-400 text-xs mb-1 block">
                      Thinking Budget (tokens): {thinkingBudget.toLocaleString()}
                    </label>
                    <input
                      type="range"
                      min={1024}
                      max={32000}
                      step={1024}
                      value={thinkingBudget}
                      onChange={(e) => setThinkingBudget(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                      <span>1K</span>
                      <span>32K</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* System Prompt (collapsible) */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSystemPromptOpen((v) => !v)}
              className="flex-1 flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors text-left"
            >
              <span className="font-medium">
                System Prompt{' '}
                <span className="text-gray-600 font-normal">(optional)</span>
              </span>
              <span className="text-lg leading-none">{systemPromptOpen ? '▴' : '▾'}</span>
            </button>
            <button
              onClick={handleEnhanceSystem}
              disabled={enhancingSystem || !systemPrompt.trim()}
              className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-yellow-400 border border-gray-700 rounded-lg transition-colors"
            >
              {enhancingSystem ? '…' : '✨ Enhance'}
            </button>
          </div>
          {systemPromptOpen && (
            <div className="px-4 pb-4 space-y-2">
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant…"
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500 resize-none placeholder-gray-600"
              />
              {enhanceSysResult && (
                <div className="bg-yellow-950/20 border border-yellow-900/50 rounded-lg px-3 py-2">
                  <div className="text-xs font-medium text-yellow-400 mb-1">✨ System prompt enhanced</div>
                  <div className="flex flex-wrap gap-1">
                    {enhanceSysResult.improvements.map((imp, i) => (
                      <span key={i} className="text-xs bg-yellow-950/40 text-yellow-500 border border-yellow-900/50 px-2 py-0.5 rounded-full">
                        {imp}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setSystemPrompt(enhanceSysResult.original)
                      setEnhanceSysResult(null)
                    }}
                    className="text-xs text-gray-600 hover:text-gray-400 mt-1 transition-colors"
                  >
                    ↩ Undo enhancement
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Conversation thread */}
        {messages.length > 0 && (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'user' ? (
                  <div className="max-w-[80%] bg-gray-800 border border-gray-700 px-4 py-3 rounded-2xl rounded-tr-sm text-sm text-gray-200 whitespace-pre-wrap">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[80%] bg-gray-900 border border-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm text-sm text-gray-200">
                    <MarkdownRenderer content={msg.content} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Message input */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Message</label>
            <button
              onClick={handleEnhanceMsg}
              disabled={enhancingMsg || !userMessage.trim()}
              className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-yellow-400 border border-gray-700 rounded-lg transition-colors"
            >
              {enhancingMsg ? '…' : '✨ Enhance'}
            </button>
          </div>
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
          {/* Live token estimator */}
          <p className="text-xs text-gray-600">~{Math.ceil(userMessage.length / 4)} tokens</p>

          {enhanceMsgResult && (
            <div className="bg-yellow-950/20 border border-yellow-900/50 rounded-lg px-3 py-2">
              <div className="text-xs font-medium text-yellow-400 mb-1">✨ Message enhanced</div>
              <div className="flex flex-wrap gap-1">
                {enhanceMsgResult.improvements.map((imp, i) => (
                  <span key={i} className="text-xs bg-yellow-950/40 text-yellow-500 border border-yellow-900/50 px-2 py-0.5 rounded-full">
                    {imp}
                  </span>
                ))}
              </div>
              <button
                onClick={() => {
                  setUserMessage(enhanceMsgResult.original)
                  setEnhanceMsgResult(null)
                }}
                className="text-xs text-gray-600 hover:text-gray-400 mt-1 transition-colors"
              >
                ↩ Undo enhancement
              </button>
            </div>
          )}

          {/* Variable form */}
          <VariableForm
            variables={variables}
            values={varValues}
            onChange={(k, v) => setVarValues((prev) => ({ ...prev, [k]: v }))}
          />
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2">
            {isRunning ? (
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
            <button
              onClick={handleClear}
              disabled={isRunning}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-sm border border-gray-700 rounded-lg transition-colors"
              title="Clear conversation"
            >
              🗑 Clear
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Output format toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              {(['markdown', 'raw', 'json'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setOutputFormat(fmt)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    outputFormat === fmt
                      ? 'bg-gray-700 text-gray-100'
                      : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {fmt === 'markdown' ? 'MD' : fmt.toUpperCase()}
                </button>
              ))}
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
        </div>

        {/* Output panels */}
        {(streamingA || outputA || errorA || streamingB || outputB || errorB) && (
          <div className={abMode ? 'grid grid-cols-2 gap-4' : 'space-y-4'}>
            <OutputPanel
              label={abMode ? MODEL_SHORT[model] ?? model : undefined}
              streaming={streamingA}
              streamBuffer={streamBufferA}
              output={outputA}
              thinkingBuffer={thinkingBufferA}
              thinkingOpen={thinkingOpenA}
              onToggleThinking={() => setThinkingOpenA((v) => !v)}
              format={outputFormat}
              usage={usageA}
              error={errorA}
            />
            {abMode && (
              <OutputPanel
                label={MODEL_SHORT[modelB] ?? modelB}
                streaming={streamingB}
                streamBuffer={streamBufferB}
                output={outputB}
                thinkingBuffer={thinkingBufferB}
                thinkingOpen={thinkingOpenB}
                onToggleThinking={() => setThinkingOpenB((v) => !v)}
                format={outputFormat}
                usage={usageB}
                error={errorB}
              />
            )}
          </div>
        )}

        <div ref={bottomRef} />
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

      {/* History slide-over */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setShowHistory(false)} />
          <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="text-white font-semibold">Run History</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-500 hover:text-gray-200 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.length === 0 ? (
                <p className="text-gray-600 text-sm text-center mt-8">No history yet.</p>
              ) : (
                history.map((entry, i) => (
                  <button
                    key={i}
                    onClick={() => restoreHistory(entry)}
                    className="w-full text-left bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg p-3 transition-colors space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${MODEL_BADGE[entry.model] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        {MODEL_SHORT[entry.model] ?? entry.model}
                      </span>
                      <span className="text-xs text-gray-600 ml-auto">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {entry.messages.find((m) => m.role === 'user')?.content ?? ''}
                    </p>
                    <p className="text-xs text-gray-600 truncate">{entry.output}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
