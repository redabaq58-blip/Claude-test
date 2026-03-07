import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ok, fail } from '../middleware/response.js'
import { MCPRegistry } from '@claudeforge/mcp'
import type { MCPServerType } from '@claudeforge/mcp'

export const mcpRouter = Router()

// GET /api/mcp/servers — list registered MCP servers
mcpRouter.get('/servers', async (_req, res) => {
  const rows = await db.select().from(schema.mcpServers)
  ok(res, rows)
})

// GET /api/mcp/servers/:id
mcpRouter.get('/servers/:id', async (req, res) => {
  const [server] = await db.select().from(schema.mcpServers).where(eq(schema.mcpServers.id, req.params.id))
  if (!server) return fail(res, 'MCP server not found', 404)
  ok(res, server)
})

// POST /api/mcp/servers — register a new MCP server
mcpRouter.post('/servers', async (req, res) => {
  const { name, type, config = {} } = req.body
  if (!name) return fail(res, 'name is required')
  if (!type) return fail(res, 'type is required')

  const validTypes = ['filesystem', 'web', 'git', 'database', 'code']
  if (!validTypes.includes(type)) {
    return fail(res, `type must be one of: ${validTypes.join(', ')}`)
  }

  // Test the server connection
  const registry = new MCPRegistry()
  let status = 'connected'
  let lastError: string | undefined
  let toolCount = 0

  try {
    registry.register(name, { type: type as MCPServerType, options: config })
    const server = registry.get(name)
    if (server?.status === 'error') {
      status = 'error'
      lastError = server.error
    } else {
      toolCount = registry.getTools(name).length
    }
  } catch (err) {
    status = 'error'
    lastError = err instanceof Error ? err.message : String(err)
  }

  const id = uuidv4()
  await db.insert(schema.mcpServers).values({
    id,
    name,
    type,
    config: JSON.stringify(config),
    status,
    lastError,
    toolCount,
  })

  const [created] = await db.select().from(schema.mcpServers).where(eq(schema.mcpServers.id, id))
  ok(res, created)
})

// POST /api/mcp/servers/:id/test — test connection
mcpRouter.post('/servers/:id/test', async (req, res) => {
  const [serverRow] = await db.select().from(schema.mcpServers).where(eq(schema.mcpServers.id, req.params.id))
  if (!serverRow) return fail(res, 'MCP server not found', 404)

  const config = JSON.parse(serverRow.config ?? '{}')
  const registry = new MCPRegistry()

  try {
    registry.register(serverRow.name, { type: serverRow.type as MCPServerType, options: config })
    const server = registry.get(serverRow.name)

    if (server?.status === 'error') {
      await db
        .update(schema.mcpServers)
        .set({ status: 'error', lastError: server.error })
        .where(eq(schema.mcpServers.id, req.params.id))
      return ok(res, { connected: false, error: server.error })
    }

    const tools = registry.getTools(serverRow.name)
    await db
      .update(schema.mcpServers)
      .set({ status: 'connected', lastError: null, toolCount: tools.length })
      .where(eq(schema.mcpServers.id, req.params.id))

    ok(res, {
      connected: true,
      toolCount: tools.length,
      tools: tools.map((t) => t.definition.name),
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    ok(res, { connected: false, error })
  }
})

// DELETE /api/mcp/servers/:id
mcpRouter.delete('/servers/:id', async (req, res) => {
  const [existing] = await db.select().from(schema.mcpServers).where(eq(schema.mcpServers.id, req.params.id))
  if (!existing) return fail(res, 'MCP server not found', 404)
  await db.delete(schema.mcpServers).where(eq(schema.mcpServers.id, req.params.id))
  ok(res, { deleted: true, id: req.params.id })
})
