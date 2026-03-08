import { readFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'

// ─── Skill Types ─────────────────────────────────────────────────────────────

export interface SkillMetadata {
  name: string
  version: string
  description: string
  author?: string
  tags?: string[]
}

export interface Skill {
  metadata: SkillMetadata
  instructions: string
  systemPromptAddition: string
  resources: Record<string, string> // filename → content
}

// ─── SKILL.md Parser ─────────────────────────────────────────────────────────
// Parses SKILL.md files following the ClaudeForge skill format.
//
// SKILL.md format:
//   # Skill Name
//   version: 1.0.0
//   description: ...
//   tags: tag1, tag2
//   ---
//   ## Instructions
//   ...
//   ## System Prompt Addition
//   ...

export function parseSkillMd(content: string): Skill {
  const lines = content.split('\n')
  const metadata: Partial<SkillMetadata> = {}
  const sections: Record<string, string[]> = {}
  let currentSection = ''
  let inFrontmatter = false
  let frontmatterDone = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Title line
    if (i === 0 && line.startsWith('# ')) {
      metadata.name = line.slice(2).trim()
      continue
    }

    // Frontmatter key-value pairs (before ---)
    if (!frontmatterDone && line.includes(':') && !line.startsWith('#')) {
      const [key, ...rest] = line.split(':')
      const value = rest.join(':').trim()
      if (key.trim() === 'version') metadata.version = value
      if (key.trim() === 'description') metadata.description = value
      if (key.trim() === 'author') metadata.author = value
      if (key.trim() === 'tags') metadata.tags = value.split(',').map((t) => t.trim())
      continue
    }

    if (line.trim() === '---') {
      frontmatterDone = true
      continue
    }

    // Section headers
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim()
      sections[currentSection] = []
      continue
    }

    if (currentSection) {
      sections[currentSection].push(line)
    }
  }

  return {
    metadata: {
      name: metadata.name ?? 'Unknown Skill',
      version: metadata.version ?? '1.0.0',
      description: metadata.description ?? '',
      author: metadata.author,
      tags: metadata.tags ?? [],
    },
    instructions: (sections['Instructions'] ?? []).join('\n').trim(),
    systemPromptAddition: (sections['System Prompt Addition'] ?? []).join('\n').trim(),
    resources: {},
  }
}

// ─── Skill Loader ─────────────────────────────────────────────────────────────

export function loadSkill(skillPath: string): Skill {
  const skillFile = existsSync(join(skillPath, 'SKILL.md'))
    ? join(skillPath, 'SKILL.md')
    : skillPath

  if (!existsSync(skillFile)) {
    throw new Error(`Skill file not found: ${skillFile}`)
  }

  const content = readFileSync(skillFile, 'utf-8')
  const skill = parseSkillMd(content)

  return skill
}

// ─── Skill Registry ───────────────────────────────────────────────────────────

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map()

  register(skill: Skill): this {
    this.skills.set(skill.metadata.name, skill)
    return this
  }

  load(skillPath: string): this {
    const skill = loadSkill(skillPath)
    this.skills.set(skill.metadata.name, skill)
    return this
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  list(): Skill[] {
    return Array.from(this.skills.values())
  }

  // Build combined system prompt from all registered skills
  buildSystemPrompt(basePrompt: string = ''): string {
    const additions = Array.from(this.skills.values())
      .filter((s) => s.systemPromptAddition)
      .map((s) => `## ${s.metadata.name} Skill\n${s.systemPromptAddition}`)
      .join('\n\n')

    return additions ? `${basePrompt}\n\n${additions}`.trim() : basePrompt
  }
}
