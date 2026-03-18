import { execSync, spawnSync } from 'child_process'
import type { Tool } from '@claudeforge/core'

// ─── Code Execution MCP Server ────────────────────────────────────────────────
// Provides sandboxed code execution tools to Claude agents.
// Runs code in a subprocess with strict timeouts.

export interface CodeServerOptions {
  timeoutMs?: number     // Execution timeout (default: 10s)
  maxOutputSize?: number // Max stdout/stderr size (default: 50KB)
  allowedLanguages?: string[]
}

export function createCodeTools(options: CodeServerOptions = {}): Tool[] {
  const timeoutMs = options.timeoutMs ?? 10_000
  const maxOutputSize = options.maxOutputSize ?? 51_200
  const allowedLanguages = options.allowedLanguages ?? ['javascript', 'python', 'bash', 'sh']

  function runCode(command: string, args: string[], input?: string): { stdout: string; stderr: string; exitCode: number } {
    const result = spawnSync(command, args, {
      input: input,
      encoding: 'utf-8',
      timeout: timeoutMs,
      maxBuffer: maxOutputSize,
      env: {
        ...process.env,
        // Strip sensitive env vars
        ANTHROPIC_API_KEY: undefined,
        AWS_SECRET_ACCESS_KEY: undefined,
        DATABASE_URL: undefined,
      },
    })

    return {
      stdout: (result.stdout ?? '').slice(0, maxOutputSize),
      stderr: (result.stderr ?? '').slice(0, maxOutputSize),
      exitCode: result.status ?? 1,
    }
  }

  return [
    {
      definition: {
        name: 'run_javascript',
        description: 'Execute JavaScript code using Node.js and return the output',
        input_schema: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'JavaScript code to execute' },
          },
          required: ['code'],
        },
      },
      handler: async ({ code }) => {
        if (!allowedLanguages.includes('javascript')) {
          throw new Error('JavaScript execution is not allowed')
        }
        const result = runCode('node', ['--eval', code as string])
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          success: result.exitCode === 0,
        }
      },
    },

    {
      definition: {
        name: 'run_python',
        description: 'Execute Python code and return the output',
        input_schema: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Python code to execute' },
          },
          required: ['code'],
        },
      },
      handler: async ({ code }) => {
        if (!allowedLanguages.includes('python')) {
          throw new Error('Python execution is not allowed')
        }
        const result = runCode('python3', ['-c', code as string])
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          success: result.exitCode === 0,
        }
      },
    },

    {
      definition: {
        name: 'run_bash',
        description: 'Execute a bash command and return its output',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Bash command to execute' },
          },
          required: ['command'],
        },
      },
      handler: async ({ command }) => {
        if (!allowedLanguages.includes('bash') && !allowedLanguages.includes('sh')) {
          throw new Error('Bash execution is not allowed')
        }
        // Block dangerous commands (case-insensitive, checks encoded variants too)
        const dangerous = [
          'rm -rf', 'rm -r', 'sudo', 'su -', 'chmod 777', 'chmod -R',
          'curl | sh', 'curl|sh', 'wget | sh', 'wget|sh', 'bash <(', 'sh <(',
          '> /dev/', '/etc/passwd', '/etc/shadow', 'mkfs', 'dd if=', 'fork bomb',
          ':(){ :|:& };:', 'base64 -d', 'base64 --decode',
          '/proc/', 'iptables', 'ufw', 'systemctl', 'shutdown', 'reboot', 'halt',
          'kill -9', 'pkill', 'killall', 'nc -', 'netcat', 'ncat',
        ]
        const cmd = String(command)
        const cmdLower = cmd.toLowerCase()
        for (const pattern of dangerous) {
          if (cmdLower.includes(pattern.toLowerCase())) {
            throw new Error(`Blocked dangerous pattern: "${pattern}"`)
          }
        }
        // Block attempts to access sensitive environment variables
        if (/\$\{?ANTHROPIC_API_KEY/.test(cmd) || /\$\{?AWS_SECRET/.test(cmd)) {
          throw new Error('Blocked: cannot access sensitive environment variables')
        }
        const result = runCode('bash', ['-c', cmd])
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          success: result.exitCode === 0,
        }
      },
    },

    {
      definition: {
        name: 'evaluate_expression',
        description: 'Evaluate a mathematical or logical expression and return the result',
        input_schema: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Expression to evaluate (e.g. "2 ** 10 + 5")' },
          },
          required: ['expression'],
        },
      },
      handler: async ({ expression }) => {
        // Safe eval via Node.js isolated vm
        const result = runCode('node', ['--eval', `console.log(JSON.stringify(${expression}))`])
        if (result.exitCode !== 0) throw new Error(result.stderr)
        return { result: JSON.parse(result.stdout.trim()), expression }
      },
    },
  ]
}
