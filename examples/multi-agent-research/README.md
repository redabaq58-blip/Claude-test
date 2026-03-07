# Multi-Agent Research Example

Demonstrates the `MultiAgentOrchestrator` — Anthropic's proven pattern for complex research tasks:

1. **Decompose** — Opus breaks the task into 4-6 parallel subtasks
2. **Execute** — Sonnet agents run all subtasks simultaneously
3. **Synthesize** — Opus combines everything into a unified output

Proven to yield 90%+ improvement over single-agent approaches.

## Run

```bash
cp ../../.env.example .env
# Add your ANTHROPIC_API_KEY to .env
npx tsx index.ts
```

## What it shows

- `MultiAgentOrchestrator` — task decomposition + parallel execution
- Parallel agent execution with `maxParallel` control
- Result synthesis with Opus
- Cost aggregation across multiple agents
