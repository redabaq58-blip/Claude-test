import { Router } from 'express'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { resolve, join, basename, dirname } from 'path'
import { ok, fail } from '../middleware/response.js'

export const promptsRouter = Router()

// ─── Prompt file parser ───────────────────────────────────────────────────────
// Each prompt file has optional YAML-like frontmatter followed by content:
//
// title: My Prompt Title
// description: What this prompt does
// model: claude-sonnet-4-6
// tags: research, analysis
// ---
// The actual prompt content with {{variable}} placeholders...

interface Prompt {
  id: string
  title: string
  description: string
  category: string
  model: string
  tags: string[]
  content: string
  variables: string[]
}

function parsePromptFile(filePath: string, category: string): Prompt {
  const raw = readFileSync(filePath, 'utf-8')
  const lines = raw.split('\n')

  const meta: Record<string, string> = {}
  let contentStart = 0

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      contentStart = i + 1
      break
    }
    const colonIdx = lines[i].indexOf(':')
    if (colonIdx > 0) {
      const key = lines[i].slice(0, colonIdx).trim()
      const value = lines[i].slice(colonIdx + 1).trim()
      meta[key] = value
    }
  }

  const content = lines.slice(contentStart).join('\n').trim()

  // Extract {{variable}} placeholders
  const variables = [...new Set([...content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))]

  const filename = basename(filePath, '.md')

  return {
    id: `${category}/${filename}`,
    title: meta.title ?? filename.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: meta.description ?? '',
    category,
    model: meta.model ?? 'claude-sonnet-4-6',
    tags: meta.tags ? meta.tags.split(',').map((t: string) => t.trim()) : [category],
    content,
    variables,
  }
}

const PROMPTS_DIR = resolve(process.cwd(), '../../prompts')

function loadAllPrompts(): Prompt[] {
  if (!existsSync(PROMPTS_DIR)) return []

  const prompts: Prompt[] = []
  const categories = readdirSync(PROMPTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)

  for (const category of categories) {
    const catDir = join(PROMPTS_DIR, category)
    const files = readdirSync(catDir).filter((f) => f.endsWith('.md'))
    for (const file of files) {
      try {
        prompts.push(parsePromptFile(join(catDir, file), category))
      } catch {
        // Skip malformed prompt files
      }
    }
  }

  return prompts
}

// GET /api/prompts — list all prompts
promptsRouter.get('/', (_req, res) => {
  const prompts = loadAllPrompts()
  ok(res, prompts)
})

// GET /api/prompts/category/:category — prompts by category
promptsRouter.get('/category/:category', (req, res) => {
  const prompts = loadAllPrompts().filter((p) => p.category === req.params.category)
  ok(res, prompts)
})

// GET /api/prompts/:category/:id — get single prompt
promptsRouter.get('/:category/:id', (req, res) => {
  const promptPath = join(PROMPTS_DIR, req.params.category, `${req.params.id}.md`)
  if (!existsSync(promptPath)) return fail(res, 'Prompt not found', 404)

  try {
    const prompt = parsePromptFile(promptPath, req.params.category)
    ok(res, prompt)
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to parse prompt', 500)
  }
})
