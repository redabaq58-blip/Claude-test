import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ─── Agents ───────────────────────────────────────────────────────────────────

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').default(''),
  model: text('model').notNull().default('auto'),
  systemPrompt: text('system_prompt').default(''),
  tools: text('tools').default('[]'),        // JSON array of tool names/configs
  mcpServers: text('mcp_servers').default('[]'), // JSON array of MCP server names
  skillIds: text('skill_ids').default('[]'),  // JSON array of skill IDs
  hookConfig: text('hook_config').default('{}'), // JSON hook config
  maxTokens: integer('max_tokens').default(8192),
  temperature: real('temperature').default(1.0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  // Feature flags
  cacheEnabled: integer('cache_enabled', { mode: 'boolean' }).default(false),
  thinkingEnabled: integer('thinking_enabled', { mode: 'boolean' }).default(false),
  thinkingBudget: integer('thinking_budget').default(8000),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── Agent Runs ───────────────────────────────────────────────────────────────

export const agentRuns = sqliteTable('agent_runs', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  status: text('status').notNull().default('pending'), // pending|running|completed|failed
  input: text('input').notNull(),
  output: text('output').default(''),
  error: text('error'),
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  costUsd: real('cost_usd').default(0),
  durationMs: integer('duration_ms').default(0),
  model: text('model').default(''),
  thinkingContent: text('thinking_content'),
  cacheReadTokens: integer('cache_read_tokens').default(0),
  cacheCreationTokens: integer('cache_creation_tokens').default(0),
  startedAt: text('started_at').default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
})

// ─── Workflows ────────────────────────────────────────────────────────────────

export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').default(''),
  steps: text('steps').notNull().default('[]'), // JSON: [{agentId, inputTemplate, outputKey}]
  triggers: text('triggers').default('[]'),      // JSON: [{type, config}]
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── Workflow Runs ────────────────────────────────────────────────────────────

export const workflowRuns = sqliteTable('workflow_runs', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull(),
  status: text('status').notNull().default('pending'),
  context: text('context').default('{}'),      // JSON: input context
  stepResults: text('step_results').default('[]'), // JSON: results per step
  error: text('error'),
  startedAt: text('started_at').default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
})

// ─── MCP Servers ──────────────────────────────────────────────────────────────

export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  type: text('type').notNull(), // filesystem|web|git|database|code|custom
  config: text('config').default('{}'), // JSON options for the server
  status: text('status').default('connected'), // connected|error|disabled
  lastError: text('last_error'),
  toolCount: integer('tool_count').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// ─── Skills ───────────────────────────────────────────────────────────────────

export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').default(''),
  version: text('version').default('1.0.0'),
  skillMd: text('skill_md').notNull(),          // Full SKILL.md content
  tags: text('tags').default('[]'),              // JSON array
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// ─── Conversations ────────────────────────────────────────────────────────────

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  title: text('title').default('New Conversation'),
  messages: text('messages').notNull().default('[]'), // JSON: [{role,content,timestamp,usage?}]
  totalCostUsd: real('total_cost_usd').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})


export const usageEvents = sqliteTable('usage_events', {
  id: text('id').primaryKey(),
  agentRunId: text('agent_run_id'),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  costUsd: real('cost_usd').notNull().default(0),
  cacheReadTokens: integer('cache_read_tokens').default(0),
  cacheCreationTokens: integer('cache_creation_tokens').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// ─── Schedules ────────────────────────────────────────────────────────────────

export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull().default('cron'), // cron|webhook
  cronExpression: text('cron_expression'),       // e.g. "0 9 * * *"
  webhookSecret: text('webhook_secret'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastRunAt: text('last_run_at'),
  nextRunAt: text('next_run_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── Batch Jobs ───────────────────────────────────────────────────────────────

export const batchJobs = sqliteTable('batch_jobs', {
  id: text('id').primaryKey(),
  agentId: text('agent_id'),
  anthropicBatchId: text('anthropic_batch_id').notNull(),
  status: text('status').notNull().default('submitted'), // submitted|processing|ended|cancelled|errored
  inputCount: integer('input_count').default(0),
  completedCount: integer('completed_count').default(0),
  costUsd: real('cost_usd').default(0),
  savedCostUsd: real('saved_cost_usd').default(0),
  resultsJson: text('results_json'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
})

// ─── Eval Suites ──────────────────────────────────────────────────────────────

export const evalSuites = sqliteTable('eval_suites', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').default(''),
  agentId: text('agent_id'),
  cases: text('cases').notNull().default('[]'), // JSON: [{id, input, expectedOutput, criteria, scoreMethod}]
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── Eval Runs ────────────────────────────────────────────────────────────────

export const evalRuns = sqliteTable('eval_runs', {
  id: text('id').primaryKey(),
  suiteId: text('suite_id').notNull(),
  agentId: text('agent_id').notNull(),
  status: text('status').notNull().default('pending'), // pending|running|completed|failed
  averageScore: real('average_score'),
  caseResults: text('case_results').default('[]'), // JSON: [{caseId, input, output, score, rationale}]
  usedBatch: integer('used_batch', { mode: 'boolean' }).default(false),
  costUsd: real('cost_usd').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
})

// ─── Forge Runs ───────────────────────────────────────────────────────────────
// Persisted state for forge() executions.
// Each row is one thread — can be resumed if status is 'interrupted'.

export const forgeRuns = sqliteTable('forge_runs', {
  id: text('id').primaryKey(),           // = threadId
  goal: text('goal').notNull(),
  agents: text('agents').notNull().default('[]'),
  options: text('options').notNull().default('{}'),
  state: text('state').notNull().default('{}'),
  steps: text('steps').notNull().default('[]'),
  currentStep: integer('current_step').default(0),
  status: text('status').notNull().default('running'),  // running|interrupted|completed|failed
  resumePrompt: text('resume_prompt'),
  output: text('output').default(''),
  costUsd: real('cost_usd').default(0),
  durationMs: integer('duration_ms').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── Studio Flows ─────────────────────────────────────────────────────────────
// Visual workflows built in Forge Studio. Powered by forge() under the hood.

export const studioFlows = sqliteTable('studio_flows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').default(''),
  definition: text('definition').notNull().default('{}'),  // JSON canvas: { nodes, edges, variables }
  generatedCode: text('generated_code').default(''),
  isDeployed: integer('is_deployed', { mode: 'boolean' }).default(false),
  deployedAt: text('deployed_at'),
  runCount: integer('run_count').default(0),
  lastRunAt: text('last_run_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── Studio Runs ──────────────────────────────────────────────────────────────

export const studioRuns = sqliteTable('studio_runs', {
  id: text('id').primaryKey(),
  flowId: text('flow_id').notNull(),
  threadId: text('thread_id'),
  inputs: text('inputs').default('{}'),
  status: text('status').notNull().default('pending'),
  output: text('output').default(''),
  costUsd: real('cost_usd').default(0),
  durationMs: integer('duration_ms').default(0),
  error: text('error'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
})
