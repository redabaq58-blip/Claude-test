# ClaudeForge

**The Ultimate Claude & Anthropic Agent Platform**

A production-ready monorepo for building, deploying, and orchestrating Claude agents — with a full web dashboard, REST API, CLI, MCP tool servers, skill packages, and multi-agent orchestration.

---

## Why ClaudeForge?

| Without ClaudeForge | With ClaudeForge |
|---------------------|-----------------|
| Raw API calls, no structure | Typed SDK wrapper with smart model routing |
| Manual cost tracking | Automatic per-call cost calculation + analytics |
| One agent at a time | Multi-agent orchestration (90%+ better results) |
| No tool integration | 5 pre-built MCP servers (filesystem, web, git, db, code) |
| No UI | Full React dashboard with real-time streaming |
| Write prompts from scratch | 20+ curated expert prompts + 10 agent templates |

---

## 5-Minute Quickstart

```bash
# 1. Clone and install
git clone <repo-url> claude-forge
cd claude-forge
npm install

# 2. Set your API key
cp .env.example .env
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env

# 3. One-command setup (seeds DB, tests connection, registers MCP servers)
npx tsx scripts/setup.ts

# 4. Start the platform
npm run dev
# → API:  http://localhost:3000
# → Web:  http://localhost:5173
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   ClaudeForge                        │
├──────────────┬──────────────┬────────────────────────┤
│  apps/web    │ packages/cli │  examples/             │
│  React       │ claude-forge │  simple-agent          │
│  Dashboard   │ CLI tool     │  multi-agent-research  │
│  (port 5173) │              │  mcp-integration       │
│              │              │  workflow-automation   │
├──────────────┴──────────────┴────────────────────────┤
│               packages/api  (port 3000)              │
│  Express REST API + SQLite (Drizzle ORM)             │
│  /agents  /workflows  /mcp  /skills  /analytics      │
│  /templates  /prompts  /runs  /agents/:id/stream     │
├──────────────────────────────────────────────────────┤
│  packages/agents          │  packages/mcp            │
│  ClaudeAgent base class   │  MCPRegistry             │
│  MultiAgentOrchestrator   │  filesystem / web / git  │
│  12-event hook system     │  database / code servers │
│  AgentMemory (150K ctx)   │                          │
├──────────────────────────────────────────────────────┤
│  packages/core                                       │
│  ClaudeClient (unified SDK wrapper)                  │
│  Smart model router (opus/sonnet/haiku/auto)         │
│  Cost calculator (real Anthropic pricing)            │
│  Streaming generator (SSE)                           │
└──────────────────────────────────────────────────────┘
```

---

## Model Strategy

| Use case | Model | Why |
|----------|-------|-----|
| Orchestration, synthesis, complex reasoning | `claude-opus-4-6` | Most capable |
| General agents, writing, analysis | `claude-sonnet-4-6` | Best balance |
| Fast queries, classification, high-volume | `claude-haiku-4-5-20251001` | Cheapest, fastest |
| Let the platform decide | `auto` | Smart routing by task signals |

---

## Platform Features

### Web Dashboard (`apps/web`)
- **Dashboard** — live stats: agents, runs, cost today, model mix
- **Agent Studio** — create/edit agents, run with real-time streaming output
- **Templates** — 10 pre-configured agents (Research, Code Review, Writing Coach, etc.)
- **Workflows** — chain agents into multi-step pipelines
- **MCP Hub** — manage tool servers, test connections, view available tools
- **Analytics** — cost charts, token usage, run status breakdown, top agents
- **History** — full audit trail of every run, filter, expand, export CSV/JSON

### REST API (`packages/api`)
```
GET    /api/agents              List all agents
POST   /api/agents              Create agent
PUT    /api/agents/:id          Update agent
DELETE /api/agents/:id          Delete agent
POST   /api/agents/:id/run      Run agent (blocking)
POST   /api/agents/:id/stream   Run agent (SSE streaming)
GET    /api/agents/:id/runs     Agent run history

GET    /api/templates           List agent templates
POST   /api/templates/:id/create  Create agent from template

GET    /api/prompts             List all prompts
GET    /api/prompts/category/:cat  Prompts by category

GET    /api/runs                All runs (filterable, paginated)

GET    /api/workflows           List workflows
POST   /api/workflows           Create workflow
POST   /api/workflows/:id/run   Run workflow

GET    /api/mcp/servers         List MCP servers
POST   /api/mcp/servers         Register server
POST   /api/mcp/servers/:id/test  Test connection

GET    /api/analytics/costs     Cost analytics
GET    /api/analytics/runs      Run analytics
GET    /api/analytics/usage     Token usage over time
```

### CLI (`packages/cli`)
```bash
claude-forge status                    # Test API key + connectivity
claude-forge models                    # List models with pricing

claude-forge agent run <id> "prompt"   # Run agent by ID
claude-forge agent ask "question"      # One-shot with auto model
claude-forge agent orchestrate "task"  # Multi-agent research

claude-forge mcp list                  # List registered servers
claude-forge mcp test <name>           # Test MCP server
claude-forge mcp tools <name>          # List server tools

claude-forge workflow run <id>         # Run a workflow
claude-forge workflow demo             # Run demo pipeline
```

### Agent SDK (`packages/agents`)
```typescript
import { ClaudeAgent, MultiAgentOrchestrator } from '@claudeforge/agents'

// Single agent with hooks + skills
const agent = new ClaudeAgent({
  name: 'My Agent',
  model: 'claude-sonnet-4-6',
  systemPrompt: 'You are a helpful assistant.',
})

const result = await agent.run('Explain quantum entanglement simply')
console.log(result.output, result.usage)

// Multi-agent orchestration (decompose → parallel → synthesize)
const orchestrator = new MultiAgentOrchestrator({ name: 'Research' })
const report = await orchestrator.run('Analyze the impact of LLMs on software engineering')
```

### Hooks System (`packages/agents`)
```typescript
import { createCostGuardHook, createSafetyHook, createAuditLogHook } from '@claudeforge/agents'

agent.addHook(createCostGuardHook(0.50))          // Block if cost > $0.50
agent.addHook(createSafetyHook(['rm -rf', 'sudo'])) // Block dangerous patterns
agent.addHook(createAuditLogHook())                 // Log all events
```

### MCP Integration (`packages/mcp`)
```typescript
import { MCPRegistry } from '@claudeforge/mcp'

const registry = MCPRegistry.withDefaults('/path/to/repo')
// Registers: filesystem + web + git + code servers

const agent = new ClaudeAgent({
  name: 'Dev Agent',
  model: 'claude-opus-4-6',
  tools: registry.getAllTools(),
})
```

---

## Prompt Library

20+ curated prompts in `prompts/` organized by category:

| Category | Prompts |
|----------|---------|
| **Research** | Deep Research, Competitive Analysis, Literature Review |
| **Coding** | Code Review, Debug This, Write Tests, Refactor |
| **Writing** | Improve Prose, Email Reply, Summarize |
| **Analysis** | Pros & Cons, Root Cause Analysis, Decision Framework |
| **Productivity** | Meeting Notes, Action Items, Weekly Review |

Each prompt: YAML frontmatter + tested template with `{{variable}}` placeholders.

---

## Agent Templates

10 pre-built agent configs available in the Templates gallery:

| Template | Model | Purpose |
|----------|-------|---------|
| Research Assistant | Sonnet | Deep research + structured synthesis |
| Code Reviewer | Opus | Security, bugs, performance review |
| Writing Coach | Sonnet | Edit, improve, rewrite prose |
| Data Analyst | Sonnet | Analyze data, find insights |
| SQL Expert | Haiku | Write and explain SQL queries |
| API Designer | Sonnet | Design REST APIs, OpenAPI specs |
| Explain Like I'm 5 | Haiku | Simplify complex topics |
| Debate Coach | Opus | Argue both sides, find weaknesses |
| Meeting Summarizer | Haiku | Extract decisions + action items |
| Career Coach | Sonnet | Resume, interviews, career advice |

---

## Examples

Four runnable demos in `examples/`:

```bash
# Simple: ClaudeClient direct usage
cd examples/simple-agent && npx tsx index.ts

# Multi-agent: Orchestrated parallel research
cd examples/multi-agent-research && npx tsx index.ts

# MCP: Agent with filesystem + web + git tools
cd examples/mcp-integration && npx tsx index.ts

# Pipeline: Research → Write → Edit workflow
cd examples/workflow-automation && npx tsx index.ts
```

---

## Development

```bash
npm install          # Install all workspace dependencies
npm run build        # Build all TypeScript packages
npm run dev          # Start API + Web in parallel (hot reload)
npm run start:api    # API server only (port 3000)
npm run start:web    # Web dashboard only (port 5173)
npm run migrate      # Run database migrations
```

### Environment Variables
```bash
ANTHROPIC_API_KEY=sk-ant-...    # Required
PORT=3000                        # API server port (default 3000)
DATABASE_URL=./data/claude-forge.db  # SQLite path
DEFAULT_MODEL=claude-sonnet-4-6  # Fallback model
COST_LIMIT_PER_RUN=1.00         # Max cost per run ($)
```

---

## Repository Structure

```
claude-forge/
├── packages/
│   ├── core/          — ClaudeClient, model router, cost calculator
│   ├── agents/        — ClaudeAgent, MultiAgentOrchestrator, hooks, skills
│   ├── mcp/           — 5 MCP servers + MCPRegistry
│   ├── api/           — Express REST API + SQLite
│   └── cli/           — claude-forge CLI
├── apps/
│   └── web/           — React + Vite dashboard
├── skills/
│   ├── research-assistant/   — SKILL.md package
│   ├── code-reviewer/        — SKILL.md package
│   └── document-analyst/     — SKILL.md package
├── prompts/           — 20+ curated prompt templates
├── examples/          — 4 runnable demos
├── scripts/
│   └── setup.ts       — One-command quickstart
└── CLAUDE.md          — Platform instructions for agents
```

---

## License

MIT — built for the Anthropic ecosystem.
