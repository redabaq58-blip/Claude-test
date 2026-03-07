# Simple Agent Example

Demonstrates the most basic ClaudeForge usage: ask Claude a question and receive a response with full usage stats.

## Run

```bash
cp ../../.env.example .env
# Add your ANTHROPIC_API_KEY to .env
npx tsx index.ts
```

## What it shows

- `ClaudeClient` — the unified Claude SDK wrapper
- Auto model selection via `taskConfig`
- Usage stats (tokens, cost, duration)
- `MODELS.HAIKU` for fast, cheap responses
