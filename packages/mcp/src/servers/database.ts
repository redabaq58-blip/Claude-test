import type { Tool } from '@claudeforge/core'

// ─── Database MCP Server ──────────────────────────────────────────────────────
// Provides SQLite query tools to Claude agents.
// Requires 'better-sqlite3' to be installed in the consuming project.

export interface DatabaseServerOptions {
  dbPath: string
  readonly?: boolean
  maxRows?: number
}

export function createDatabaseTools(options: DatabaseServerOptions): Tool[] {
  const { dbPath, readonly = true, maxRows = 1000 } = options

  // Lazy-load better-sqlite3 so it's optional
  function getDb() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require('better-sqlite3')
      return new Database(dbPath, { readonly })
    } catch {
      throw new Error('better-sqlite3 is required for database tools. Run: npm install better-sqlite3')
    }
  }

  const tools: Tool[] = [
    {
      definition: {
        name: 'db_query',
        description: 'Execute a SQL SELECT query and return results',
        input_schema: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'SQL SELECT query to execute' },
            params: {
              type: 'array',
              items: {},
              description: 'Query parameters for prepared statements',
            },
          },
          required: ['sql'],
        },
      },
      handler: async ({ sql, params = [] }) => {
        const query = (sql as string).trim().toUpperCase()
        if (!query.startsWith('SELECT') && !query.startsWith('WITH')) {
          throw new Error('Only SELECT queries are allowed with db_query. Use db_execute for writes.')
        }
        const db = getDb()
        const stmt = db.prepare(sql as string)
        const rows = stmt.all(...(params as unknown[]))
        db.close()
        return {
          rows: rows.slice(0, maxRows),
          count: rows.length,
          truncated: rows.length > maxRows,
        }
      },
    },

    {
      definition: {
        name: 'db_schema',
        description: 'Get the schema of the database (tables, columns)',
        input_schema: {
          type: 'object',
          properties: {
            table: { type: 'string', description: 'Specific table name (optional — lists all if omitted)' },
          },
          required: [],
        },
      },
      handler: async ({ table }) => {
        const db = getDb()
        if (table) {
          const info = db.prepare(`PRAGMA table_info(${table})`).all()
          db.close()
          return info
        }
        const tables = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
          .all() as { name: string }[]
        const schema: Record<string, unknown[]> = {}
        for (const t of tables) {
          schema[t.name] = db.prepare(`PRAGMA table_info(${t.name})`).all()
        }
        db.close()
        return schema
      },
    },
  ]

  if (!readonly) {
    tools.push({
      definition: {
        name: 'db_execute',
        description: 'Execute a SQL write statement (INSERT, UPDATE, DELETE, CREATE)',
        input_schema: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'SQL statement to execute' },
            params: {
              type: 'array',
              items: {},
              description: 'Statement parameters',
            },
          },
          required: ['sql'],
        },
      },
      handler: async ({ sql, params = [] }) => {
        const db = getDb()
        const stmt = db.prepare(sql as string)
        const result = stmt.run(...(params as unknown[]))
        db.close()
        return { changes: result.changes, lastInsertRowid: result.lastInsertRowid }
      },
    })
  }

  return tools
}
