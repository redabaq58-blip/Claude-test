import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { resolve } from 'path'
import { existsSync } from 'fs'
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

// Resolve path to built web dashboard (works both locally and on Railway)
// process.cwd() is the repo root when started via npm run start or on Railway
const webDist = resolve(process.cwd(), 'apps/web/dist')
const serveWeb = existsSync(webDist)

// ─── Middleware ───────────────────────────────────────────────────────────────

// Disable CSP so the React dashboard loads correctly when served from this server
app.use(helmet({ contentSecurityPolicy: false }))
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

// ─── API Routes ───────────────────────────────────────────────────────────────

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

// ─── Serve web dashboard (production) ────────────────────────────────────────
// When deployed on Railway, the built React app is served from here.
// In local dev, Vite handles the frontend separately on port 5173.

if (serveWeb) {
  app.use(express.static(webDist))
  // SPA fallback — send index.html for any non-API route (React Router handles it)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next()
    res.sendFile(resolve(webDist, 'index.html'))
  })
}

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

  Server:    http://localhost:${PORT}
  Health:    http://localhost:${PORT}/health
  Dashboard: ${serveWeb ? `http://localhost:${PORT}` : 'http://localhost:5173 (run npm run start:web)'}

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
