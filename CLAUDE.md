# ClaudeForge Platform — Agent Instructions

## What is ClaudeForge?

ClaudeForge is a production-ready platform built exclusively for the Claude/Anthropic ecosystem.
It provides agents, MCP servers, skills, lifecycle hooks, and workflow orchestration in one monorepo.

## Repository Structure

```
packages/core      — Unified Claude SDK wrapper + smart model router
packages/agents    — ClaudeAgent base, MultiAgentOrchestrator, hooks, skills
packages/mcp       — Pre-built MCP servers (filesystem, web, git, db, code)
packages/api       — Express REST API + SQLite (Drizzle ORM)
packages/cli       — Commander.js CLI (claude-forge command)
apps/web           — React + Vite dashboard
skills/            — Pre-built SKILL.md packages
examples/          — Runnable demos
```

## Model Selection Strategy

| Task | Model |
|------|-------|
| Complex reasoning, orchestration, synthesis | claude-opus-4-6 |
| General purpose, balanced | claude-sonnet-4-6 (default) |
| Fast responses, high-volume, classification | claude-haiku-4-5-20251001 |
| Auto (let platform decide) | Based on task signals |

## Key Conventions

- All packages use TypeScript strict mode
- API responses: `{ data, error, meta }` envelope
- Errors: never throw raw, always wrap in `ClaudeForgeError`
- Costs: always log token usage after every API call
- Hooks: never block the main agent thread (async fire-and-forget ok for logging)
- MCP servers: always validate connection before registering in registry

## Environment

Required env var: `ANTHROPIC_API_KEY`
Optional: `PORT` (default 3000), `DATABASE_URL` (default ./data/claude-forge.db)

## Development Commands

```bash
npm install          # Install all workspace deps
npm run build        # Build all packages
npm run dev          # Run all dev servers in parallel
npm run migrate      # Run DB migrations
npm run start:api    # Start API server only
npm run start:web    # Start web dashboard only
```

## Available MCP Servers

- `filesystem` — Read, write, search files in allowed paths
- `web` — Fetch URLs, search the web
- `git` — Git log, diff, commit, branch operations
- `database` — Query SQLite databases
- `code` — Execute code in a sandboxed environment

## Safety Rules

- Never commit API keys or secrets
- Always validate user input at API boundaries
- Cost limits: configurable via COST_LIMIT_PER_RUN env var
- Hook PreToolUse can block dangerous operations — respect its decisions
