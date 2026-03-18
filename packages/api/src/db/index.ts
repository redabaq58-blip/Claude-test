import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import * as schema from './schema.js'

// In serverless (Vercel), DATABASE_URL should be a libsql/Turso URL like:
//   libsql://your-db.turso.io?authToken=xxx
// Locally it falls back to a file-based SQLite DB.
const rawUrl = process.env.DATABASE_URL ?? './data/claude-forge.db'

// Normalise local file paths to a libsql file:// URL so @libsql/client
// accepts them when DATABASE_URL is a plain path or relative path.
function resolveDbUrl(raw: string): string {
  if (raw.startsWith('libsql://') || raw.startsWith('file:') || raw.startsWith('http')) {
    return raw
  }
  // Plain local path — make absolute and prefix with file:
  const abs = resolve(raw)
  try {
    mkdirSync(dirname(abs), { recursive: true })
  } catch {
    // ignore — may not have fs access in serverless
  }
  return `file:${abs}`
}

const dbUrl = resolveDbUrl(rawUrl)
const authToken = process.env.DATABASE_AUTH_TOKEN

const client = createClient({ url: dbUrl, authToken })

export const db = drizzle(client, { schema })

// ─── Auto-migrate on startup ──────────────────────────────────────────────────

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    model TEXT NOT NULL DEFAULT 'auto',
    system_prompt TEXT DEFAULT '',
    tools TEXT DEFAULT '[]',
    mcp_servers TEXT DEFAULT '[]',
    skill_ids TEXT DEFAULT '[]',
    hook_config TEXT DEFAULT '{}',
    max_tokens INTEGER DEFAULT 8192,
    temperature REAL DEFAULT 1.0,
    is_active INTEGER DEFAULT 1,
    cache_enabled INTEGER DEFAULT 0,
    thinking_enabled INTEGER DEFAULT 0,
    thinking_budget INTEGER DEFAULT 8000,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    input TEXT NOT NULL,
    output TEXT DEFAULT '',
    error TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    model TEXT DEFAULT '',
    thinking_content TEXT,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_creation_tokens INTEGER DEFAULT 0,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    steps TEXT NOT NULL DEFAULT '[]',
    triggers TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    context TEXT DEFAULT '{}',
    step_results TEXT DEFAULT '[]',
    error TEXT,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    config TEXT DEFAULT '{}',
    status TEXT DEFAULT 'connected',
    last_error TEXT,
    tool_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    version TEXT DEFAULT '1.0.0',
    skill_md TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    title TEXT DEFAULT 'New Conversation',
    messages TEXT NOT NULL DEFAULT '[]',
    total_cost_usd REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    agent_run_id TEXT,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_creation_tokens INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'cron',
    cron_expression TEXT,
    webhook_secret TEXT,
    is_active INTEGER DEFAULT 1,
    last_run_at TEXT,
    next_run_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS batch_jobs (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    anthropic_batch_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    input_count INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    saved_cost_usd REAL DEFAULT 0,
    results_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS eval_suites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    agent_id TEXT,
    cases TEXT NOT NULL DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS eval_runs (
    id TEXT PRIMARY KEY,
    suite_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    average_score REAL,
    case_results TEXT DEFAULT '[]',
    used_batch INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  )`,
  // Migration: add new columns to existing tables (safe IF NOT EXISTS equivalent via ALTER TABLE)
  // These run every startup but are safe because SQLite ignores duplicate columns
  `ALTER TABLE agents ADD COLUMN cache_enabled INTEGER DEFAULT 0`,
  `ALTER TABLE agents ADD COLUMN thinking_enabled INTEGER DEFAULT 0`,
  `ALTER TABLE agents ADD COLUMN thinking_budget INTEGER DEFAULT 8000`,
  `ALTER TABLE agent_runs ADD COLUMN thinking_content TEXT`,
  `ALTER TABLE agent_runs ADD COLUMN cache_read_tokens INTEGER DEFAULT 0`,
  `ALTER TABLE agent_runs ADD COLUMN cache_creation_tokens INTEGER DEFAULT 0`,
  `ALTER TABLE usage_events ADD COLUMN cache_read_tokens INTEGER DEFAULT 0`,
  `ALTER TABLE usage_events ADD COLUMN cache_creation_tokens INTEGER DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_events_model ON usage_events(model)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id ON agent_runs(agent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at)`,
  // ── Forge runs (forge() engine persistence) ──────────────────────────────
  `CREATE TABLE IF NOT EXISTS forge_runs (
    id TEXT PRIMARY KEY,
    goal TEXT NOT NULL,
    agents TEXT NOT NULL DEFAULT '[]',
    options TEXT NOT NULL DEFAULT '{}',
    state TEXT NOT NULL DEFAULT '{}',
    steps TEXT NOT NULL DEFAULT '[]',
    current_step INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running',
    resume_prompt TEXT,
    output TEXT DEFAULT '',
    cost_usd REAL DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_forge_runs_status ON forge_runs(status)`,
  `CREATE INDEX IF NOT EXISTS idx_forge_runs_created_at ON forge_runs(created_at)`,
  // ── Studio flows (Forge Studio visual canvas) ─────────────────────────────
  `CREATE TABLE IF NOT EXISTS studio_flows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    definition TEXT NOT NULL DEFAULT '{}',
    generated_code TEXT DEFAULT '',
    is_deployed INTEGER DEFAULT 0,
    deployed_at TEXT,
    run_count INTEGER DEFAULT 0,
    last_run_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS studio_runs (
    id TEXT PRIMARY KEY,
    flow_id TEXT NOT NULL,
    thread_id TEXT,
    inputs TEXT DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    output TEXT DEFAULT '',
    cost_usd REAL DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_studio_runs_flow_id ON studio_runs(flow_id)`,
]

export async function initDb(): Promise<void> {
  for (const stmt of DDL_STATEMENTS) {
    try {
      await client.execute(stmt)
    } catch (err) {
      // Ignore "duplicate column" errors from ALTER TABLE migrations
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
        throw err
      }
    }
  }
}

export { schema }
