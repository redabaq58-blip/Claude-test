/**
 * Forge Studio — Visual Agent Canvas
 *
 * Drag-and-drop canvas for building multi-agent forge() workflows visually.
 * Features:
 *   - Role Library sidebar (10 pre-built agent roles)
 *   - Canvas with Agent, Condition, Human Checkpoint, and Output nodes
 *   - SVG connection arrows between nodes
 *   - Node editor panel (edit role/goal/backstory/tools/model)
 *   - "View Code" — generates TypeScript forge() equivalent
 *   - "Deploy" — creates REST endpoint for the flow
 *   - Live run output panel with SSE streaming
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { forgeApi, studioApi } from '../api'
import type { ForgeAgent } from '../api'

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType = 'start' | 'agent' | 'human_checkpoint' | 'condition' | 'output'

interface CanvasNode {
  id: string
  type: NodeType
  x: number
  y: number
  data: {
    label?: string
    role?: string
    goal?: string
    backstory?: string
    model?: string
    roleKey?: string
    condition?: string
    prompt?: string
    variables?: string[]
  }
}

interface CanvasEdge {
  id: string
  source: string
  target: string
  label?: string
}

interface StudioFlow {
  id: string
  name: string
  description?: string
  isDeployed?: boolean
  runCount?: number
}

interface RunOutput {
  type: string
  agent?: string
  output?: string
  costUsd?: number
  status?: string
  message?: string
}

// ─── Role Library data ────────────────────────────────────────────────────────

const ROLES = [
  {
    key: 'research-analyst', role: 'Research Analyst', icon: '🔍', color: '#3b82f6',
    goal: 'Conduct thorough research on {topic} and synthesize key findings into a clear, actionable report',
    backstory: 'You are a meticulous researcher with expertise in finding and evaluating information from diverse sources. You prioritize accuracy, always cite sources, and clearly distinguish facts from opinions.',
    model: 'claude-sonnet-4-6',
  },
  {
    key: 'content-writer', role: 'Content Writer', icon: '✍️', color: '#8b5cf6',
    goal: 'Write engaging, well-structured content that serves the target audience and achieves the communication objective',
    backstory: 'You are a skilled writer who adapts tone and style to context. You create content that is clear, compelling, and tailored to the reader.',
    model: 'claude-sonnet-4-6',
  },
  {
    key: 'code-reviewer', role: 'Code Reviewer', icon: '🧑‍💻', color: '#10b981',
    goal: 'Review code for quality, security vulnerabilities, performance issues, and adherence to best practices',
    backstory: 'You are a senior engineer with deep expertise in code quality. You identify bugs, security risks, and architectural issues, and always explain the why behind your feedback.',
    model: 'claude-opus-4-6',
  },
  {
    key: 'data-analyst', role: 'Data Analyst', icon: '📊', color: '#f59e0b',
    goal: 'Analyze the provided data and extract actionable insights with clear visualisation recommendations',
    backstory: 'You are an analytical thinker who turns raw data into business intelligence. You apply statistical reasoning, identify trends, and communicate findings to both technical and non-technical audiences.',
    model: 'claude-sonnet-4-6',
  },
  {
    key: 'qa-reviewer', role: 'QA Reviewer', icon: '🧪', color: '#ef4444',
    goal: 'Evaluate the output quality, identify gaps or errors, and score it on a scale of 1-10 with specific improvement feedback',
    backstory: 'You are a quality assurance specialist with a keen eye for detail. You systematically evaluate outputs against requirements and provide structured, actionable feedback.',
    model: 'claude-haiku-4-5-20251001',
  },
  {
    key: 'customer-support', role: 'Support Specialist', icon: '📞', color: '#06b6d4',
    goal: 'Resolve the customer issue with empathy, accuracy, and efficiency while maintaining brand voice',
    backstory: 'You are a patient, empathetic support specialist who genuinely cares about solving customer problems. You balance friendliness with professionalism and always follow up to confirm resolution.',
    model: 'claude-haiku-4-5-20251001',
  },
  {
    key: 'developer', role: 'Senior Developer', icon: '⚙️', color: '#6366f1',
    goal: 'Write clean, production-ready code that solves the problem with proper error handling and documentation',
    backstory: 'You are a senior software engineer who writes maintainable, performant code. You follow SOLID principles, consider edge cases, and always think about the long-term maintainability of the solution.',
    model: 'claude-opus-4-6',
  },
  {
    key: 'product-manager', role: 'Product Manager', icon: '📋', color: '#ec4899',
    goal: 'Define clear requirements, user stories, and acceptance criteria that align engineering and business goals',
    backstory: 'You are a product manager who bridges user needs and technical capabilities. You write precise specs, prioritize ruthlessly, and always tie features back to measurable outcomes.',
    model: 'claude-sonnet-4-6',
  },
  {
    key: 'financial-analyst', role: 'Financial Analyst', icon: '💰', color: '#84cc16',
    goal: 'Analyze the financial data and produce clear investment or business insights with supporting quantitative reasoning',
    backstory: 'You are a rigorous financial analyst who combines quantitative modelling with business intuition. You present findings with appropriate uncertainty ranges and always flag key assumptions.',
    model: 'claude-opus-4-6',
  },
  {
    key: 'devops-engineer', role: 'DevOps Engineer', icon: '🚀', color: '#f97316',
    goal: 'Analyze the infrastructure problem, diagnose root causes, and recommend concrete solutions with implementation steps',
    backstory: 'You are a DevOps engineer who thinks in systems. You balance reliability, cost, and developer experience, and always consider operational concerns like observability, rollback strategies, and failure modes.',
    model: 'claude-sonnet-4-6',
  },
]

const NODE_WIDTH = 200
const NODE_HEIGHT = 80

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nodeColor(type: NodeType): string {
  switch (type) {
    case 'start': return '#22c55e'
    case 'agent': return '#3b82f6'
    case 'human_checkpoint': return '#f59e0b'
    case 'condition': return '#8b5cf6'
    case 'output': return '#10b981'
    default: return '#6b7280'
  }
}

function nodeLabel(node: CanvasNode): string {
  switch (node.type) {
    case 'start': return `▶ Start`
    case 'agent': return node.data.role ?? 'Agent'
    case 'human_checkpoint': return '✋ Human Checkpoint'
    case 'condition': return `? ${(node.data.condition ?? 'condition').slice(0, 20)}`
    case 'output': return '◀ Output'
    default: return node.type
  }
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 9)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ForgeStudio() {
  const [flows, setFlows] = useState<StudioFlow[]>([])
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null)
  const [flowName, setFlowName] = useState('My Workflow')
  const [flowDescription, setFlowDescription] = useState('')
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [edges, setEdges] = useState<CanvasEdge[]>([])
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null) // source node id
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  const [runOutput, setRunOutput] = useState<RunOutput[]>([])
  const [runInputs, setRunInputs] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'canvas' | 'runs'>('canvas')
  const [inputVars, setInputVars] = useState<string[]>([])
  const [showInputModal, setShowInputModal] = useState(false)
  const canvasRef = useRef<SVGSVGElement>(null)

  // ── Load flows list ────────────────────────────────────────────────────────
  useEffect(() => {
    studioApi.listFlows().then(setFlows).catch(console.error)
  }, [])

  // ── Auto-detect input variables from nodes ────────────────────────────────
  useEffect(() => {
    const vars = new Set<string>()
    nodes.forEach(n => {
      const text = `${n.data.goal ?? ''} ${n.data.label ?? ''}`
      const matches = text.matchAll(/\{(\w+)\}/g)
      for (const m of matches) vars.add(m[1])
    })
    setInputVars(Array.from(vars))
  }, [nodes])

  // ── Drag from sidebar to canvas ────────────────────────────────────────────
  const handleSidebarDrop = useCallback((e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault()
    const roleKey = e.dataTransfer.getData('roleKey')
    const blockType = e.dataTransfer.getData('blockType') as NodeType | undefined
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return

    const x = e.clientX - canvasRect.left - NODE_WIDTH / 2
    const y = e.clientY - canvasRect.top - NODE_HEIGHT / 2

    if (roleKey) {
      const role = ROLES.find(r => r.key === roleKey)
      setNodes(prev => [...prev, {
        id: makeId(),
        type: 'agent',
        x: Math.max(0, x),
        y: Math.max(0, y),
        data: {
          roleKey,
          role: role?.role ?? 'Agent',
          goal: role?.goal ?? `Complete your task as ${role?.role}`,
          backstory: role?.backstory ?? '',
          model: role?.model ?? 'claude-sonnet-4-6',
        },
      }])
    } else if (blockType) {
      setNodes(prev => [...prev, {
        id: makeId(),
        type: blockType,
        x: Math.max(0, x),
        y: Math.max(0, y),
        data: blockType === 'start'
          ? { label: flowName, variables: [] }
          : blockType === 'human_checkpoint'
            ? { prompt: 'Please review and provide feedback.' }
            : blockType === 'condition'
              ? { condition: '$prev.score >= 7' }
              : { label: 'Final Output' },
      }])
    }
  }, [flowName])

  // ── ESC to cancel connecting ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setConnecting(null); setMousePos(null) } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Node dragging ──────────────────────────────────────────────────────────
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    if (connecting) return
    e.stopPropagation()
    const node = nodes.find(n => n.id === id)!
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return
    setDragging({ id, offsetX: (e.clientX - canvasRect.left) - node.x, offsetY: (e.clientY - canvasRect.top) - node.y })
    setSelectedNode(id)
  }

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return
    if (connecting) {
      setMousePos({ x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top })
    }
    if (!dragging) return
    setNodes(prev => prev.map(n =>
      n.id === dragging.id
        ? { ...n, x: (e.clientX - canvasRect.left) - dragging.offsetX, y: (e.clientY - canvasRect.top) - dragging.offsetY }
        : n
    ))
  }, [dragging, connecting])

  const handleMouseUp = useCallback(() => {
    setDragging(null)
  }, [])

  // ── Connection drawing ─────────────────────────────────────────────────────
  const startConnect = (sourceId: string) => {
    setConnecting(sourceId)
    setMousePos(null)
  }

  const completeConnect = (targetId: string) => {
    if (!connecting || connecting === targetId) {
      setConnecting(null)
      setMousePos(null)
      return
    }
    setEdges(prev => [...prev, { id: makeId(), source: connecting, target: targetId }])
    setConnecting(null)
    setMousePos(null)
  }

  // ── Delete selected node ───────────────────────────────────────────────────
  const deleteSelected = () => {
    if (!selectedNode) return
    setNodes(prev => prev.filter(n => n.id !== selectedNode))
    setEdges(prev => prev.filter(e => e.source !== selectedNode && e.target !== selectedNode))
    setSelectedNode(null)
  }

  // ── Update selected node data ──────────────────────────────────────────────
  const updateNodeData = (field: string, value: string) => {
    setNodes(prev => prev.map(n =>
      n.id === selectedNode ? { ...n, data: { ...n.data, [field]: value } } : n
    ))
  }

  // ── Save flow ──────────────────────────────────────────────────────────────
  const saveFlow = async () => {
    const definition = { nodes, edges, variables: inputVars }
    if (activeFlowId) {
      await studioApi.updateFlow(activeFlowId, { name: flowName, description: flowDescription, definition })
    } else {
      const result = await studioApi.createFlow({ name: flowName, description: flowDescription, definition })
      setActiveFlowId(result.id)
    }
    const updated = await studioApi.listFlows()
    setFlows(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── View Code ─────────────────────────────────────────────────────────────
  const viewCode = async () => {
    if (!activeFlowId) {
      await saveFlow()
    }
    if (activeFlowId) {
      const { code } = await studioApi.getCode(activeFlowId)
      setGeneratedCode(code)
      setShowCode(true)
    }
  }

  // ── Deploy ────────────────────────────────────────────────────────────────
  const deploy = async () => {
    if (!activeFlowId) await saveFlow()
    if (activeFlowId) {
      await studioApi.deploy(activeFlowId)
      const updated = await studioApi.listFlows()
      setFlows(updated)
    }
  }

  // ── Run with SSE streaming ────────────────────────────────────────────────
  const runFlow = async () => {
    if (!activeFlowId) {
      alert('Save the flow first')
      return
    }
    setRunning(true)
    setRunOutput([])

    const es = new EventSource(
      `/api/studio/flows/${activeFlowId}/stream?inputs=${encodeURIComponent(JSON.stringify(runInputs))}`
    )

    es.addEventListener('agent_start', (e) => {
      const d = JSON.parse(e.data)
      setRunOutput(prev => [...prev, { type: 'start', agent: d.agent, output: `▶ Running ${d.agent}...` }])
    })
    es.addEventListener('agent_complete', (e) => {
      const d = JSON.parse(e.data)
      setRunOutput(prev => [...prev, { type: 'complete', agent: d.agent, output: d.output, costUsd: d.costUsd }])
    })
    es.addEventListener('interrupted', (e) => {
      const d = JSON.parse(e.data)
      setRunOutput(prev => [...prev, { type: 'interrupted', agent: d.agent, output: '⏸ Waiting for human review...' }])
      es.close()
      setRunning(false)
    })
    es.addEventListener('complete', (e) => {
      const d = JSON.parse(e.data)
      setRunOutput(prev => [...prev, { type: 'final', output: d.output, costUsd: d.costUsd, status: d.status }])
      es.close()
      setRunning(false)
    })
    es.addEventListener('error', (e) => {
      setRunOutput(prev => [...prev, { type: 'error', output: 'Connection error' }])
      es.close()
      setRunning(false)
    })
  }

  // ── Load an existing flow ─────────────────────────────────────────────────
  const loadFlow = async (flowId: string) => {
    const flow = await studioApi.getFlow(flowId)
    setActiveFlowId(flowId)
    setFlowName(flow.name)
    setFlowDescription(flow.description ?? '')
    setNodes((flow.definition?.nodes ?? []) as CanvasNode[])
    setEdges((flow.definition?.edges ?? []) as CanvasEdge[])
    setInputVars(flow.definition?.variables ?? [])
  }

  // ── New flow ──────────────────────────────────────────────────────────────
  const newFlow = () => {
    setActiveFlowId(null)
    setFlowName('My Workflow')
    setFlowDescription('')
    setNodes([{
      id: makeId(),
      type: 'start',
      x: 80,
      y: 200,
      data: { label: 'Start', variables: [] },
    }])
    setEdges([])
    setSelectedNode(null)
    setRunOutput([])
  }

  const selectedNodeData = nodes.find(n => n.id === selectedNode)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-gray-950 text-gray-100 overflow-hidden">

      {/* ── Left sidebar: flows list + role library ── */}
      <aside className="w-56 border-r border-gray-800 flex flex-col overflow-hidden">
        {/* Flows panel */}
        <div className="p-3 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Flows</span>
            <button onClick={newFlow}
              className="text-xs px-2 py-0.5 rounded bg-brand-600 hover:bg-brand-500 text-white">
              + New
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {flows.map(f => (
              <button key={f.id}
                onClick={() => loadFlow(f.id)}
                className={`w-full text-left text-xs px-2 py-1.5 rounded truncate ${
                  f.id === activeFlowId ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}>
                {f.isDeployed ? '🟢 ' : '⚪ '}{f.name}
              </button>
            ))}
            {flows.length === 0 && (
              <p className="text-xs text-gray-600 px-1">No flows yet. Click + New.</p>
            )}
          </div>
        </div>

        {/* Role Library */}
        <div className="p-3 border-b border-gray-800">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Role Library</p>
          <p className="text-xs text-gray-600 mb-2">Drag onto canvas →</p>
          <div className="space-y-1 overflow-y-auto max-h-52">
            {ROLES.map(role => (
              <div key={role.key}
                draggable
                onDragStart={e => e.dataTransfer.setData('roleKey', role.key)}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing hover:bg-gray-800 text-xs text-gray-300 border border-gray-800 hover:border-gray-700">
                <span>{role.icon}</span>
                <span className="truncate">{role.role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Blocks */}
        <div className="p-3 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Blocks</p>
          <div className="space-y-1">
            {([
              { type: 'human_checkpoint', icon: '✋', label: 'Human Checkpoint' },
              { type: 'condition',         icon: '🔀', label: 'Condition'        },
              { type: 'output',            icon: '◀',  label: 'Output'           },
            ] as { type: NodeType; icon: string; label: string }[]).map(b => (
              <div key={b.type}
                draggable
                onDragStart={e => e.dataTransfer.setData('blockType', b.type)}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing hover:bg-gray-800 text-xs text-gray-300 border border-gray-800 hover:border-gray-700">
                <span>{b.icon}</span>
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <header className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-900">
          <div className="flex-1 flex items-center gap-2">
            <input
              value={flowName}
              onChange={e => setFlowName(e.target.value)}
              className="bg-transparent text-gray-100 font-semibold text-sm focus:outline-none border-b border-transparent focus:border-brand-500 px-1"
            />
            {activeFlowId && flows.find(f => f.id === activeFlowId)?.isDeployed && (
              <span className="text-xs text-green-400 font-medium">● Deployed</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {connecting && (
              <span className="text-xs text-yellow-400 animate-pulse">Click target node to connect...</span>
            )}
            {selectedNode && (
              <button onClick={deleteSelected}
                className="text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-800 text-red-300 border border-red-800">
                Delete Node
              </button>
            )}
            <button onClick={saveFlow}
              className={`text-xs px-3 py-1.5 rounded font-medium border transition-colors ${
                saved
                  ? 'bg-green-800 text-green-200 border-green-700'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
              }`}>
              {saved ? '✓ Saved' : 'Save'}
            </button>
            <button onClick={viewCode}
              className="text-xs px-3 py-1.5 rounded font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700">
              {'</> Code'}
            </button>
            <button onClick={() => setShowInputModal(true)}
              className="text-xs px-3 py-1.5 rounded font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
              title="Set input variables before running">
              ▶ Run
            </button>
            <button onClick={deploy}
              className="text-xs px-3 py-1.5 rounded font-medium bg-brand-600 hover:bg-brand-500 text-white">
              🚀 Deploy
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 bg-gray-900 px-4">
          {(['canvas', 'runs'] as const).map(t => (
            <button key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-2 border-b-2 transition-colors ${
                tab === t
                  ? 'border-brand-500 text-brand-400 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              {t === 'canvas' ? '🎨 Canvas' : '▶ Run Output'}
            </button>
          ))}
        </div>

        {/* Canvas tab */}
        {tab === 'canvas' && (
          <div className="flex flex-1 overflow-hidden">
            {/* SVG Canvas */}
            <div className="flex-1 overflow-hidden relative">
              {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center text-gray-600">
                    <p className="text-4xl mb-3">⚡</p>
                    <p className="text-sm">Drag roles from the sidebar to start building</p>
                    <p className="text-xs mt-1">or click + New Flow to begin fresh</p>
                  </div>
                </div>
              )}
              <svg
                ref={canvasRef}
                className="w-full h-full"
                style={{ background: 'radial-gradient(circle, #1f2937 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onDragOver={e => e.preventDefault()}
                onDrop={handleSidebarDrop}
                onClick={() => { if (connecting) { setConnecting(null); setMousePos(null) } else setSelectedNode(null) }}
              >
                {/* Edges */}
                {edges.map(edge => {
                  const src = nodes.find(n => n.id === edge.source)
                  const tgt = nodes.find(n => n.id === edge.target)
                  if (!src || !tgt) return null
                  const x1 = src.x + NODE_WIDTH
                  const y1 = src.y + NODE_HEIGHT / 2
                  const x2 = tgt.x
                  const y2 = tgt.y + NODE_HEIGHT / 2
                  const cx = (x1 + x2) / 2
                  return (
                    <g key={edge.id}>
                      <path
                        d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke="#4b5563"
                        strokeWidth={2}
                        markerEnd="url(#arrowhead)"
                      />
                      {edge.label && (
                        <text x={cx} y={(y1 + y2) / 2 - 4} fill="#9ca3af" fontSize={10} textAnchor="middle">
                          {edge.label}
                        </text>
                      )}
                    </g>
                  )
                })}

                {/* Arrow marker */}
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#4b5563" />
                  </marker>
                </defs>

                {/* Temp connection line while connecting */}
                {connecting && mousePos && (() => {
                  const src = nodes.find(n => n.id === connecting)
                  if (!src) return null
                  const x1 = src.x + NODE_WIDTH
                  const y1 = src.y + NODE_HEIGHT / 2
                  const cx = (x1 + mousePos.x) / 2
                  return (
                    <path
                      d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="6,3"
                      opacity={0.75}
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                })()}

                {/* Nodes */}
                {nodes.map(node => {
                  const isSelected = node.id === selectedNode
                  const color = nodeColor(node.type)
                  const roleData = node.data.roleKey ? ROLES.find(r => r.key === node.data.roleKey) : null

                  return (
                    <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                      {/* Node body */}
                      <rect
                        width={NODE_WIDTH}
                        height={NODE_HEIGHT}
                        rx={8}
                        fill="#1f2937"
                        stroke={isSelected ? '#6366f1' : color}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        style={{ cursor: dragging ? 'grabbing' : 'grab', filter: isSelected ? `drop-shadow(0 0 8px ${color}66)` : 'none' }}
                        onMouseDown={e => handleNodeMouseDown(e, node.id)}
                        onClick={e => { e.stopPropagation(); if (connecting) completeConnect(node.id); else setSelectedNode(node.id) }}
                      />
                      {/* Color accent bar */}
                      <rect width={4} height={NODE_HEIGHT} rx={2} fill={color} />
                      {/* Icon */}
                      {roleData && (
                        <text x={16} y={NODE_HEIGHT / 2 + 5} fontSize={18} dominantBaseline="middle">
                          {roleData.icon}
                        </text>
                      )}
                      {/* Label */}
                      <text
                        x={roleData ? 40 : 16}
                        y={NODE_HEIGHT / 2 - 4}
                        fill="#f3f4f6"
                        fontSize={12}
                        fontWeight="600"
                        dominantBaseline="middle"
                      >
                        {nodeLabel(node).slice(0, 22)}
                      </text>
                      {/* Sublabel */}
                      {node.type === 'agent' && node.data.goal && (
                        <text x={roleData ? 40 : 16} y={NODE_HEIGHT / 2 + 14} fill="#9ca3af" fontSize={9}>
                          {node.data.goal.slice(0, 28)}
                        </text>
                      )}
                      {/* Connect button (right side dot) */}
                      <circle
                        cx={NODE_WIDTH}
                        cy={NODE_HEIGHT / 2}
                        r={8}
                        fill={connecting === node.id ? '#f59e0b' : color}
                        stroke="#111827"
                        strokeWidth={2}
                        style={{ cursor: 'crosshair' }}
                        onClick={e => { e.stopPropagation(); startConnect(node.id) }}
                      />
                      {/* Connect target dot (left side) */}
                      <circle
                        cx={0}
                        cy={NODE_HEIGHT / 2}
                        r={7}
                        fill={connecting ? '#6366f1' : '#374151'}
                        stroke="#111827"
                        strokeWidth={1.5}
                        style={{ cursor: connecting ? 'crosshair' : 'default' }}
                        onClick={e => { e.stopPropagation(); if (connecting) completeConnect(node.id) }}
                      />
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Node editor panel */}
            {selectedNodeData && (
              <aside className="w-64 border-l border-gray-800 bg-gray-900 overflow-y-auto">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-200">Edit Node</h3>
                    <button onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
                  </div>

                  <div className="space-y-3 text-sm">
                    {selectedNodeData.type === 'agent' && (
                      <>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Role</label>
                          <input
                            value={selectedNodeData.data.role ?? ''}
                            onChange={e => updateNodeData('role', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-500"
                            placeholder="Senior Researcher"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Goal</label>
                          <textarea
                            value={selectedNodeData.data.goal ?? ''}
                            onChange={e => updateNodeData('goal', e.target.value)}
                            rows={3}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-500 resize-none"
                            placeholder="Research {topic} thoroughly..."
                          />
                          <p className="text-xs text-gray-600 mt-0.5">Use {'{variable}'} for input injection</p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Backstory</label>
                          <textarea
                            value={selectedNodeData.data.backstory ?? ''}
                            onChange={e => updateNodeData('backstory', e.target.value)}
                            rows={2}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-500 resize-none"
                            placeholder="You are an expert..."
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Model</label>
                          <select
                            value={selectedNodeData.data.model ?? 'auto'}
                            onChange={e => updateNodeData('model', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
                            <option value="auto">Auto (smart routing)</option>
                            <option value="claude-opus-4-6">Opus 4.6 (most capable)</option>
                            <option value="claude-sonnet-4-6">Sonnet 4.6 (balanced)</option>
                            <option value="claude-haiku-4-5-20251001">Haiku 4.5 (fastest)</option>
                          </select>
                        </div>
                      </>
                    )}

                    {selectedNodeData.type === 'condition' && (
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Condition</label>
                        <input
                          value={selectedNodeData.data.condition ?? ''}
                          onChange={e => updateNodeData('condition', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-500 font-mono"
                          placeholder="$reviewer.score >= 7"
                        />
                        <p className="text-xs text-gray-600 mt-1">Use $agentRole.field to reference outputs</p>
                      </div>
                    )}

                    {selectedNodeData.type === 'human_checkpoint' && (
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Review Prompt</label>
                        <textarea
                          value={selectedNodeData.data.prompt ?? ''}
                          onChange={e => updateNodeData('prompt', e.target.value)}
                          rows={3}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-500 resize-none"
                          placeholder="Please review the output and provide feedback..."
                        />
                      </div>
                    )}

                    {selectedNodeData.type === 'start' && (
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Flow Label</label>
                        <input
                          value={selectedNodeData.data.label ?? ''}
                          onChange={e => updateNodeData('label', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    )}

                    <button
                      onClick={deleteSelected}
                      className="w-full text-xs py-1.5 rounded bg-red-900/50 hover:bg-red-800 text-red-300 border border-red-800 mt-2">
                      Delete Node
                    </button>
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}

        {/* Run output tab */}
        {tab === 'runs' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {runOutput.length === 0 && (
              <p className="text-gray-500 text-sm text-center mt-12">Run your flow to see output here</p>
            )}
            {runOutput.map((ev, i) => (
              <div key={i} className={`rounded-lg p-3 border text-sm ${
                ev.type === 'error'
                  ? 'bg-red-950 border-red-800 text-red-300'
                  : ev.type === 'final'
                    ? 'bg-green-950 border-green-800 text-green-200'
                    : ev.type === 'interrupted'
                      ? 'bg-yellow-950 border-yellow-800 text-yellow-200'
                      : 'bg-gray-900 border-gray-800 text-gray-300'
              }`}>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-semibold text-gray-400">
                    {ev.type === 'final' ? '✓ Final Output' : ev.agent ?? ev.type}
                  </span>
                  {ev.costUsd && (
                    <span className="text-xs text-gray-500">${ev.costUsd.toFixed(4)}</span>
                  )}
                </div>
                <pre className="whitespace-pre-wrap text-xs leading-relaxed">{ev.output}</pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Code modal ── */}
      {showCode && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="font-semibold text-gray-100">Generated Code</h3>
              <button onClick={() => setShowCode(false)} className="text-gray-400 hover:text-gray-200 text-lg">×</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap leading-relaxed">{generatedCode}</pre>
            </div>
            <div className="px-4 py-3 border-t border-gray-800 flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(generatedCode)}
                className="text-xs px-3 py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white">
                Copy to Clipboard
              </button>
              <button onClick={() => setShowCode(false)} className="text-xs px-3 py-1.5 rounded bg-gray-800 text-gray-300">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Input variables modal ── */}
      {showInputModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="font-semibold text-gray-100">Set Input Variables</h3>
              <button onClick={() => setShowInputModal(false)} className="text-gray-400 hover:text-gray-200 text-lg">×</button>
            </div>
            <div className="p-4 space-y-3">
              {inputVars.length === 0 && (
                <p className="text-sm text-gray-500">No variables detected. Use {'{variable}'} in node goals.</p>
              )}
              {inputVars.map(v => (
                <div key={v}>
                  <label className="text-xs text-gray-400 block mb-1">{v}</label>
                  <input
                    value={runInputs[v] ?? ''}
                    onChange={e => setRunInputs(prev => ({ ...prev, [v]: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
                    placeholder={`Enter ${v}...`}
                  />
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-gray-800 flex gap-2">
              <button
                onClick={() => { setShowInputModal(false); setTab('runs'); runFlow() }}
                className="flex-1 text-sm py-2 rounded bg-brand-600 hover:bg-brand-500 text-white font-medium"
                disabled={running}>
                {running ? 'Running...' : '▶ Run Flow'}
              </button>
              <button onClick={() => setShowInputModal(false)} className="text-sm px-3 py-2 rounded bg-gray-800 text-gray-300">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
