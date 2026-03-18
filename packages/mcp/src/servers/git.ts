import { spawnSync } from 'child_process'
import type { Tool } from '@claudeforge/core'

// ─── Git MCP Server ───────────────────────────────────────────────────────────
// Provides git operations as agent tools.

export interface GitServerOptions {
  repoPath?: string  // Git repo path (default: cwd)
  readonly?: boolean // Prevent write operations (default: false)
}

export function createGitTools(options: GitServerOptions = {}): Tool[] {
  const repoPath = options.repoPath ?? process.cwd()
  const readonly = options.readonly ?? false

  // All git calls use spawnSync with an explicit args array — never string
  // interpolation — to prevent command injection via user-controlled values.
  function git(args: string[]): string {
    const result = spawnSync('git', args, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    if (result.status !== 0) {
      throw new Error(
        `git ${args[0]} failed: ${result.stderr?.trim() ?? 'Unknown error'}`
      )
    }
    return result.stdout?.trim() ?? ''
  }

  const tools: Tool[] = [
    {
      definition: {
        name: 'git_status',
        description: 'Show the working tree status',
        input_schema: { type: 'object', properties: {}, required: [] },
      },
      handler: async () => git(['status']),
    },

    {
      definition: {
        name: 'git_log',
        description: 'Show recent commit history',
        input_schema: {
          type: 'object',
          properties: {
            n: { type: 'number', description: 'Number of commits to show (default: 10)' },
            oneline: { type: 'boolean', description: 'One line per commit (default: true)' },
          },
          required: [],
        },
      },
      handler: async ({ n = 10, oneline = true }) => {
        const formatArgs = oneline
          ? ['--oneline']
          : ['--format=%h %an %ad %s', '--date=short']
        return git(['log', ...formatArgs, `-${Math.min(Number(n), 200)}`])
      },
    },

    {
      definition: {
        name: 'git_diff',
        description: 'Show changes between commits or working tree',
        input_schema: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'From commit/branch (optional)' },
            to: { type: 'string', description: 'To commit/branch (optional)' },
            staged: { type: 'boolean', description: 'Show staged changes (default: false)' },
            file: { type: 'string', description: 'Limit diff to specific file (optional)' },
          },
          required: [],
        },
      },
      handler: async ({ from, to, staged = false, file }) => {
        const args = ['diff']
        if (staged) args.push('--staged')
        if (from) args.push(String(from))
        if (to) args.push(String(to))
        if (file) { args.push('--'); args.push(String(file)) }
        return git(args) || 'No changes'
      },
    },

    {
      definition: {
        name: 'git_branch',
        description: 'List, create, or show branches',
        input_schema: {
          type: 'object',
          properties: {
            all: { type: 'boolean', description: 'Show all branches including remote (default: false)' },
          },
          required: [],
        },
      },
      handler: async ({ all = false }) => git(all ? ['branch', '-a'] : ['branch']),
    },

    {
      definition: {
        name: 'git_show',
        description: 'Show details of a specific commit',
        input_schema: {
          type: 'object',
          properties: {
            ref: { type: 'string', description: 'Commit hash or ref (default: HEAD)' },
          },
          required: [],
        },
      },
      handler: async ({ ref = 'HEAD' }) => git(['show', String(ref), '--stat']),
    },

    {
      definition: {
        name: 'git_blame',
        description: 'Show who last modified each line of a file',
        input_schema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'File to blame' },
          },
          required: ['file'],
        },
      },
      handler: async ({ file }) => git(['blame', String(file), '--date=short']),
    },
  ]

  // Write operations (only if not readonly)
  if (!readonly) {
    tools.push(
      {
        definition: {
          name: 'git_add',
          description: 'Stage files for commit',
          input_schema: {
            type: 'object',
            properties: {
              files: {
                type: 'array',
                items: { type: 'string' },
                description: 'Files to stage (use ["."] for all)',
              },
            },
            required: ['files'],
          },
        },
        handler: async ({ files }) => {
          const result = spawnSync('git', ['add', '--', ...(files as string[])], {
            cwd: repoPath,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          })
          if (result.status !== 0) {
            throw new Error(`git add failed: ${result.stderr?.trim() ?? 'Unknown error'}`)
          }
          return result.stdout?.trim() ?? 'Files staged'
        },
      },
      {
        definition: {
          name: 'git_commit',
          description: 'Create a commit with staged changes',
          input_schema: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Commit message' },
            },
            required: ['message'],
          },
        },
        handler: async ({ message }) => {
          const result = spawnSync('git', ['commit', '-m', String(message)], {
            cwd: repoPath,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          })
          if (result.status !== 0) {
            throw new Error(`git commit failed: ${result.stderr?.trim() ?? 'Unknown error'}`)
          }
          return result.stdout?.trim() ?? ''
        },
      }
    )
  }

  return tools
}
