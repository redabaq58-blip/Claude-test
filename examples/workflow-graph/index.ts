/**
 * WorkflowGraph Example — Review & Revise Loop
 * ─────────────────────────────────────────────
 * Demonstrates three key features of ClaudeForge's WorkflowGraph:
 *
 *   1. Conditional routing  — the reviewer decides whether to approve or revise
 *   2. Cycles               — the graph loops writer→reviewer until quality ≥ 8
 *   3. Parallel branches    — two independent post-processing agents run at once
 *
 * Graph topology:
 *
 *   [write] ──────────────────────────────────────────►[format]──►[END]
 *      ▲                                              ▲
 *      │  score < 8                     score ≥ 8    │
 *      └──────────────[review]──────────────────────►[summarise]
 *
 * Run: npx tsx index.ts
 */

import 'dotenv/config'
import { ClaudeAgent } from '@claudeforge/agents'
import { WorkflowGraph, END } from '@claudeforge/agents'

// ─── Shared state type ────────────────────────────────────────────────────────

interface ArticleState {
  topic: string
  draft: string
  reviewFeedback: string
  score: number          // 1–10 quality score assigned by reviewer
  revisionCount: number
  summary: string
  formatted: string
}

// ─── Agent helpers ────────────────────────────────────────────────────────────

function makeAgent(name: string, systemPrompt: string, model: 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6' = 'claude-haiku-4-5-20251001') {
  return new ClaudeAgent({ name, model, systemPrompt, logUsage: false })
}

const writer   = makeAgent('Writer',    'You are an expert content writer. Produce clear, engaging prose.')
const reviewer = makeAgent('Reviewer',  'You are a critical editor. Score writing 1-10 and give actionable feedback.', 'claude-sonnet-4-6')
const summer   = makeAgent('Summariser','You are a concise summariser. Distill key points in 2-3 sentences.')
const formatter = makeAgent('Formatter','You are a markdown formatter. Structure content with headers and bullets.')

// ─── Build the graph ──────────────────────────────────────────────────────────

const graph = new WorkflowGraph<ArticleState>()

  // Node: write (or revise) the article
  .addNode('write', async (state) => {
    const prompt = state.revisionCount === 0
      ? `Write a 3-paragraph article about: "${state.topic}"`
      : `Revise this article based on feedback.\n\nArticle:\n${state.draft}\n\nFeedback:\n${state.reviewFeedback}\n\nImprove it specifically addressing every point.`

    const result = await writer.run(prompt)
    return { ...state, draft: result.output, revisionCount: state.revisionCount + 1 }
  })

  // Node: review — scores the draft and gives feedback
  .addNode('review', async (state) => {
    const result = await reviewer.run(
      `Review this article about "${state.topic}". Score it 1–10 and list specific improvements needed.\n\nArticle:\n${state.draft}\n\nRespond in exactly this format:\nSCORE: <number>\nFEEDBACK: <your feedback>`
    )
    const scoreMatch = result.output.match(/SCORE:\s*(\d+(?:\.\d+)?)/)
    const feedbackMatch = result.output.match(/FEEDBACK:\s*([\s\S]+)/)
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 5
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : result.output
    return { ...state, score, reviewFeedback: feedback }
  })

  // Node: summarise (post-approval, runs in parallel with format)
  .addNode('summarise', async (state) => {
    const result = await summer.run(`Summarise this article in 2-3 sentences:\n${state.draft}`)
    return { ...state, summary: result.output }
  })

  // Node: format (post-approval, runs in parallel with summarise)
  .addNode('format', async (state) => {
    const result = await formatter.run(`Format this article in markdown with clear headers and a bullet-point key takeaways section:\n${state.draft}`)
    return { ...state, formatted: result.output }
  })

  // Edges
  .addEdge('write', 'review')

  // Conditional: if score ≥ 8 → fan-out to summarise + format; else → revise
  .addConditionalEdge('review', (s) => s.score >= 8 ? 'summarise' : 'write')
  .addConditionalEdge('review', (s) => s.score >= 8 ? 'format'    : END)

  .addEdge('summarise', END)
  .addEdge('format',    END)

  .setEntryPoint('write')
  .setMaxIterations(20)   // safety: prevent runaway loops

// ─── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  const topic = process.argv[2] ?? 'the future of AI agents'

  console.log('\n═══ WorkflowGraph: Review & Revise Loop ═══')
  console.log(`Topic: "${topic}"\n`)

  const compiled = graph.compile()
  const initialState: ArticleState = {
    topic,
    draft: '',
    reviewFeedback: '',
    score: 0,
    revisionCount: 0,
    summary: '',
    formatted: '',
  }

  // Use streaming to print live progress
  let stepCount = 0
  for await (const execution of compiled.stream(initialState)) {
    stepCount++
    const icon =
      execution.nodeId === 'write'     ? '✍️ ' :
      execution.nodeId === 'review'    ? '🔍' :
      execution.nodeId === 'summarise' ? '📝' : '🎨'

    const extra = execution.nodeId === 'review'
      ? ` (score: ${(execution.outputState as ArticleState).score}/10)`
      : ''

    console.log(`  Step ${stepCount}: ${icon} ${execution.nodeId}${extra}  [${execution.durationMs}ms]`)
  }

  // Re-run invoke to get the final state (stream doesn't return it directly)
  const result = await compiled.invoke(initialState)

  console.log('\n─── Results ───────────────────────────────')
  console.log(`Revisions needed : ${result.finalState.revisionCount - 1}`)
  console.log(`Final score      : ${result.finalState.score}/10`)
  console.log(`Execution path   : ${result.executionPath.join(' → ')}`)
  console.log(`Total time       : ${result.durationMs}ms`)
  console.log('\n─── Summary ───────────────────────────────')
  console.log(result.finalState.summary)
  console.log('\n─── Formatted Article ─────────────────────')
  console.log(result.finalState.formatted)
}

main().catch(console.error)
