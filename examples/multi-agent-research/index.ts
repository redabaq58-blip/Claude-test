/**
 * Multi-Agent Research Example
 * ─────────────────────────────
 * Demonstrates the MultiAgentOrchestrator pattern:
 *   1. Opus decomposes a complex research task into parallel subtasks
 *   2. Multiple Sonnet agents execute subtasks simultaneously
 *   3. Opus synthesizes all results into a final, unified output
 *
 * This mirrors Anthropic's proven approach that yields 90%+ improvement
 * over single-agent approaches for complex research and analysis.
 *
 * Run: npx tsx index.ts
 */
import 'dotenv/config'
import { MultiAgentOrchestrator } from '@claudeforge/agents'

async function main() {
  console.log('ClaudeForge — Multi-Agent Research Example')
  console.log('Pattern: Decompose → Parallel Execute → Synthesize\n')
  console.log('─'.repeat(60))

  const orchestrator = new MultiAgentOrchestrator({
    name: 'Research Orchestrator',
    maxParallel: 4,
    synthesizeResults: true,
  })

  const task =
    'Research and analyze the top 5 benefits of using Claude for enterprise AI adoption. ' +
    'Cover: productivity gains, safety features, integration capabilities, cost efficiency, and developer experience.'

  console.log(`Task: ${task}\n`)
  console.log('Starting orchestration...\n')

  const startTime = Date.now()
  const result = await orchestrator.run(task)
  const elapsed = Date.now() - startTime

  if (!result.success) {
    console.error('Orchestration failed:', result.error)
    process.exit(1)
  }

  // Show subtask breakdown
  console.log(`Decomposed into ${result.subtasks.length} parallel subtasks:\n`)
  result.subtasks.forEach((subtask, i) => {
    const run = result.subtaskResults[i]
    const status = run?.success ? '✓' : '✗'
    console.log(`  ${status} [${subtask.id}] ${subtask.description}`)
  })

  console.log('\n─'.repeat(60))
  console.log('FINAL SYNTHESIZED OUTPUT:\n')
  console.log(result.finalOutput)

  console.log('\n─'.repeat(60))
  console.log('Performance Summary:')
  console.log(`  Subtasks:       ${result.subtasks.length} parallel agents`)
  console.log(`  Total tokens:   ${result.totalUsage.totalTokens.toLocaleString()}`)
  console.log(`  Total cost:     $${result.totalUsage.costUsd.toFixed(4)}`)
  console.log(`  Wall time:      ${elapsed}ms (parallel — much faster than sequential)`)
  console.log()
  console.log('Compare: a single-agent approach would process this sequentially, taking longer')
  console.log('and producing shallower coverage. Multi-agent = depth + breadth + speed.')
}

main().catch(console.error)
