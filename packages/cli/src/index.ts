#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import chalk from 'chalk'
import { registerAgentCommands } from './commands/agent.js'
import { registerMcpCommands } from './commands/mcp.js'
import { registerWorkflowCommands } from './commands/workflow.js'

const program = new Command()

program
  .name('claude-forge')
  .description(
    chalk.bold('ClaudeForge') +
      ' — The Ultimate Claude/Anthropic Agent Platform\n' +
      chalk.dim('  Agents · MCP Servers · Skills · Workflows · Analytics')
  )
  .version('1.0.0')

// ─── Register command groups ──────────────────────────────────────────────────

registerAgentCommands(program)
registerMcpCommands(program)
registerWorkflowCommands(program)

// ─── Quick commands ───────────────────────────────────────────────────────────

// claude-forge models — show available Claude models
program
  .command('models')
  .description('List available Claude models with pricing')
  .action(() => {
    console.log(chalk.bold('\nAvailable Claude Models:\n'))
    const models = [
      {
        id: 'claude-opus-4-6',
        tier: 'Opus',
        desc: 'Complex reasoning, orchestration, synthesis',
        input: '$5.00',
        output: '$25.00',
      },
      {
        id: 'claude-sonnet-4-6',
        tier: 'Sonnet',
        desc: 'General purpose, balanced (default)',
        input: '$3.00',
        output: '$15.00',
      },
      {
        id: 'claude-haiku-4-5-20251001',
        tier: 'Haiku',
        desc: 'Fast responses, high-volume tasks',
        input: '$1.00',
        output: '$5.00',
      },
    ]

    for (const model of models) {
      console.log(
        `  ${chalk.cyan(model.tier.padEnd(8))} ${chalk.bold(model.id)}`
      )
      console.log(`  ${''.padEnd(8)} ${chalk.dim(model.desc)}`)
      console.log(
        `  ${''.padEnd(8)} In: ${chalk.green(model.input)}/MTok  Out: ${chalk.yellow(model.output)}/MTok`
      )
      console.log()
    }

    console.log(chalk.dim('  Use --model auto to let ClaudeForge select the best model for your task.'))
  })

// claude-forge status — check API key and connectivity
program
  .command('status')
  .description('Check ANTHROPIC_API_KEY and platform status')
  .action(async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.log(chalk.red('✗') + ' ANTHROPIC_API_KEY is not set')
      console.log(chalk.dim('  Set it: export ANTHROPIC_API_KEY=sk-ant-...'))
      process.exit(1)
    }

    const masked = apiKey.slice(0, 10) + '...' + apiKey.slice(-4)
    console.log(chalk.green('✓') + ` ANTHROPIC_API_KEY found: ${chalk.dim(masked)}`)

    // Quick connectivity test
    const ora = (await import('ora')).default
    const spinner = ora('Testing Claude API connection...').start()
    try {
      const { ClaudeClient } = await import('@claudeforge/core')
      const client = new ClaudeClient()
      const response = await client.ask('Reply with just "ok"', {
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 10,
      })
      spinner.succeed(chalk.green('Claude API connected') + chalk.dim(` (response: "${response.trim()}")`))
    } catch (err) {
      spinner.fail(`API error: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }

    console.log()
    console.log(chalk.bold('ClaudeForge v1.0.0') + chalk.dim(' — Ready'))
  })

program.parse(process.argv)
