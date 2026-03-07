/**
 * Workflow Automation Example
 * ────────────────────────────
 * Demonstrates chaining multiple specialized agents in a pipeline:
 *
 *   Researcher (Haiku) → Writer (Sonnet) → Editor (Haiku)
 *
 * Each agent receives the previous agent's output as context,
 * building progressively toward a polished final product.
 *
 * Run: npx tsx index.ts
 */
import 'dotenv/config'
import { ClaudeAgent } from '@claudeforge/agents'

interface PipelineStep {
  name: string
  model: 'claude-opus-4-6' | 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001'
  systemPrompt: string
  buildPrompt: (topic: string, previous: string) => string
}

async function runPipeline(topic: string): Promise<void> {
  console.log(`\nTopic: "${topic}"`)
  console.log('─'.repeat(60))

  const pipeline: PipelineStep[] = [
    {
      name: 'Researcher',
      model: 'claude-haiku-4-5-20251001', // Fast + cheap for fact gathering
      systemPrompt: 'You are a research specialist. Gather key facts and insights efficiently.',
      buildPrompt: (t, _prev) =>
        `Research the topic: "${t}"\n\nProvide 5 key facts, statistics, or insights. Be specific and factual. Format as a numbered list.`,
    },
    {
      name: 'Writer',
      model: 'claude-sonnet-4-6', // Balanced for writing quality
      systemPrompt: 'You are a professional content writer. Turn research into engaging, clear prose.',
      buildPrompt: (t, prev) =>
        `Write a concise 3-paragraph article about: "${t}"\n\nBased on this research:\n${prev}\n\nMake it engaging and informative. No bullet points — flowing prose only.`,
    },
    {
      name: 'Editor',
      model: 'claude-haiku-4-5-20251001', // Fast for editing pass
      systemPrompt: 'You are a professional editor. Polish prose for clarity, flow, and impact.',
      buildPrompt: (_t, prev) =>
        `Edit and polish the following article. Improve clarity, fix awkward phrasing, ensure consistent tone, and strengthen the opening and closing sentences. Return ONLY the edited article:\n\n${prev}`,
    },
  ]

  let previousOutput = ''
  const results: Array<{ name: string; output: string; durationMs: number }> = []

  for (let i = 0; i < pipeline.length; i++) {
    const step = pipeline[i]
    process.stdout.write(`Step ${i + 1}/${pipeline.length}: ${step.name} (${step.model.replace('claude-', '').replace('-20251001', '')})...`)

    const agent = new ClaudeAgent({
      name: step.name,
      model: step.model,
      systemPrompt: step.systemPrompt,
      logUsage: false,
    })

    const prompt = step.buildPrompt(topic, previousOutput)
    const result = await agent.run(prompt)

    previousOutput = result.output
    results.push({ name: step.name, output: result.output, durationMs: result.usage.durationMs })
    console.log(` done (${result.usage.durationMs}ms)`)
  }

  // Show intermediate outputs
  console.log('\n─'.repeat(60))
  console.log('INTERMEDIATE OUTPUTS:\n')
  results.slice(0, -1).forEach((r) => {
    console.log(`[${r.name}]`)
    console.log(r.output.slice(0, 300) + (r.output.length > 300 ? '…' : ''))
    console.log()
  })

  // Show final output
  const final = results[results.length - 1]
  console.log('─'.repeat(60))
  console.log(`FINAL OUTPUT (after ${final.name}):\n`)
  console.log(final.output)

  const totalMs = results.reduce((s, r) => s + r.durationMs, 0)
  console.log('\n─'.repeat(60))
  console.log(`Pipeline complete in ${totalMs}ms across ${pipeline.length} agents`)
}

async function main() {
  console.log('ClaudeForge — Workflow Automation Example')
  console.log('Pipeline: Researcher → Writer → Editor\n')

  // Run the pipeline on a topic
  const topic = process.argv[2] ?? 'How Claude agents are transforming software development in 2026'
  await runPipeline(topic)
}

main().catch(console.error)
