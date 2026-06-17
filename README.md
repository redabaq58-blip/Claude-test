# ClaudeForge

**The all-in-one platform for building and running AI agents powered by Claude.**

Create agents, run them, chat with them, compare models, build workflows, and track costs — all from one web dashboard.

---

## Getting Started (3 steps, ~5 minutes)

### Step 1 — Get your Anthropic API key

1. Go to **https://console.anthropic.com**
2. Sign in (or create a free account)
3. Click **API Keys** → **Create Key**
4. Copy the key — it looks like `sk-ant-api03-...`

### Step 2 — Add your key to the config file

In the project folder, copy the example config:

```bash
cp .env.example .env
```

Then open `.env` in any text editor and replace the placeholder:

```
ANTHROPIC_API_KEY=sk-ant-api03-your-real-key-here
```

### Step 3 — Start the app

Pick whichever method works for you:

**Shell script** (Mac / Linux — simplest):
```bash
./start.sh
```

**npm** (Mac / Windows / Linux — requires Node.js 22+):
```bash
npm install
npm run build
npm start
```

**Docker** (no Node.js needed, requires Docker Desktop):
```bash
docker compose up
```

Then open **http://localhost:3000** in your browser. Done!

---

## What you can do

| Feature | Description |
|---------|-------------|
| **Playground** | Professional prompt testing environment — multi-turn conversation, A/B model split-view, extended thinking, ✨ prompt enhancement, `{{variable}}` templates, temperature control, output format toggle (Markdown / Raw / JSON), live token estimator, run history, and copy-output |
| **Agent Studio** | Create AI agents with custom instructions, choose models, run them |
| **Chat** | Have multi-turn conversations with any of your agents |
| **Templates** | 10 ready-to-use agents: Research, Code Review, Writing Coach, SQL Expert... |
| **Model Compare** | Send the same prompt to all 3 Claude models and see them side-by-side |
| **Workflows** | Chain agents together into automated multi-step pipelines |
| **MCP Hub** | Give agents access to tools: read files, search the web, run git commands |
| **Analytics** | See how many tokens you've used and how much it's cost |
| **Run History** | Full log of every agent run with inputs, outputs, and costs |
| **Prompt Library** | 20+ ready-to-use expert prompts with variable substitution |

---

## Deploy to the cloud

### Railway

1. Fork this repo on GitHub
2. Go to **https://railway.app** and create a new project from your fork
3. Add the environment variable `ANTHROPIC_API_KEY` in Railway's settings
4. Add persistent storage:
   - simplest: attach a Railway Volume mounted at `/app/data` and keep `DATABASE_URL=./data/claude-forge.db`
   - stronger: use Turso/libSQL and set `DATABASE_URL=libsql://...` plus `DATABASE_AUTH_TOKEN`
5. Leave `API_SECRET` unset for the current bundled dashboard; setting it now blocks browser API calls. Add real dashboard auth before enabling it on a public service.
6. Deploy - Railway detects the Dockerfile automatically

### Any Docker host (Render, Fly.io, DigitalOcean, AWS...)

```bash
# Build and run locally with Docker
docker compose up

# Or build a production image
docker build -t claudeforge .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=your-key claudeforge
```

The app exposes port `3000` and has health checks at `/health` and `/api/health`.

---

## Troubleshooting

**"ANTHROPIC_API_KEY is not set"**
→ Open `.env` and paste your key from https://console.anthropic.com

**"Node.js 22+ is required"**
→ Download the latest version from https://nodejs.org and install it

**Port 3000 is already in use**
→ Add `PORT=3001` to your `.env` file, then restart

**Build fails or something looks broken**
→ Delete `node_modules/` and run `npm install` again

**Want to reset everything**
→ Delete `data/claude-forge.db` to wipe the database and start fresh

---

## Developer docs

### Commands

```bash
npm run setup      # Interactive wizard: checks key, seeds DB, tests connection
npm run dev        # Start in dev mode (hot reload, API :3000 + web :5173)
npm run build      # Build all packages for production
npm start          # Start production server on :3000
npm run start:api  # API only
npm run start:web  # Web dashboard only (dev, port 5173)
```

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | — | Your key from console.anthropic.com |
| `PORT` | No | `3000` | Port the server listens on |
| `DATABASE_URL` | No | `./data/claude-forge.db` | SQLite / Turso database URL |
| `DATABASE_AUTH_TOKEN` | No | — | Auth token for remote Turso databases |
| `NODE_ENV` | No | `development` | Set to `production` when deploying |
| `DEFAULT_MODEL` | No | `auto` | Default Claude model (`opus`/`sonnet`/`haiku`/`auto`) |
| `COST_LIMIT_PER_RUN` | No | `0` (unlimited) | Max USD per agent run |
| `API_SECRET` | No | — | Bearer token for API-only clients; leave unset for the bundled dashboard until dashboard auth is implemented |
| `CORS_ORIGIN` | No | — | Allowed CORS origin in production (e.g. `https://your-dashboard.example.com`) |

### Project layout

```
packages/core      — Claude SDK wrapper + model router
packages/agents    — ClaudeAgent, MultiAgentOrchestrator, hooks, skills
packages/mcp       — MCP servers (filesystem, web, git, database, code)
packages/api       — Express REST API + SQLite (Drizzle ORM)
packages/cli       — claude-forge CLI tool
apps/web           — React + Vite dashboard
scripts/           — Setup utilities
prompts/           — 20+ curated prompt templates
examples/          — Runnable demos
```

### SDK usage

```typescript
import { ClaudeAgent } from '@claudeforge/agents'

const agent = new ClaudeAgent({
  name: 'My Agent',
  model: 'claude-sonnet-4-6',
  systemPrompt: 'You are a helpful assistant.',
})

const result = await agent.run('Explain quantum entanglement simply')
console.log(result.output)
console.log(`Cost: $${result.usage.costUsd.toFixed(4)}`)
```

### Multi-agent orchestration

```typescript
import { MultiAgentOrchestrator } from '@claudeforge/agents'

const orchestrator = new MultiAgentOrchestrator({ name: 'Research' })
const report = await orchestrator.run('Analyze the impact of LLMs on software engineering')
```

### Hooks (safety + logging)

```typescript
import { createCostGuardHook, createSafetyHook } from '@claudeforge/agents'

agent.addHook(createCostGuardHook(0.50))           // Block if cost > $0.50
agent.addHook(createSafetyHook(['rm -rf', 'sudo'])) // Block dangerous patterns
```

### MCP tools

```typescript
import { MCPRegistry } from '@claudeforge/mcp'

const registry = MCPRegistry.withDefaults('/path/to/repo')
const agent = new ClaudeAgent({
  name: 'Dev Agent',
  tools: registry.getAllTools(), // filesystem + web + git + code
})
```

### Playground API

The Playground endpoint is ephemeral (no DB writes) and streams responses as Server-Sent Events:

```
POST /api/playground/stream
```

| Body field | Type | Default | Description |
|---|---|---|---|
| `userMessage` | `string` | — | Single-turn shorthand (used when `messages` is absent) |
| `messages` | `Array<{role,content}>` | — | Full conversation history for multi-turn sessions |
| `model` | `string` | `auto` | `claude-haiku-4-5-20251001` / `claude-sonnet-4-6` / `claude-opus-4-6` / `auto` |
| `systemPrompt` | `string` | `""` | System instruction prepended to the conversation |
| `temperature` | `number` | `0.7` | 0.0–1.0 (forced to 1 when `thinkingEnabled` is true) |
| `thinkingEnabled` | `boolean` | `false` | Enable extended thinking (Claude reasons before answering) |
| `thinkingBudget` | `number` | `8000` | Token budget for thinking (1 024–32 000) |

SSE event types emitted:

```jsonc
{ "type": "text",     "text": "..." }              // streamed output token
{ "type": "thinking", "thinking": "..." }           // reasoning chunk (when enabled)
{ "type": "done",     "usage": { "inputTokens": 0, "outputTokens": 0, "costUsd": 0, "durationMs": 0, "model": "..." } }
{ "type": "error",    "error": "..." }
```

### Available models

| Model | ID | Best for |
|-------|----|---------|
| Opus 4.6 | `claude-opus-4-6` | Complex reasoning, orchestration |
| Sonnet 4.6 | `claude-sonnet-4-6` | General purpose (default) |
| Haiku 4.5 | `claude-haiku-4-5-20251001` | Fast, high-volume, cheap |
| Auto | `auto` | Platform picks based on task |

### Full API reference

```
GET    /health                       Health check
GET    /api/agents                   List agents
POST   /api/agents                   Create agent
PUT    /api/agents/:id               Update agent
DELETE /api/agents/:id               Delete agent
POST   /api/agents/:id/run           Run agent (blocking)
POST   /api/agents/:id/stream        Run agent (SSE streaming)
POST   /api/agents/:id/clone         Duplicate agent
GET    /api/agents/:id/export        Export agent as JSON
POST   /api/agents/import            Import agent from JSON
GET    /api/agents/:id/runs          Agent run history
GET    /api/templates                List templates
POST   /api/templates/:id/create     Create agent from template
GET    /api/prompts                  List all prompts
GET    /api/runs                     All runs (filterable + paginated)
GET    /api/analytics/costs          Cost breakdown by model
GET    /api/analytics/usage          Token usage over time
GET    /api/analytics/runs           Run stats by agent
POST   /api/playground/stream        Ephemeral prompt testing (SSE streaming, multi-turn, thinking)
POST   /api/compare                  Compare models on same prompt
GET    /api/conversations            List conversations
POST   /api/conversations            Start conversation
POST   /api/conversations/:id/message  Send message (SSE streaming)
DELETE /api/conversations/:id        Delete conversation
GET/POST /api/workflows              Workflow management
GET    /api/mcp/servers              MCP server list
POST   /api/mcp/servers              Register MCP server
GET/POST /api/skills                 Skill registry
GET    /api/occupations              Occupation data
```

---

## License

MIT — built for the Anthropic ecosystem.
