#!/usr/bin/env npx tsx
/**
 * ClaudeForge Setup Script
 * One-command platform bootstrap: checks environment, seeds DB, registers defaults.
 *
 * Usage:  npm run setup
 *    or:  npx tsx scripts/setup.ts
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'

// ─── Colors ──────────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  brand: '\x1b[38;5;99m', // purple
}

function log(icon: string, msg: string, color = c.white) {
  console.log(`${color}${icon}  ${msg}${c.reset}`)
}
function ok(msg: string) { log('✓', msg, c.green) }
function warn(msg: string) { log('⚠', msg, c.yellow) }
function err(msg: string) { log('✗', msg, c.red) }
function info(msg: string) { log('→', msg, c.cyan) }
function header(msg: string) { console.log(`\n${c.bold}${c.brand}${msg}${c.reset}`) }
function divider() { console.log(`${c.dim}${'─'.repeat(56)}${c.reset}`) }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function run(cmd: string, cwd?: string): string {
  return execSync(cmd, { cwd: cwd ?? ROOT, stdio: 'pipe', encoding: 'utf8' }).trim()
}

function apiPost(apiPath: string, body: unknown): Promise<{ data: unknown; error?: string }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const options: http.RequestOptions = {
      hostname: 'localhost',
      port: Number(process.env.PORT ?? 3000),
      path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error(`Invalid JSON: ${data.slice(0, 100)}`)) }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

function apiGet(apiPath: string): Promise<{ data: unknown; error?: string }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: 'localhost',
      port: Number(process.env.PORT ?? 3000),
      path: apiPath,
      method: 'GET',
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error(`Invalid JSON: ${data.slice(0, 100)}`)) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(path.dirname(new URL('file://' + __filename).pathname), '..')

async function main() {
  console.clear()
  console.log(`\n${c.bold}${c.brand}`)
  console.log('   ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗')
  console.log('  ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝')
  console.log('  ██║     ██║     ███████║██║   ██║██║  ██║█████╗  ')
  console.log('  ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝  ')
  console.log('  ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗')
  console.log('   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝')
  console.log(`${c.reset}${c.dim}   The Ultimate Claude & Anthropic Agent Platform${c.reset}\n`)
  divider()

  let step = 1
  const total = 7

  // ── Step 1: Check ANTHROPIC_API_KEY ────────────────────────────────────────
  header(`[${step++}/${total}] Checking environment`)

  // Load .env if present
  const envPath = path.join(ROOT, '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    for (const line of envContent.split('\n')) {
      const [k, ...v] = line.split('=')
      if (k && v.length && !process.env[k.trim()]) {
        process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '')
      }
    }
    ok('Loaded .env file')
  } else {
    warn('.env not found — copying from .env.example')
    const examplePath = path.join(ROOT, '.env.example')
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath)
      ok('Created .env from .env.example')
      err('Set ANTHROPIC_API_KEY in .env then re-run this script')
      process.exit(1)
    }
  }

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('sk-ant-...')) {
    err('ANTHROPIC_API_KEY is not set')
    info('Add it to your .env file:  ANTHROPIC_API_KEY=sk-ant-...')
    info('Get your key at: https://console.anthropic.com')
    process.exit(1)
  }

  const keyPreview = process.env.ANTHROPIC_API_KEY.slice(0, 12) + '...'
  ok(`ANTHROPIC_API_KEY found (${keyPreview})`)

  // ── Step 2: Test API connectivity ──────────────────────────────────────────
  header(`[${step++}/${total}] Testing Anthropic API connectivity`)
  info('Sending a quick ping to claude-haiku-4-5-20251001…')

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with just: OK' }],
    })
    const reply = msg.content[0]?.type === 'text' ? msg.content[0].text : '?'
    ok(`API connected — Claude replied: "${reply.trim()}"`)
  } catch (e) {
    err(`API test failed: ${e instanceof Error ? e.message : String(e)}`)
    info('Check your ANTHROPIC_API_KEY and internet connection')
    process.exit(1)
  }

  // ── Step 3: Install dependencies ───────────────────────────────────────────
  header(`[${step++}/${total}] Installing dependencies`)
  try {
    info('Running npm install (this may take a moment)…')
    run('npm install --silent')
    ok('Dependencies installed')
  } catch {
    warn('npm install had issues — continuing anyway')
  }

  // ── Step 4: Build packages ─────────────────────────────────────────────────
  header(`[${step++}/${total}] Building all packages`)
  try {
    info('Building TypeScript + React dashboard…')
    run('npm run build --silent')
    ok('All packages built')
  } catch {
    warn('Some packages may have failed to build — check output above')
  }

  // ── Step 5: Seed database ───────────────────────────────────────────────────
  header(`[${step++}/${total}] Seeding database with starter agents`)

  // Check if API is running
  let apiRunning = false
  try {
    await apiGet('/api/agents')
    apiRunning = true
    ok('API server is running')
  } catch {
    warn('API server not running — seeding will happen automatically on first start')
  }

  const dataDir = path.join(ROOT, 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
    ok('Created data/ directory')
  }

  if (apiRunning) {
    // Seed via API
    const starterAgents = [
      {
        name: 'Research Assistant',
        description: 'Deep research with structured synthesis across any topic',
        model: 'claude-sonnet-4-6',
        systemPrompt: 'You are an expert research assistant. When given a topic, conduct thorough research and provide structured, comprehensive analysis with clear sections: Overview, Key Findings, Analysis, and Recommendations. Always cite your reasoning and flag uncertainty.',
      },
      {
        name: 'Code Reviewer',
        description: 'Security-focused code review for bugs, performance, and best practices',
        model: 'claude-opus-4-6',
        systemPrompt: 'You are a senior software engineer and security expert. Review code for: (1) bugs and logic errors, (2) security vulnerabilities (OWASP Top 10), (3) performance issues, (4) code quality and maintainability. Be specific with line references and provide improved code snippets.',
      },
      {
        name: 'Quick Assistant',
        description: 'Fast, concise answers for everyday questions',
        model: 'claude-haiku-4-5-20251001',
        systemPrompt: "You are a fast, efficient assistant. Give concise, direct answers. Use bullet points for lists. Avoid unnecessary preamble. If you don't know something, say so clearly.",
      },
    ]

    let seeded = 0
    for (const agent of starterAgents) {
      try {
        await apiPost('/api/agents', agent)
        ok(`Seeded: ${agent.name}`)
        seeded++
      } catch {
        warn(`Could not seed ${agent.name} (may already exist)`)
      }
    }
    if (seeded > 0) ok(`${seeded} starter agents created`)
  } else {
    ok('Database directory ready — starter agents will be available after first start')
  }

  // ── Step 6: Register MCP servers ───────────────────────────────────────────
  header(`[${step++}/${total}] Registering default MCP servers`)

  if (apiRunning) {
    const mcpServers = [
      { name: 'filesystem', type: 'filesystem', config: { allowedPaths: [ROOT] } },
      { name: 'web', type: 'web', config: {} },
      { name: 'git', type: 'git', config: { repoPath: ROOT } },
    ]
    for (const server of mcpServers) {
      try {
        await apiPost('/api/mcp/servers', server)
        ok(`Registered MCP: ${server.name}`)
      } catch {
        warn(`${server.name} already registered or failed`)
      }
    }
  } else {
    ok('MCP servers will be registered when API server starts')
  }

  // ── Step 7: Summary ────────────────────────────────────────────────────────
  header(`[${step++}/${total}] Setup complete!`)
  divider()

  console.log(`\n${c.bold}${c.green}  ClaudeForge is ready! 🚀${c.reset}\n`)
  console.log(`${c.bold}  Start the platform:${c.reset}`)
  console.log(`${c.cyan}    npm start${c.reset}            ${c.dim}# Start everything → http://localhost:3000${c.reset}`)
  console.log(`${c.cyan}    npm run dev${c.reset}           ${c.dim}# Dev mode (API + Web hot-reload)${c.reset}`)
  console.log(`\n${c.bold}  Or use the shell script:${c.reset}`)
  console.log(`${c.cyan}    ./start.sh${c.reset}            ${c.dim}# One-click start${c.reset}`)
  console.log(`\n${c.bold}  Or run with Docker:${c.reset}`)
  console.log(`${c.cyan}    docker compose up${c.reset}     ${c.dim}# Runs in a container${c.reset}`)
  console.log(`\n${c.dim}  Docs: README.md  |  Config: .env  |  DB: data/claude-forge.db${c.reset}`)
  divider()
  console.log()
}

main().catch((e) => {
  err(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
