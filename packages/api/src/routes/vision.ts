import { Router } from 'express'
import { db, schema } from '../db/index.js'
import { ok, fail } from '../middleware/response.js'
import { ClaudeClient } from '@claudeforge/core'
import type { ClaudeModel } from '@claudeforge/core'
import { eq } from 'drizzle-orm'

export const visionRouter = Router()

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type AllowedMime = typeof ALLOWED_MIME_TYPES[number]

// POST /api/vision/analyze — analyze an image with an agent or the default client
// Body: { imageBase64: string, mimeType: string, prompt: string, agentId?: string }
visionRouter.post('/analyze', async (req, res) => {
  const { imageBase64, mimeType, prompt, agentId } = req.body

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return fail(res, 'imageBase64 is required')
  }
  if (!prompt || typeof prompt !== 'string') {
    return fail(res, 'prompt is required')
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMime)) {
    return fail(res, `mimeType must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`)
  }

  // Validate base64 size (roughly: 4/3 * actual bytes; 5MB limit)
  const estimatedBytes = Math.ceil(imageBase64.length * 0.75)
  if (estimatedBytes > 5 * 1024 * 1024) {
    return fail(res, 'Image too large (max 5MB)')
  }

  try {
    let model: ClaudeModel | 'auto' = 'auto'
    let systemPrompt: string | undefined

    if (agentId) {
      const [agentRow] = await db.select().from(schema.agents).where(eq(schema.agents.id, agentId))
      if (!agentRow) return fail(res, 'Agent not found', 404)
      model = (agentRow.model ?? 'auto') as ClaudeModel | 'auto'
      systemPrompt = agentRow.systemPrompt ?? undefined
    }

    const client = new ClaudeClient()
    const output = await client.askWithImage(imageBase64, mimeType as AllowedMime, prompt, {
      model,
      systemPrompt,
    })

    ok(res, { output })
  } catch (err) {
    fail(res, err instanceof Error ? err.message : 'Vision analysis failed', 500)
  }
})
