# MCP Integration Example

Demonstrates a `ClaudeAgent` equipped with MCP tool servers (filesystem + git). The agent uses real tools to analyze the repository it's running in.

## Run

```bash
cp ../../.env.example .env
# Add your ANTHROPIC_API_KEY to .env
npx tsx index.ts
```

## What it shows

- `MCPRegistry.withDefaults()` — registers filesystem + git + web servers
- `ClaudeAgent` with tools — agent decides when and how to use them
- `createAuditLogHook` — logs every tool call in real-time
- Agentic tool loop — agent calls tools, gets results, calls more tools
