import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { agentsApi, conversationsApi } from '../api'
import type { Agent, Conversation, ConversationMessage } from '../api'
import MarkdownRenderer from '../components/MarkdownRenderer'

const MODEL_BADGE: Record<string, string> = {
  'claude-opus-4-6': 'bg-purple-950 text-purple-400 border-purple-800',
  'claude-sonnet-4-6': 'bg-green-950 text-green-400 border-green-800',
  'claude-haiku-4-5-20251001': 'bg-yellow-950 text-yellow-400 border-yellow-800',
}
const MODEL_SHORT: Record<string, string> = {
  'claude-opus-4-6': 'Opus',
  'claude-sonnet-4-6': 'Sonnet',
  'claude-haiku-4-5-20251001': 'Haiku',
}

function formatCost(usd: number) {
  if (!usd || usd < 0.00001) return ''
  if (usd < 0.001) return `<$0.001`
  return `$${usd.toFixed(4)}`
}

export default function Chat() {
  const [searchParams] = useSearchParams()
  const initAgentId = searchParams.get('agentId')

  const [agents, setAgents] = useState<Agent[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [loadingConv, setLoadingConv] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef(false)

  // Load agents + conversations
  useEffect(() => {
    agentsApi.list().then((list) => {
      setAgents(list)
      // Auto-select from URL param or first agent
      const agent = initAgentId ? list.find((a) => a.id === initAgentId) ?? list[0] : list[0]
      if (agent) setSelectedAgent(agent)
    }).catch(() => {})
    conversationsApi.list().then(setConversations).catch(() => {})
  }, [initAgentId])

  const scrollBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => scrollBottom(), [messages, streamBuffer, scrollBottom])

  const loadConversation = async (conv: Conversation) => {
    setLoadingConv(true)
    setActiveConv(conv)
    try {
      const full = await conversationsApi.get(conv.id)
      setMessages(full.messages ?? [])
      const agent = agents.find((a) => a.id === conv.agentId)
      if (agent) setSelectedAgent(agent)
    } finally {
      setLoadingConv(false)
    }
  }

  const startNewChat = () => {
    setActiveConv(null)
    setMessages([])
    setStreamBuffer('')
    inputRef.current?.focus()
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || !selectedAgent || streaming) return
    setInput('')
    abortRef.current = false

    // Optimistically add user message
    const userMsg: ConversationMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages((m) => [...m, userMsg])
    setStreaming(true)
    setStreamBuffer('')

    try {
      let convId = activeConv?.id

      // Create conversation if needed
      if (!convId) {
        const newConv = await conversationsApi.create(selectedAgent.id, text)
        convId = newConv.id
        setActiveConv(newConv)
        setConversations((prev) => [newConv, ...prev])
      }

      // Stream the response
      const response = await fetch(`/api/conversations/${convId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!response.body) throw new Error('No response body')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let assistantMsg: ConversationMessage | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done || abortRef.current) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const chunk = JSON.parse(line.slice(6))
            if (chunk.type === 'text') {
              setStreamBuffer((s) => s + chunk.text)
            } else if (chunk.type === 'done') {
              assistantMsg = chunk.message
              setConversations((prev) =>
                prev.map((c) => (c.id === convId ? { ...c, totalCostUsd: chunk.totalCostUsd } : c))
              )
            }
          } catch { /* skip */ }
        }
      }

      if (assistantMsg) {
        setMessages((m) => [...m, assistantMsg!])
      }
    } catch (err) {
      const errMsg: ConversationMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date().toISOString(),
      }
      setMessages((m) => [...m, errMsg])
    } finally {
      setStreaming(false)
      setStreamBuffer('')
      inputRef.current?.focus()
    }
  }

  const convsByAgent: Record<string, Conversation[]> = {}
  for (const c of conversations) {
    if (!convsByAgent[c.agentId]) convsByAgent[c.agentId] = []
    convsByAgent[c.agentId].push(c)
  }

  return (
    <div className="flex h-full">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Agent selector */}
        <div className="p-3 border-b border-gray-800">
          <select
            value={selectedAgent?.id ?? ''}
            onChange={(e) => {
              const a = agents.find((ag) => ag.id === e.target.value)
              if (a) { setSelectedAgent(a); startNewChat() }
            }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500"
          >
            {agents.length === 0 && <option value="">No agents yet</option>}
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* New chat button */}
        <div className="p-3 border-b border-gray-800">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <span className="text-lg leading-none">+</span> New Chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-600 text-xs">
              No conversations yet.<br />Start chatting below.
            </div>
          ) : (
            conversations.map((conv) => {
              const agent = agents.find((a) => a.id === conv.agentId)
              return (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-gray-800 transition-colors ${
                    activeConv?.id === conv.id ? 'bg-gray-800 border-l-2 border-brand-500' : ''
                  }`}
                >
                  <div className="text-white text-xs font-medium truncate">{conv.title}</div>
                  <div className="text-gray-600 text-xs mt-0.5 truncate">{agent?.name ?? 'Unknown agent'}</div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* ── Chat main area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-3 border-b border-gray-800 flex items-center gap-3 bg-gray-950">
          {selectedAgent ? (
            <>
              <span className="text-lg">◈</span>
              <div>
                <div className="text-white text-sm font-medium">{selectedAgent.name}</div>
                <div className="text-gray-500 text-xs">
                  {MODEL_SHORT[selectedAgent.model] ?? selectedAgent.model}
                  {activeConv?.totalCostUsd ? ` · ${formatCost(activeConv.totalCostUsd)} total` : ''}
                </div>
              </div>
            </>
          ) : (
            <div className="text-gray-500 text-sm">Select an agent to start chatting</div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {loadingConv ? (
            <div className="text-center text-gray-600 text-sm py-12">Loading conversation…</div>
          ) : messages.length === 0 && !streaming ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="text-5xl mb-4">◉</div>
              <div className="text-white text-lg font-semibold mb-2">
                {selectedAgent ? `Chat with ${selectedAgent.name}` : 'Select an agent to begin'}
              </div>
              {selectedAgent && (
                <div className="text-gray-500 text-sm max-w-sm">
                  {selectedAgent.description || 'Ask anything. This conversation will be saved automatically.'}
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      msg.role === 'user'
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}
                  >
                    {msg.role === 'user' ? 'U' : 'C'}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    {msg.role === 'user' ? (
                      <div className="bg-brand-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="bg-gray-900 border border-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm">
                        <MarkdownRenderer content={msg.content} />
                      </div>
                    )}

                    {/* Meta: model + cost */}
                    {msg.role === 'assistant' && msg.usage && (
                      <div className="flex items-center gap-2 px-1">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded border ${MODEL_BADGE[msg.usage.model] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}
                        >
                          {MODEL_SHORT[msg.usage.model] ?? msg.usage.model}
                        </span>
                        {msg.usage.costUsd > 0 && (
                          <span className="text-xs text-gray-600">{formatCost(msg.usage.costUsd)}</span>
                        )}
                        <span className="text-xs text-gray-600">
                          {((msg.usage.inputTokens ?? 0) + (msg.usage.outputTokens ?? 0)).toLocaleString()} tokens
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming assistant bubble */}
              {streaming && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
                    C
                  </div>
                  <div className="bg-gray-900 border border-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[75%]">
                    {streamBuffer ? (
                      <MarkdownRenderer content={streamBuffer} />
                    ) : (
                      <div className="flex gap-1 py-1">
                        <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                    {streamBuffer && (
                      <span className="inline-block w-1.5 h-4 bg-brand-500 animate-pulse ml-0.5 align-text-bottom" />
                    )}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-950">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={selectedAgent ? `Message ${selectedAgent.name}… (Enter to send, Shift+Enter for new line)` : 'Select an agent first…'}
              disabled={!selectedAgent || streaming}
              rows={1}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm outline-none focus:border-brand-500 resize-none disabled:opacity-50 max-h-40 overflow-y-auto"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 160) + 'px'
              }}
            />
            <button
              onClick={() => {
                if (streaming) { abortRef.current = true } else { sendMessage() }
              }}
              disabled={!selectedAgent || (!input.trim() && !streaming)}
              className={`px-4 py-3 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-40 flex-shrink-0 ${
                streaming
                  ? 'bg-red-700 hover:bg-red-800'
                  : 'bg-brand-600 hover:bg-brand-700'
              }`}
            >
              {streaming ? '■' : '↑'}
            </button>
          </div>
          <div className="text-xs text-gray-600 mt-2 text-center">
            Conversations are saved automatically · {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} in history
          </div>
        </div>
      </div>
    </div>
  )
}
