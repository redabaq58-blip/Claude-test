import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { eq, desc } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ok, fail } from '../middleware/response.js'
import { ClaudeClient, MODELS } from '@claudeforge/core'
import { ClaudeAgent } from '@claudeforge/agents'
import type { ClaudeModel } from '@claudeforge/core'

export const evalsRouter = Router()

interface EvalCase {
  id: string
  input: string
  expectedOutput?: string
  criteria?: string
  scoreMethod: 'exact_match' | 'contains' | 'llm_judge' | 'regex'
  pattern?: string  // for regex method
}

interface EvalCaseResult {
  caseId: string
  input: string
  output: string
  score: number        // 0-5
  rationale?: string
  passed: boolean
}

// ─── LLM Judge ───────────────────────────────────────────────────────────────

async function judgeWithLLM(
  input: string,
  output: string,
  criteria: string,
  expectedOutput?: string
): Promise<{ score: number; rationale: string }> {
  const client = new ClaudeClient()
  const prompt = `You are an objective evaluator. Score the following AI response on a scale of 1-5.

Input: ${input}
${expectedOutput ? `Expected Output: ${expectedOutput}\n` : ''}
Actual Output: ${output}

Evaluation Criteria: ${criteria}

Respond with JSON only: {"score": <1-5>, "rationale": "<brief explanation>"}`

  try {
    const response = await client.ask(prompt, { model: MODELS.HAIKU })
    const jsonMatch = response.match(/\{[\s\S]*?\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { score: number; rationale: string }
      return { score: Math.min(5, Math.max(1, Math.round(parsed.score))), rationale: parsed.rationale }
    }
  } catch {
    // fallback
  }
  return { score: 3, rationale: 'Unable to evaluate' }
}

// ─── Scoring functions ────────────────────────────────────────────────────────

async function scoreCase(evalCase: EvalCase, output: string): Promise<EvalCaseResult> {
  let score = 0
  let rationale: string | undefined
  let passed = false

  switch (evalCase.scoreMethod) {
    case 'exact_match':
      passed = output.trim() === (evalCase.expectedOutput ?? '').trim()
      score = passed ? 5 : 0
      break

    case 'contains':
      passed = output.toLowerCase().includes((evalCase.expectedOutput ?? '').toLowerCase())
      score = passed ? 5 : 0
      break

    case 'regex':
      if (evalCase.pattern) {
        try {
          passed = new RegExp(evalCase.pattern).test(output)
          score = passed ? 5 : 0
        } catch {
          score = 0
        }
      }
      break

    case 'llm_judge': {
      const result = await judgeWithLLM(
        evalCase.input,
        output,
        evalCase.criteria ?? 'The response should be helpful, accurate, and well-written.',
        evalCase.expectedOutput
      )
      score = result.score
      rationale = result.rationale
      passed = score >= 3
      break
    }
  }

  return {
    caseId: evalCase.id,
    input: evalCase.input,
    output,
    score,
    rationale,
    passed,
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/evals/suites
evalsRouter.get('/suites', async (_req, res) => {
  const rows = await db.select().from(schema.evalSuites).orderBy(desc(schema.evalSuites.createdAt))
  ok(res, rows)
})

// GET /api/evals/suites/:id
evalsRouter.get('/suites/:id', async (req, res) => {
  const [row] = await db.select().from(schema.evalSuites).where(eq(schema.evalSuites.id, req.params.id))
  if (!row) return fail(res, 'Eval suite not found', 404)
  ok(res, row)
})

// POST /api/evals/suites
evalsRouter.post('/suites', async (req, res) => {
  const { name, description, agentId, cases } = req.body
  if (!name) return fail(res, 'name is required')
  if (!Array.isArray(cases) || cases.length === 0) return fail(res, 'cases must be a non-empty array')

  const id = uuidv4()
  await db.insert(schema.evalSuites).values({
    id,
    name,
    description: description ?? '',
    agentId: agentId ?? null,
    cases: JSON.stringify(cases),
  })

  const [created] = await db.select().from(schema.evalSuites).where(eq(schema.evalSuites.id, id))
  ok(res, created)
})

// PUT /api/evals/suites/:id
evalsRouter.put('/suites/:id', async (req, res) => {
  const [existing] = await db.select().from(schema.evalSuites).where(eq(schema.evalSuites.id, req.params.id))
  if (!existing) return fail(res, 'Eval suite not found', 404)

  const { name, description, cases } = req.body
  await db.update(schema.evalSuites).set({
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(cases !== undefined && { cases: JSON.stringify(cases) }),
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.evalSuites.id, req.params.id))

  const [updated] = await db.select().from(schema.evalSuites).where(eq(schema.evalSuites.id, req.params.id))
  ok(res, updated)
})

// DELETE /api/evals/suites/:id
evalsRouter.delete('/suites/:id', async (req, res) => {
  const [existing] = await db.select().from(schema.evalSuites).where(eq(schema.evalSuites.id, req.params.id))
  if (!existing) return fail(res, 'Eval suite not found', 404)
  await db.delete(schema.evalSuites).where(eq(schema.evalSuites.id, req.params.id))
  ok(res, { deleted: true, id: req.params.id })
})

// GET /api/evals/runs?suiteId=xxx
evalsRouter.get('/runs', async (req, res) => {
  const { suiteId } = req.query
  let query = db.select().from(schema.evalRuns).orderBy(desc(schema.evalRuns.createdAt))
  if (suiteId) {
    query = db.select().from(schema.evalRuns)
      .where(eq(schema.evalRuns.suiteId, suiteId as string))
      .orderBy(desc(schema.evalRuns.createdAt)) as typeof query
  }
  const rows = await query
  ok(res, rows)
})

// GET /api/evals/runs/:id
evalsRouter.get('/runs/:id', async (req, res) => {
  const [row] = await db.select().from(schema.evalRuns).where(eq(schema.evalRuns.id, req.params.id))
  if (!row) return fail(res, 'Eval run not found', 404)
  ok(res, row)
})

// POST /api/evals/run — run a suite against an agent
evalsRouter.post('/run', async (req, res) => {
  const { suiteId, agentId } = req.body
  if (!suiteId) return fail(res, 'suiteId is required')
  if (!agentId) return fail(res, 'agentId is required')

  const [suite] = await db.select().from(schema.evalSuites).where(eq(schema.evalSuites.id, suiteId))
  if (!suite) return fail(res, 'Eval suite not found', 404)

  const [agentRow] = await db.select().from(schema.agents).where(eq(schema.agents.id, agentId))
  if (!agentRow) return fail(res, 'Agent not found', 404)

  const cases: EvalCase[] = JSON.parse(suite.cases ?? '[]')
  if (cases.length === 0) return fail(res, 'Suite has no test cases', 400)

  const runId = uuidv4()
  await db.insert(schema.evalRuns).values({
    id: runId,
    suiteId,
    agentId,
    status: 'running',
  })

  // Execute asynchronously and respond immediately with runId
  runEvalAsync(runId, cases, agentRow).catch((err) => {
    console.error(`[Evals] Run ${runId} failed:`, err)
    db.update(schema.evalRuns)
      .set({ status: 'failed', completedAt: new Date().toISOString() })
      .where(eq(schema.evalRuns.id, runId))
      .catch(console.error)
  })

  ok(res, { runId, status: 'running' })
})

async function runEvalAsync(
  runId: string,
  cases: EvalCase[],
  agentRow: { name: string; model: string | null; systemPrompt: string | null; maxTokens: number | null }
): Promise<void> {
  const agent = new ClaudeAgent({
    name: agentRow.name,
    model: (agentRow.model ?? 'auto') as ClaudeModel | 'auto',
    systemPrompt: agentRow.systemPrompt ?? '',
    maxTokens: agentRow.maxTokens ?? 8192,
    logUsage: false,
  })

  const caseResults: EvalCaseResult[] = []
  let totalCost = 0

  for (const evalCase of cases) {
    const result = await agent.run(evalCase.input)
    totalCost += result.usage.costUsd

    const caseResult = await scoreCase(evalCase, result.output)
    caseResults.push(caseResult)
  }

  const averageScore = caseResults.reduce((sum, r) => sum + r.score, 0) / caseResults.length

  await db.update(schema.evalRuns).set({
    status: 'completed',
    averageScore,
    caseResults: JSON.stringify(caseResults),
    costUsd: totalCost,
    completedAt: new Date().toISOString(),
  }).where(eq(schema.evalRuns.id, runId))
}
