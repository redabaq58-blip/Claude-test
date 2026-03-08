import type { Tool } from '@claudeforge/core'
import { createFilesystemTools } from './servers/filesystem.js'
import { createWebTools } from './servers/web.js'
import { createGitTools } from './servers/git.js'
import { createDatabaseTools } from './servers/database.js'
import { createCodeTools } from './servers/code.js'

// ─── Server Config Types ──────────────────────────────────────────────────────

export type MCPServerType = 'filesystem' | 'web' | 'git' | 'database' | 'code'

export interface MCPServerConfig {
  type: MCPServerType
  options?: Record<string, unknown>
}

export interface RegisteredServer {
  id: string
  name: string
  type: MCPServerType
  tools: Tool[]
  status: 'connected' | 'error'
  error?: string
  registeredAt: Date
}

// ─── MCP Registry ─────────────────────────────────────────────────────────────
// Central registry for MCP tool servers.
// Agents request tools from the registry by server name or type.

export class MCPRegistry {
  private servers: Map<string, RegisteredServer> = new Map()

  // ─── Register a server by config ──────────────────────────────────────────

  register(name: string, config: MCPServerConfig): this {
    try {
      const tools = this.buildTools(config)
      const server: RegisteredServer = {
        id: crypto.randomUUID(),
        name,
        type: config.type,
        tools,
        status: 'connected',
        registeredAt: new Date(),
      }
      this.servers.set(name, server)
    } catch (err) {
      const server: RegisteredServer = {
        id: crypto.randomUUID(),
        name,
        type: config.type,
        tools: [],
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        registeredAt: new Date(),
      }
      this.servers.set(name, server)
    }
    return this
  }

  private buildTools(config: MCPServerConfig): Tool[] {
    const opts = config.options ?? {}
    switch (config.type) {
      case 'filesystem':
        return createFilesystemTools(opts as Parameters<typeof createFilesystemTools>[0])
      case 'web':
        return createWebTools(opts as Parameters<typeof createWebTools>[0])
      case 'git':
        return createGitTools(opts as Parameters<typeof createGitTools>[0])
      case 'database':
        return createDatabaseTools(opts as unknown as Parameters<typeof createDatabaseTools>[0])
      case 'code':
        return createCodeTools(opts as Parameters<typeof createCodeTools>[0])
      default:
        throw new Error(`Unknown MCP server type: ${config.type}`)
    }
  }

  // ─── Get tools from a specific server ────────────────────────────────────

  getTools(serverName: string): Tool[] {
    const server = this.servers.get(serverName)
    if (!server) throw new Error(`MCP server not found: "${serverName}"`)
    if (server.status === 'error') throw new Error(`MCP server "${serverName}" has error: ${server.error}`)
    return server.tools
  }

  // ─── Get all tools from all connected servers ─────────────────────────────

  getAllTools(): Tool[] {
    return Array.from(this.servers.values())
      .filter((s) => s.status === 'connected')
      .flatMap((s) => s.tools)
  }

  // ─── List all servers ────────────────────────────────────────────────────

  list(): RegisteredServer[] {
    return Array.from(this.servers.values())
  }

  get(name: string): RegisteredServer | undefined {
    return this.servers.get(name)
  }

  remove(name: string): boolean {
    return this.servers.delete(name)
  }

  // ─── Quick setup helpers ─────────────────────────────────────────────────

  static withDefaults(repoPath?: string): MCPRegistry {
    const registry = new MCPRegistry()
    registry
      .register('filesystem', {
        type: 'filesystem',
        options: { allowedPaths: [repoPath ?? process.cwd()] },
      })
      .register('web', { type: 'web' })
      .register('git', { type: 'git', options: { repoPath: repoPath ?? process.cwd(), readonly: true } })
      .register('code', { type: 'code' })
    return registry
  }
}
