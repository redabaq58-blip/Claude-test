/**
 * WorkflowGraph — LangGraph-inspired stateful graph executor for ClaudeForge
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Key concepts:
 *   Nodes:       Functions that receive state and return updated state.
 *   Edges:       Connections between nodes — unconditional or conditional.
 *   State:       A shared typed object that flows through (and accumulates in)
 *                every node.
 *   Cycles:      Supported (with a maxIterations guard to prevent infinite loops).
 *   Parallel:    Fan-out: multiple edges from one node execute in parallel.
 *                Fan-in:  state slices are deep-merged when branches reconvene.
 *   Checkpoints: A snapshot of the state is stored after every node execution so
 *                you can inspect, replay, or resume from any point.
 *
 * Quick example — review-and-revise loop:
 *
 *   const graph = new WorkflowGraph<{ draft: string; score: number }>()
 *     .addNode('write',  (s) => agent.run(s))
 *     .addNode('review', (s) => reviewer.run(s))
 *     .addEdge('write', 'review')
 *     .addConditionalEdge('review', (s) => s.score >= 8 ? '__END__' : 'write')
 *     .setEntryPoint('write')
 *
 *   const result = await graph.compile().invoke({ draft: '', score: 0 })
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const END = '__END__' as const

// ─── Core Types ───────────────────────────────────────────────────────────────

/** A node handler receives the current state and returns an (updated) state. */
export type NodeHandler<TState> = (state: TState) => Promise<TState> | TState

/**
 * A conditional router returns the ID of the next node to visit,
 * or END (__END__) to terminate the graph.
 */
export type ConditionalRouter<TState> = (state: TState) => string | typeof END

/** An edge can be unconditional (always go to `to`) or conditional (router decides). */
interface UnconditionalEdge {
  type: 'unconditional'
  from: string
  to: string
}

interface ConditionalEdge<TState> {
  type: 'conditional'
  from: string
  router: ConditionalRouter<TState>
}

type Edge<TState> = UnconditionalEdge | ConditionalEdge<TState>

// ─── Execution Records ────────────────────────────────────────────────────────

export interface NodeExecution<TState> {
  nodeId: string
  inputState: TState
  outputState: TState
  durationMs: number
  iteration: number
}

export interface Checkpoint<TState> {
  nodeId: string
  state: TState
  timestamp: Date
  iteration: number
}

export interface GraphRunResult<TState> {
  finalState: TState
  checkpoints: Checkpoint<TState>[]
  executionPath: string[]
  success: boolean
  error?: string
  totalIterations: number
  durationMs: number
}

// ─── CompiledGraph ────────────────────────────────────────────────────────────

export class CompiledGraph<TState extends Record<string, unknown>> {
  private nodes: Map<string, NodeHandler<TState>>
  private edges: Edge<TState>[]
  private entryPoint: string
  private finishPoints: Set<string>
  private maxIterations: number

  constructor(
    nodes: Map<string, NodeHandler<TState>>,
    edges: Edge<TState>[],
    entryPoint: string,
    finishPoints: Set<string>,
    maxIterations: number
  ) {
    this.nodes = nodes
    this.edges = edges
    this.entryPoint = entryPoint
    this.finishPoints = finishPoints
    this.maxIterations = maxIterations
  }

  // ─── Invoke ────────────────────────────────────────────────────────────────

  async invoke(initialState: TState): Promise<GraphRunResult<TState>> {
    const startTime = Date.now()
    const checkpoints: Checkpoint<TState>[] = []
    const executionPath: string[] = []

    let state = { ...initialState }
    let currentNodes: string[] = [this.entryPoint]
    let iteration = 0

    try {
      while (currentNodes.length > 0 && iteration < this.maxIterations) {
        // ── Execute current layer (may be parallel if multiple nodes) ──────
        const layerResults = await Promise.all(
          currentNodes.map((nodeId) => this.executeNode(nodeId, state, iteration))
        )

        // ── Merge state from all parallel branches ─────────────────────────
        for (const result of layerResults) {
          executionPath.push(result.nodeId)
          state = deepMerge(state, result.outputState)
          checkpoints.push({
            nodeId: result.nodeId,
            state: { ...state },
            timestamp: new Date(),
            iteration,
          })
        }

        // ── Determine next layer of nodes ──────────────────────────────────
        const nextNodes = new Set<string>()

        for (const result of layerResults) {
          const nodeId = result.nodeId

          // Stop if this node is a designated finish point
          if (this.finishPoints.has(nodeId)) continue

          // Gather all outgoing edges for this node
          const outEdges = this.edges.filter((e) => e.from === nodeId)

          if (outEdges.length === 0) {
            // No edges → implicit end for this branch
            continue
          }

          for (const edge of outEdges) {
            if (edge.type === 'unconditional') {
              if (edge.to !== END) nextNodes.add(edge.to)
            } else {
              const target = edge.router(state)
              if (target !== END) nextNodes.add(target)
            }
          }
        }

        currentNodes = [...nextNodes]
        iteration++
      }

      if (iteration >= this.maxIterations) {
        return {
          finalState: state,
          checkpoints,
          executionPath,
          success: false,
          error: `Graph exceeded maxIterations (${this.maxIterations}). Check for infinite loops.`,
          totalIterations: iteration,
          durationMs: Date.now() - startTime,
        }
      }

      return {
        finalState: state,
        checkpoints,
        executionPath,
        success: true,
        totalIterations: iteration,
        durationMs: Date.now() - startTime,
      }
    } catch (err) {
      return {
        finalState: state,
        checkpoints,
        executionPath,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        totalIterations: iteration,
        durationMs: Date.now() - startTime,
      }
    }
  }

  // ─── Async generator stream ────────────────────────────────────────────────
  // Yields a NodeExecution after each node finishes, so callers can react
  // incrementally (e.g., stream progress to a UI).

  async *stream(initialState: TState): AsyncGenerator<NodeExecution<TState>> {
    let state = { ...initialState }
    let currentNodes: string[] = [this.entryPoint]
    let iteration = 0

    while (currentNodes.length > 0 && iteration < this.maxIterations) {
      const layerResults = await Promise.all(
        currentNodes.map((nodeId) => this.executeNode(nodeId, state, iteration))
      )

      const nextNodes = new Set<string>()

      for (const result of layerResults) {
        state = deepMerge(state, result.outputState)
        yield result

        if (this.finishPoints.has(result.nodeId)) continue

        const outEdges = this.edges.filter((e) => e.from === result.nodeId)
        for (const edge of outEdges) {
          if (edge.type === 'unconditional') {
            if (edge.to !== END) nextNodes.add(edge.to)
          } else {
            const target = edge.router(state)
            if (target !== END) nextNodes.add(target)
          }
        }
      }

      currentNodes = [...nextNodes]
      iteration++
    }
  }

  // ─── Private: run a single node ────────────────────────────────────────────

  private async executeNode(
    nodeId: string,
    state: TState,
    iteration: number
  ): Promise<NodeExecution<TState>> {
    const handler = this.nodes.get(nodeId)
    if (!handler) throw new Error(`WorkflowGraph: node "${nodeId}" not found`)

    const t0 = Date.now()
    const inputState = { ...state }
    const outputState = await handler(inputState)

    return {
      nodeId,
      inputState,
      outputState: outputState as TState,
      durationMs: Date.now() - t0,
      iteration,
    }
  }
}

// ─── WorkflowGraph (builder) ──────────────────────────────────────────────────

export class WorkflowGraph<TState extends Record<string, unknown>> {
  private nodes = new Map<string, NodeHandler<TState>>()
  private edges: Edge<TState>[] = []
  private _entryPoint: string | null = null
  private _finishPoints = new Set<string>()
  private _maxIterations = 50

  // ─── Fluent builder API ───────────────────────────────────────────────────

  /**
   * Register a node with an ID and a handler function.
   * The handler receives the current shared state and returns an updated state.
   */
  addNode(id: string, handler: NodeHandler<TState>): this {
    if (this.nodes.has(id)) {
      throw new Error(`WorkflowGraph: node "${id}" already exists`)
    }
    this.nodes.set(id, handler)
    return this
  }

  /**
   * Add an unconditional edge from one node to another.
   * When `from` completes it always transitions to `to`.
   * Use END (__END__) as `to` to terminate the graph from that edge.
   */
  addEdge(from: string, to: string): this {
    this.edges.push({ type: 'unconditional', from, to })
    return this
  }

  /**
   * Add a conditional edge from `from`.
   * The `router` function is called with the current state after `from` finishes
   * and must return the ID of the next node to visit, or END to stop.
   *
   * Multiple conditional edges from the same node are supported — all routers
   * run and their non-END targets are executed in parallel.
   */
  addConditionalEdge(from: string, router: ConditionalRouter<TState>): this {
    this.edges.push({ type: 'conditional', from, router })
    return this
  }

  /**
   * Set the entry-point node (required before calling compile()).
   */
  setEntryPoint(nodeId: string): this {
    this._entryPoint = nodeId
    return this
  }

  /**
   * Mark a node as a finish point. The graph stops following edges out of this
   * node once it has executed, even if edges exist. Useful when multiple
   * terminal nodes are possible.
   */
  addFinishPoint(nodeId: string): this {
    this._finishPoints.add(nodeId)
    return this
  }

  /**
   * Maximum number of node-layer iterations before the graph aborts.
   * Prevents runaway cycles. Default: 50.
   */
  setMaxIterations(n: number): this {
    this._maxIterations = n
    return this
  }

  /**
   * Validate and freeze the graph, returning a CompiledGraph ready to run.
   */
  compile(): CompiledGraph<TState> {
    if (!this._entryPoint) {
      throw new Error('WorkflowGraph: call setEntryPoint() before compile()')
    }
    if (!this.nodes.has(this._entryPoint)) {
      throw new Error(`WorkflowGraph: entryPoint "${this._entryPoint}" is not a registered node`)
    }

    // Warn about edges referencing unknown nodes
    for (const edge of this.edges) {
      if (!this.nodes.has(edge.from)) {
        throw new Error(`WorkflowGraph: edge references unknown source node "${edge.from}"`)
      }
      if (edge.type === 'unconditional' && edge.to !== END && !this.nodes.has(edge.to)) {
        throw new Error(`WorkflowGraph: edge references unknown target node "${edge.to}"`)
      }
    }

    return new CompiledGraph(
      new Map(this.nodes),
      [...this.edges],
      this._entryPoint,
      new Set(this._finishPoints),
      this._maxIterations
    )
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Deep-merge `patch` into `base`.  Arrays are replaced (not concatenated)
 * so that node handlers have full control over list-valued state keys.
 */
function deepMerge<T extends Record<string, unknown>>(base: T, patch: T): T {
  const result = { ...base }
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const patchVal = patch[key]
    const baseVal = base[key]
    if (
      patchVal !== null &&
      typeof patchVal === 'object' &&
      !Array.isArray(patchVal) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        patchVal as Record<string, unknown>
      ) as T[keyof T]
    } else {
      result[key] = patchVal
    }
  }
  return result
}
