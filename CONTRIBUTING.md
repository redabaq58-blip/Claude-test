# Contributing to ClaudeForge

Thank you for your interest in contributing!

## Development Setup

```bash
# 1. Clone the repo
git clone https://github.com/redabaq58-blip/Claude-test.git
cd Claude-test

# 2. Install dependencies (uses npm workspaces / Turborepo)
npm install

# 3. Copy env file and fill in your Anthropic API key
cp .env.example .env
# Edit .env — at minimum set ANTHROPIC_API_KEY

# 4. Run DB migrations
npm run migrate

# 5. Start all dev servers (API + web dashboard)
npm run dev
```

The API runs at `http://localhost:3000` and the Vite dashboard at `http://localhost:5173`.

## Repository Structure

```
packages/core      — Claude SDK wrapper + model router
packages/agents    — ClaudeAgent, MultiAgentOrchestrator, hooks, skills
packages/mcp       — MCP tool servers (filesystem, web, git, db, code)
packages/api       — Express REST API + SQLite (Drizzle ORM)
packages/cli       — Commander.js CLI
apps/web           — React + Vite dashboard
skills/            — Pre-built SKILL.md packages
examples/          — Runnable demos
```

## Coding Standards

- TypeScript strict mode everywhere — no `any` unless unavoidable
- API responses use the `{ data, error, meta }` envelope (see `middleware/response.ts`)
- Errors: wrap in `ClaudeForgeError`, never throw raw
- Always log token usage after every Claude API call
- MCP tools: validate connection before registering in registry
- No secrets committed — `ANTHROPIC_API_KEY` and `API_SECRET` live in `.env` only

## Making Changes

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Make your changes, following the coding standards above
3. Run `npm run build` to ensure TypeScript compiles cleanly
4. Run `npm run lint` (if available) and fix any issues
5. Open a pull request against the default branch with a clear description

## Security

If you discover a security vulnerability, please follow the process in [SECURITY.md](./SECURITY.md) rather than opening a public issue.

## License

By contributing you agree that your contributions will be licensed under the [MIT License](./LICENSE).
