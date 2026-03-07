# Workflow Automation Example

Demonstrates chaining three specialized agents in a pipeline:

```
Researcher (Haiku) → Writer (Sonnet) → Editor (Haiku)
```

Each agent receives the previous agent's output as input, building toward a polished final result. Uses the right model for each task — Haiku for speed, Sonnet for quality writing.

## Run

```bash
cp ../../.env.example .env
# Add your ANTHROPIC_API_KEY to .env
npx tsx index.ts

# Custom topic:
npx tsx index.ts "The future of AI agents in healthcare"
```

## What it shows

- Agent chaining with context passing between steps
- Model selection per step (cost optimization — not every step needs Opus)
- Pipeline pattern: Research → Draft → Polish
- `ClaudeAgent.run()` with different system prompts per role
