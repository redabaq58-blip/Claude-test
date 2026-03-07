import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { MCPRegistry } from '@claudeforge/mcp'
import type { MCPServerType } from '@claudeforge/mcp'

export function registerMcpCommands(program: Command) {
  const mcp = program.command('mcp').description('Manage MCP tool servers')

  // claude-forge mcp list — show all server types and their tools
  mcp
    .command('list')
    .description('List available MCP server types and their tools')
    .action(() => {
      const serverTypes: MCPServerType[] = ['filesystem', 'web', 'git', 'database', 'code']

      console.log(chalk.bold('\nAvailable MCP Server Types:\n'))

      const descriptions: Record<MCPServerType, { desc: string; tools: string[] }> = {
        filesystem: {
          desc: 'File read/write/search operations',
          tools: ['read_file', 'write_file', 'list_directory', 'search_files'],
        },
        web: {
          desc: 'HTTP fetch and link extraction',
          tools: ['fetch_url', 'extract_links', 'check_url'],
        },
        git: {
          desc: 'Git log, diff, blame, commit operations',
          tools: ['git_status', 'git_log', 'git_diff', 'git_branch', 'git_show', 'git_blame'],
        },
        database: {
          desc: 'SQLite query and schema inspection',
          tools: ['db_query', 'db_schema'],
        },
        code: {
          desc: 'Execute JavaScript, Python, and Bash code',
          tools: ['run_javascript', 'run_python', 'run_bash', 'evaluate_expression'],
        },
      }

      for (const type of serverTypes) {
        const info = descriptions[type]
        console.log(`  ${chalk.cyan(type.padEnd(12))} ${chalk.dim(info.desc)}`)
        console.log(`  ${' '.repeat(12)} Tools: ${info.tools.map((t) => chalk.yellow(t)).join(', ')}`)
        console.log()
      }
    })

  // claude-forge mcp test <type> — test that a server type works
  mcp
    .command('test')
    .description('Test an MCP server type by registering it and listing its tools')
    .argument('<type>', 'Server type (filesystem|web|git|database|code)')
    .option('--path <path>', 'Path for filesystem/git servers')
    .option('--db <path>', 'Database path for database server')
    .action(async (type: string, options) => {
      const spinner = ora(`Testing MCP server: ${type}`).start()

      try {
        const registry = new MCPRegistry()
        const config: Record<string, unknown> = {}

        if (type === 'filesystem' && options.path) config.allowedPaths = [options.path]
        if (type === 'git' && options.path) config.repoPath = options.path
        if (type === 'database' && options.db) config.dbPath = options.db

        if (type === 'database' && !options.db) {
          spinner.fail('database server requires --db <path>')
          return
        }

        registry.register('test-server', { type: type as MCPServerType, options: config })
        const server = registry.get('test-server')

        if (server?.status === 'error') {
          spinner.fail(`Server error: ${server.error}`)
          return
        }

        const tools = registry.getTools('test-server')
        spinner.succeed(`${chalk.green(type)} server connected — ${tools.length} tools available`)

        console.log('\n  Tools:')
        for (const tool of tools) {
          console.log(
            `    ${chalk.yellow('•')} ${chalk.bold(tool.definition.name)}: ${chalk.dim(tool.definition.description)}`
          )
        }
      } catch (err) {
        spinner.fail(`Failed: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
      }
    })

  // claude-forge mcp tools <type> — list tools for a server type
  mcp
    .command('tools')
    .description('List all tools provided by an MCP server type')
    .argument('<type>', 'Server type (filesystem|web|git|code)')
    .action(async (type: string) => {
      try {
        const registry = new MCPRegistry()

        if (type === 'database') {
          console.log(chalk.yellow('Note: database server requires --db path. Showing schema only.'))
          console.log('  Tools: db_query, db_schema, db_execute (write mode)')
          return
        }

        registry.register('tools-server', { type: type as MCPServerType })
        const tools = registry.getTools('tools-server')

        console.log(chalk.bold(`\nTools in ${chalk.cyan(type)} server:\n`))
        for (const tool of tools) {
          console.log(`  ${chalk.yellow(tool.definition.name)}`)
          console.log(`    ${chalk.dim(tool.definition.description)}`)
          const required = tool.definition.input_schema.required ?? []
          if (required.length > 0) {
            console.log(`    Required: ${required.map((r: string) => chalk.green(r)).join(', ')}`)
          }
          console.log()
        }
      } catch (err) {
        console.error(chalk.red('Error:'), err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
