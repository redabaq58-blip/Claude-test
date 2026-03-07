import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { initDb } from './db/index.js'
import { agentsRouter } from './routes/agents.js'
import { workflowsRouter } from './routes/workflows.js'
import { mcpRouter } from './routes/mcp.js'
import { skillsRouter } from './routes/skills.js'
import { analyticsRouter } from './routes/analytics.js'
import { streamRouter } from './routes/stream.js'
import { runsRouter } from './routes/runs.js'
import { templatesRouter } from './routes/templates.js'
import { promptsRouter } from './routes/prompts.js'
import { conversationsRouter } from './routes/conversations.js'
import { compareRouter } from './routes/compare.js'
import { errorHandler, notFound } from './middleware/response.js'

const app = express()
const PORT = process.env.PORT ?? 3000

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '5mb' }))

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    platform: 'ClaudeForge',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
})

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/agents', agentsRouter)
app.use('/api/agents', streamRouter)
app.use('/api/workflows', workflowsRouter)
app.use('/api/mcp', mcpRouter)
app.use('/api/skills', skillsRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/runs', runsRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/prompts', promptsRouter)
app.use('/api/conversations', conversationsRouter)
app.use('/api/compare', compareRouter)

// ─── Error handlers ───────────────────────────────────────────────────────────

app.use(notFound)
app.use(errorHandler)

// ─── Start ────────────────────────────────────────────────────────────────────

initDb()
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║         ClaudeForge API v1.0          ║
║   The Ultimate Claude Agent Platform  ║
╚═══════════════════════════════════════╝

  Server: http://localhost:${PORT}
  Health: http://localhost:${PORT}/health

  Endpoints:
    POST /api/agents/:id/run      — Run agent
    POST /api/agents/:id/stream   — Stream response (SSE)
    GET  /api/templates           — Agent templates
    GET  /api/prompts             — Prompt library
    GET  /api/runs                — All run history
    GET  /api/analytics/costs     — Cost analytics
  `)
})

export default app
