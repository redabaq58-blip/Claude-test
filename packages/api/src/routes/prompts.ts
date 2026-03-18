import { Router } from 'express'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { resolve, join, basename, sep } from 'path'
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

// Resolve prompts dir relative to this source file's location:
//   Source:   packages/api/src/routes/  →  ../../../../prompts
//   Compiled: packages/api/dist/routes/ →  ../../../../prompts
// Both point to the repo-root prompts/ directory.
const PROMPTS_DIR = resolve(__dirname, '../../../../prompts')

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
  const promptPath = resolve(join(PROMPTS_DIR, req.params.category, `${req.params.id}.md`))
  // Path traversal guard: ensure the resolved path stays within PROMPTS_DIR
  if (!promptPath.startsWith(PROMPTS_DIR + sep) && promptPath !== PROMPTS_DIR) {
    return fail(res, 'Prompt not found', 404)
  }
  if (!existsSync(promptPath)) return fail(res, 'Prompt not found', 404)

  try {
    const prompt = parsePromptFile(promptPath, req.params.category)
    ok(res, prompt)
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Failed to parse prompt', 500)
  }
})

// POST /api/prompts/enhance — use Claude Haiku to improve a prompt
promptsRouter.post('/enhance', async (req, res) => {
  const { prompt, context, style } = req.body
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return fail(res, 'prompt is required')
  }

  // Lazy import to avoid top-level issues
  const { ClaudeClient } = await import('@claudeforge/core')
  const client = new ClaudeClient()

  const styleGuide =
    style === 'concise'
      ? 'Make the enhanced prompt more concise and direct.'
      : style === 'structured'
      ? 'Structure the enhanced prompt with clear sections or steps.'
      : 'Make the enhanced prompt detailed, specific, and effective.'

  const systemPrompt = `You are a prompt engineering expert. Your job is to improve user-provided prompts to get dramatically better results from Claude.

Rules:
1. Preserve the user's original intent completely
2. Add specificity, context, and clarity where missing
3. Include output format guidance if helpful (e.g., "respond in bullet points", "provide a step-by-step breakdown")
4. Add role framing if it would help (e.g., "You are an expert...")
5. ${styleGuide}
6. NEVER change the core task — only enhance HOW it's expressed

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "enhanced": "<the improved prompt>",
  "improvements": ["<what you changed 1>", "<what you changed 2>", ...]
}`

  const userMessage = `Original prompt: "${prompt.trim()}"${context ? `\n\nContext about how this will be used: ${context}` : ''}`

  try {
    const response = await client.ask(userMessage, {
      model: 'claude-haiku-4-5-20251001',
      systemPrompt,
      maxTokens: 1024,
    })

    // Strip markdown code fences if present
    const cleaned = response.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const parsed = JSON.parse(cleaned) as { enhanced: string; improvements: string[] }

    ok(res, {
      original: prompt.trim(),
      enhanced: parsed.enhanced,
      improvements: parsed.improvements ?? [],
      model: 'claude-haiku-4-5-20251001',
    })
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Enhancement failed', 500)
  }
})
