/**
 * Vercel serverless entry point.
 *
 * Vercel runs `buildCommand` (npm run build) first, which compiles all
 * TypeScript packages into their dist/ directories.  This file then imports
 * the pre-built Express app so @vercel/node only needs to handle plain JS.
 *
 * The Express app does NOT call app.listen() when VERCEL=1.
 */

import 'dotenv/config'
import { initDb } from '../packages/api/dist/db/index.js'
import app from '../packages/api/dist/server.js'

// Initialise DB tables on cold start
initDb().catch((err) => {
  console.error('[DB] init failed:', err)
})

export default app
