/**
 * Simple Agent Example
 * ─────────────────────
 * Demonstrates the most basic use of ClaudeForge: ask Claude a question
 * using the ClaudeClient directly, then print the response and usage stats.
 *
 * Run: npx tsx index.ts
 */
import 'dotenv/config'
import { ClaudeClient, MODELS } from '@claudeforge/core'

async function main() {
  console.log('ClaudeForge — Simple Agent Example\n')

  const client = new ClaudeClient()

  // ─── Example 1: Simple question with auto model selection ────────────────
  console.log('Question: What are the 3 most impactful things Claude can do for developers?\n')

  const response = await client.complete(
    [{ role: 'user', content: 'What are the 3 most impactful things Claude can do for developers? Be concise.' }],
    {
      model: 'auto',
      taskConfig: { complexity: 'medium' },
      systemPrompt: 'You are a helpful assistant. Be concise and direct.',
    }
  )

  console.log('Answer:')
  console.log(response.content)
  console.log()
  console.log('─'.repeat(50))
  console.log(`Model:    ${response.usage.model}`)
  console.log(`Tokens:   ${response.usage.inputTokens} in / ${response.usage.outputTokens} out`)
  console.log(`Cost:     $${response.usage.costUsd.toFixed(6)}`)
  console.log(`Duration: ${response.usage.durationMs}ms`)

  // ─── Example 2: Ask helper (simplest possible usage) ─────────────────────
  console.log('\n─'.repeat(50))
  console.log('\nQuick Ask (Haiku — fast & cheap):')
  const quick = await client.ask(
    'In one sentence, what is the Model Context Protocol?',
    { model: MODELS.HAIKU }
  )
  console.log(quick)
}

main().catch(console.error)
