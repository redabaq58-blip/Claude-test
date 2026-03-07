import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { ClaudeAgent, createAuditLogHook, createSafetyHook } from '@claudeforge/agents'
import { MCPRegistry } from '@claudeforge/mcp'
import { pipeStreamToStdout } from '@claudeforge/core'

export function registerAgentCommands(program: Command) {
  const agent = program.command('agent').description('Manage and run Claude agents')

  // claude-forge agent run — one-shot agent run from CLI
  agent
    .command('run')
    .description('Run a Claude agent with a prompt')
    .argument('<prompt>', 'The prompt/input for the agent')
    .option('-m, --model <model>', 'Model to use (opus|sonnet|haiku|auto)', 'auto')
    .option('-s, --system <prompt>', 'System prompt')
    .option('--with-filesystem', 'Enable filesystem MCP tools')
    .option('--with-web', 'Enable web MCP tools')
    .option('--with-git', 'Enable git MCP tools')
    .option('--with-code', 'Enable code execution tools')
    .option('--safe', 'Enable safety hooks (blocks dangerous patterns)')
    .option('--json', 'Output result as JSON')
    .action(async (prompt: string, options) => {
      const spinner = ora('Initializing agent...').start()

      try {
        // Build tool set from flags
        const registry = new MCPRegistry()
        const toolNames: string[] = []

        if (options.withFilesystem) {
          registry.register('filesystem', { type: 'filesystem' })
          toolNames.push('filesystem')
        }
        if (options.withWeb) {
          registry.register('web', { type: 'web' })
          toolNames.push('web')
        }
        if (options.withGit) {
          registry.register('git', { type: 'git', options: { readonly: true } })
          toolNames.push('git')
        }
        if (options.withCode) {
          registry.register('code', { type: 'code' })
          toolNames.push('code')
        }

        const tools = toolNames.flatMap((name) => {
          try { return registry.getTools(name) } catch { return [] }
        })

        const hooks = options.safe
          ? [createSafetyHook(['rm -rf', 'sudo', '> /dev/null'])]
          : []

        const claudeAgent = new ClaudeAgent({
          name: 'CLI Agent',
          model: options.model,
          systemPrompt: options.system,
          tools,
          hooks,
          logUsage: !options.json,
        })

        spinner.stop()

        if (!options.json) {
          console.log(chalk.dim(`\nRunning with model: ${options.model === 'auto' ? 'auto (sonnet)' : options.model}`))
          console.log(chalk.dim('─'.repeat(60)))
        }

        const result = await claudeAgent.run(prompt)

        if (options.json) {
          console.log(JSON.stringify(result, null, 2))
        } else {
          console.log()
          console.log(result.output)
          console.log()
          console.log(chalk.dim('─'.repeat(60)))
          console.log(
            chalk.dim(
              `Tokens: ${result.usage.totalTokens} | Cost: $${result.usage.costUsd.toFixed(6)} | ${result.usage.durationMs}ms`
            )
          )
        }
      } catch (err) {
        spinner.stop()
        console.error(chalk.red('Error:'), err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  // claude-forge agent ask — simple one-shot question (no memory)
  agent
    .command('ask')
    .description('Ask Claude a quick question (no tools, no memory)')
    .argument('<question>', 'Question to ask')
    .option('-m, --model <model>', 'Model (opus|sonnet|haiku|auto)', 'auto')
    .option('--stream', 'Stream the response')
    .action(async (question: string, options) => {
      const spinner = ora('Thinking...').start()

      try {
        const claudeAgent = new ClaudeAgent({
          name: 'Quick Ask',
          model: options.model,
          logUsage: false,
        })

        spinner.stop()

        if (options.stream) {
          const { ClaudeClient } = await import('@claudeforge/core')
          const client = new ClaudeClient()
          const stream = client.stream(
            [{ role: 'user', content: question }],
            { model: options.model }
          )
          await pipeStreamToStdout(stream)
        } else {
          const answer = await claudeAgent.ask(question)
          console.log(answer)
        }
      } catch (err) {
        spinner.stop()
        console.error(chalk.red('Error:'), err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  // claude-forge agent orchestrate — multi-agent task decomposition
  agent
    .command('orchestrate')
    .description('Run a complex task with multi-agent orchestration')
    .argument('<task>', 'Complex task to decompose and execute')
    .option('--json', 'Output full result as JSON')
    .action(async (task: string, options) => {
      const spinner = ora('Decomposing task with Opus...').start()

      try {
        const { MultiAgentOrchestrator } = await import('@claudeforge/agents')
        const orchestrator = new MultiAgentOrchestrator()

        spinner.text = 'Running parallel subagents...'
        const result = await orchestrator.run(task)
        spinner.stop()

        if (options.json) {
          console.log(JSON.stringify(result, null, 2))
        } else {
          console.log()
          console.log(chalk.bold('Subtasks:'))
          result.subtasks.forEach((st, i) => {
            const r = result.subtaskResults[i]
            const icon = r?.success ? chalk.green('✓') : chalk.red('✗')
            console.log(`  ${icon} ${st.description}`)
          })
          console.log()
          console.log(chalk.bold('Final Output:'))
          console.log(result.finalOutput)
          console.log()
          console.log(
            chalk.dim(
              `Total cost: $${result.totalUsage.costUsd.toFixed(4)} | Duration: ${result.durationMs}ms`
            )
          )
        }
      } catch (err) {
        spinner.stop()
        console.error(chalk.red('Error:'), err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
