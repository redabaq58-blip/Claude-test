import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
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
import { occupationsRouter } from './routes/occupations.js'
import { visionRouter } from './routes/vision.js'
import { schedulesRouter } from './routes/schedules.js'
import { batchesRouter, pollBatchStatus } from './routes/batches.js'
import { evalsRouter } from './routes/evals.js'
import { forgeRouter } from './routes/forge.js'
import { studioRouter } from './routes/studio.js'
import { scheduleEngine } from './services/scheduleEngine.js'
import { db, schema } from './db/index.js'
import { inArray } from 'drizzle-orm'
import { errorHandler, notFound, ok } from './middleware/response.js'
import { authMiddleware } from './middleware/auth.js'

const app = express()
const PORT = process.env.PORT ?? 3000

// Resolve path to built web dashboard (works both locally and on Railway)
const webDist = resolve(process.cwd(), 'apps/web/dist')
const serveWeb = existsSync(webDist)

// ─── Middleware ───────────────────────────────────────────────────────────────

// Disable CSP so the React dashboard loads correctly when served from this server
app.use(helmet({ contentSecurityPolicy: false }))

// CORS — allow the Vite dev server origin in development, everything in production
// override with CORS_ORIGIN env var to lock down specific domains
const allowedOrigin = process.env.CORS_ORIGIN ?? (process.env.NODE_ENV === 'production' ? false : '*')
app.use(cors(allowedOrigin === false ? { origin: false } : { origin: allowedOrigin }))

app.use(express.json({ limit: '5mb' }))

// ─── Rate limiting ────────────────────────────────────────────────────────────
// General API limit: 300 req / 15 min per IP (ample for normal use)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: 'Too many requests. Please wait a moment and try again.' },
  skip: () => process.env.NODE_ENV === 'test',
})

// Stricter limit for Claude API calls (agent runs, streams, compares)
// 60 Claude API calls / 15 min per IP — prevents wallet drain
const claudeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: 'Too many AI requests. Please wait before running more agents.' },
  skip: () => process.env.NODE_ENV === 'test',
})

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  ok(res, {
    status: 'ok',
    platform: 'ClaudeForge',
    version: '1.0.1',
    timestamp: new Date().toISOString(),
  })
})

// ─── Auth ─────────────────────────────────────────────────────────────────────
// When API_SECRET env var is set, all /api/* routes require:
//   Authorization: Bearer <API_SECRET>
// Without API_SECRET the server runs in open/local mode.

app.use('/api', authMiddleware)

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/agents', generalLimiter, agentsRouter)
app.use('/api/agents', claudeLimiter, streamRouter)           // POST /:id/stream (SSE)
app.use('/api/workflows', generalLimiter, workflowsRouter)
app.use('/api/mcp', generalLimiter, mcpRouter)
app.use('/api/skills', generalLimiter, skillsRouter)
app.use('/api/analytics', generalLimiter, analyticsRouter)
app.use('/api/runs', generalLimiter, runsRouter)
app.use('/api/templates', generalLimiter, templatesRouter)
app.use('/api/prompts', generalLimiter, promptsRouter)
app.use('/api/conversations', generalLimiter, conversationsRouter)
app.use('/api/compare', claudeLimiter, compareRouter)          // Calls Claude API
app.use('/api/occupations', generalLimiter, occupationsRouter)
app.use('/api/vision', claudeLimiter, visionRouter)
app.use('/api/schedules', generalLimiter, schedulesRouter)
app.use('/api/batches', claudeLimiter, batchesRouter)
app.use('/api/evals', claudeLimiter, evalsRouter)
app.use('/api/forge', claudeLimiter, forgeRouter)    // forge() universal executor
app.use('/api/studio', generalLimiter, studioRouter) // Forge Studio visual canvas

// ─── Serve web dashboard (production) ────────────────────────────────────────
if (serveWeb) {
  app.use(express.static(webDist))
  // SPA fallback — send index.html for any non-API route
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next()
    res.sendFile(resolve(webDist, 'index.html'))
  })
}

// ─── Error handlers ───────────────────────────────────────────────────────────

app.use(notFound)
app.use(errorHandler)

// ─── Global error guards (prevent crash-loops) ────────────────────────────────

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

// ─── Start (only when run directly, not in serverless) ───────────────────────

// VERCEL / serverless: the module is imported, not executed directly.
// When run directly (Railway, Docker, local), start the HTTP server.
const isServerless = process.env.VERCEL === '1'

if (!isServerless) {
  initDb()
    .catch((err) => {
      console.error('[DB] Failed to initialise database — continuing without persistence:', err)
    })
    .then(() => {
      // Start schedule engine (fire-and-forget)
      scheduleEngine.start().catch((err) => {
        console.error('[ScheduleEngine] Failed to start:', err)
      })

      // Start batch polling loop (every 5 minutes)
      const BATCH_POLL_INTERVAL = 5 * 60 * 1000
      setInterval(async () => {
        try {
          const inFlightJobs = await db.select().from(schema.batchJobs)
            .where(inArray(schema.batchJobs.status, ['submitted', 'processing']))
          for (const job of inFlightJobs) {
            await pollBatchStatus(job.id)
          }
        } catch (err) {
          console.error('[BatchPoller] Error:', err)
        }
      }, BATCH_POLL_INTERVAL)
    })
    .then((_v: unknown) => {
      app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════╗
║         ClaudeForge API v1.0          ║
║   The Ultimate Claude Agent Platform  ║
╚═══════════════════════════════════════╝

  Server:    http://localhost:${PORT}
  Health:    http://localhost:${PORT}/health
  Dashboard: ${serveWeb ? `http://localhost:${PORT}` : 'http://localhost:5173 (run npm run start:web)'}
        `)
      })
    })
}

export default app
