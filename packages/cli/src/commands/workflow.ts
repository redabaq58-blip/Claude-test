import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { ClaudeAgent } from '@claudeforge/agents'

// ─── Inline workflow runner (no API server required) ──────────────────────────

export function registerWorkflowCommands(program: Command) {
  const workflow = program.command('workflow').description('Build and run multi-step agent workflows')

  // claude-forge workflow run — chain agents in sequence
  workflow
    .command('run')
    .description('Run a multi-step workflow: chain Claude agents in sequence')
    .option('--steps <json>', 'JSON array of steps: [{"name":"...","prompt":"...","model":"..."}]')
    .option('-i, --input <text>', 'Initial input for the first step')
    .option('--json', 'Output results as JSON')
    .action(async (options) => {
      if (!options.steps) {
        console.error(chalk.red('--steps is required'))
        console.log(
          chalk.dim(
            '\nExample:\n  claude-forge workflow run \\\n    --input "AI trends 2026" \\\n    --steps \'[{"name":"Researcher","prompt":"Research: {{input}}"},{"name":"Writer","prompt":"Write an article about: {{previous}}"}]\''
          )
        )
        process.exit(1)
      }

      let steps: Array<{ name: string; prompt: string; model?: string }>
      try {
        steps = JSON.parse(options.steps)
      } catch {
        console.error(chalk.red('Invalid JSON for --steps'))
        process.exit(1)
      }

      const results: Array<{ step: number; name: string; output: string; success: boolean }> = []
      let previousOutput = options.input ?? ''

      if (!options.json) {
        console.log(chalk.bold(`\nRunning workflow with ${steps.length} steps...\n`))
      }

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        const spinner = options.json ? null : ora(`Step ${i + 1}/${steps.length}: ${step.name}`).start()

        // Interpolate {{input}} and {{previous}} in the prompt
        const prompt = step.prompt
          .replace('{{input}}', options.input ?? '')
          .replace('{{previous}}', previousOutput)

        try {
          const agent = new ClaudeAgent({
            name: step.name,
            model: (step.model ?? 'auto') as 'auto',
            logUsage: false,
          })

          const result = await agent.run(prompt)
          previousOutput = result.output

          results.push({ step: i + 1, name: step.name, output: result.output, success: result.success })

          if (spinner) {
            spinner.succeed(`${chalk.cyan(step.name)} ${chalk.dim(`(${result.usage.durationMs}ms)`)}`)
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err)
          results.push({ step: i + 1, name: step.name, output: error, success: false })
          if (spinner) spinner.fail(`${step.name}: ${error}`)
        }
      }

      if (options.json) {
        console.log(JSON.stringify({ steps: results, finalOutput: previousOutput }, null, 2))
      } else {
        console.log()
        console.log(chalk.bold('Final Output:'))
        console.log(chalk.dim('─'.repeat(60)))
        console.log(previousOutput)
      }
    })

  // claude-forge workflow demo — run a built-in workflow demo
  workflow
    .command('demo')
    .description('Run a built-in workflow demo: Research → Write → Edit')
    .argument('<topic>', 'Topic for the demo workflow')
    .option('--json', 'Output as JSON')
    .action(async (topic: string, options) => {
      const steps = [
        {
          name: 'Researcher',
          model: 'claude-haiku-4-5-20251001',
          prompt: `Research the following topic and provide 5 key facts or insights: ${topic}`,
        },
        {
          name: 'Writer',
          model: 'claude-sonnet-4-6',
          prompt: `Based on this research:\n\n{{previous}}\n\nWrite a concise, engaging 3-paragraph article about: ${topic}`,
        },
        {
          name: 'Editor',
          model: 'claude-haiku-4-5-20251001',
          prompt: `Edit and polish this article for clarity and impact. Fix any awkward phrasing. Return only the edited article:\n\n{{previous}}`,
        },
      ]

      if (!options.json) {
        console.log(chalk.bold(`\nWorkflow Demo: Research → Write → Edit`))
        console.log(chalk.dim(`Topic: ${topic}\n`))
      }

      const results: Array<{ step: number; name: string; output: string; success: boolean }> = []
      let previousOutput = ''

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        const spinner = options.json ? null : ora(`Step ${i + 1}/${steps.length}: ${step.name}`).start()

        const prompt = step.prompt.replace('{{previous}}', previousOutput)

        try {
          const agent = new ClaudeAgent({
            name: step.name,
            model: step.model as 'claude-haiku-4-5-20251001',
            logUsage: false,
          })
          const result = await agent.run(prompt)
          previousOutput = result.output
          results.push({ step: i + 1, name: step.name, output: result.output, success: result.success })
          if (spinner) spinner.succeed(chalk.cyan(step.name))
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err)
          results.push({ step: i + 1, name: step.name, output: error, success: false })
          if (spinner) spinner.fail(`${step.name}: ${error}`)
        }
      }

      if (options.json) {
        console.log(JSON.stringify({ topic, steps: results, finalOutput: previousOutput }, null, 2))
      } else {
        console.log()
        console.log(chalk.bold('Final Article:'))
        console.log(chalk.dim('─'.repeat(60)))
        console.log(previousOutput)
      }
    })
}
