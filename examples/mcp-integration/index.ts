/**
 * MCP Integration Example
 * ────────────────────────
 * Demonstrates how to equip a ClaudeAgent with MCP tool servers.
 * The agent uses filesystem + git tools to analyze the repo it's running in.
 *
 * Run: npx tsx index.ts
 */
import 'dotenv/config'
import { resolve } from 'path'
import { ClaudeAgent } from '@claudeforge/agents'
import { MCPRegistry } from '@claudeforge/mcp'
import { createAuditLogHook } from '@claudeforge/agents'

async function main() {
  console.log('ClaudeForge — MCP Integration Example')
  console.log('Agent equipped with: filesystem + git tools\n')

  // ─── Set up MCP registry with filesystem and git tools ───────────────────
  const repoRoot = resolve(process.cwd(), '../..')
  const registry = MCPRegistry.withDefaults(repoRoot)

  const filesystemTools = registry.getTools('filesystem')
  const gitTools = registry.getTools('git')
  const allTools = [...filesystemTools, ...gitTools]

  console.log(`Registered tools: ${allTools.map((t) => t.definition.name).join(', ')}\n`)

  // ─── Create agent with MCP tools + audit hook ────────────────────────────
  const agent = new ClaudeAgent({
    name: 'Codebase Analyst',
    model: 'claude-sonnet-4-6',
    systemPrompt: `You are a codebase analyst. You have access to filesystem and git tools.
Use them to answer questions about the repository. Always use tools to gather real data before answering.`,
    tools: allTools,
    hooks: [
      createAuditLogHook((msg) => process.stdout.write(`\n[HOOK] ${msg}\n`)),
    ],
    logUsage: true,
  })

  // ─── Task 1: List the top-level structure ────────────────────────────────
  console.log('─'.repeat(60))
  console.log('Task 1: What packages exist in this monorepo?\n')

  const result1 = await agent.run(
    'Use the list_directory tool to show me the top-level structure of the repository, then summarize what each package does based on its name.'
  )
  console.log('\nAgent response:')
  console.log(result1.output)

  // ─── Task 2: Git history ─────────────────────────────────────────────────
  console.log('\n─'.repeat(60))
  console.log('Task 2: Recent git activity\n')

  const result2 = await agent.run(
    'Use git_log to show the last 5 commits and git_status to show any current changes. Summarize the recent development activity.'
  )
  console.log('\nAgent response:')
  console.log(result2.output)

  console.log('\n─'.repeat(60))
  console.log('MCP tools used successfully — agent accessed filesystem and git in real-time.')
}

main().catch(console.error)
