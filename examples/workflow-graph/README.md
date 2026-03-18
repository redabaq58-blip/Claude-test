# WorkflowGraph Example — Review & Revise Loop

Demonstrates ClaudeForge's **WorkflowGraph**: a LangGraph-inspired stateful graph executor.

## What it shows

| Feature | How it's used |
|---------|--------------|
| **Conditional routing** | Reviewer scores the draft; routes to `write` (revise) or `summarise`+`format` (approve) |
| **Cycles / loops** | Writer → Reviewer → Writer loop until quality score ≥ 8 |
| **Parallel branches** | After approval, `summarise` and `format` run simultaneously |
| **Typed shared state** | `ArticleState` flows through every node and accumulates updates |
| **Streaming** | `compiled.stream()` yields each node execution live |

## Graph topology

```
[write] ──────────────────────────────────────────► [format] ──► END
   ▲                                               ▲
   │  score < 8                      score ≥ 8    │
   └──────────────── [review] ─────────────────► [summarise] ──► END
```

## Run

```bash
# From the repo root
ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/workflow-graph/index.ts "quantum computing"
```

## Core API

```typescript
import { WorkflowGraph, END } from '@claudeforge/agents'

const graph = new WorkflowGraph<{ draft: string; score: number }>()
  .addNode('write',  async (state) => { /* ... */; return { ...state, draft: '...' } })
  .addNode('review', async (state) => { /* ... */; return { ...state, score: 9 } })
  .addEdge('write', 'review')
  .addConditionalEdge('review', (s) => s.score >= 8 ? END : 'write')
  .setEntryPoint('write')

const result = await graph.compile().invoke({ draft: '', score: 0 })
```
