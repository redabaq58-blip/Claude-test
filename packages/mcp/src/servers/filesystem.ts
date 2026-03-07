import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs'
import { resolve, join, relative } from 'path'
import type { Tool } from '@claudeforge/core'

// ─── Filesystem MCP Server ────────────────────────────────────────────────────
// Provides file read/write/search tools to Claude agents.
// Restricts access to allowed paths for safety.

export interface FilesystemServerOptions {
  allowedPaths?: string[]  // Directories agent can access (default: cwd)
  maxFileSize?: number     // Max file size in bytes (default: 1MB)
  maxResults?: number      // Max search results (default: 50)
}

export function createFilesystemTools(options: FilesystemServerOptions = {}): Tool[] {
  const allowedPaths = (options.allowedPaths ?? [process.cwd()]).map((p) => resolve(p))
  const maxFileSize = options.maxFileSize ?? 1_048_576 // 1MB
  const maxResults = options.maxResults ?? 50

  function assertAllowed(filePath: string): string {
    const resolved = resolve(filePath)
    const isAllowed = allowedPaths.some((allowed) => resolved.startsWith(allowed))
    if (!isAllowed) {
      throw new Error(
        `Access denied: "${filePath}" is outside allowed paths. Allowed: ${allowedPaths.join(', ')}`
      )
    }
    return resolved
  }

  return [
    {
      definition: {
        name: 'read_file',
        description: 'Read the contents of a file',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the file to read' },
            encoding: {
              type: 'string',
              description: 'File encoding (default: utf-8)',
              enum: ['utf-8', 'base64'],
            },
          },
          required: ['path'],
        },
      },
      handler: async ({ path, encoding = 'utf-8' }) => {
        const resolved = assertAllowed(path as string)
        if (!existsSync(resolved)) throw new Error(`File not found: ${path}`)
        const stat = statSync(resolved)
        if (stat.size > maxFileSize) throw new Error(`File too large: ${stat.size} bytes (max ${maxFileSize})`)
        return readFileSync(resolved, encoding as BufferEncoding)
      },
    },

    {
      definition: {
        name: 'write_file',
        description: 'Write content to a file (creates directories if needed)',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to write to' },
            content: { type: 'string', description: 'Content to write' },
          },
          required: ['path', 'content'],
        },
      },
      handler: async ({ path, content }) => {
        const resolved = assertAllowed(path as string)
        const dir = resolve(resolved, '..')
        mkdirSync(dir, { recursive: true })
        writeFileSync(resolved, content as string, 'utf-8')
        return { success: true, path: resolved, bytes: (content as string).length }
      },
    },

    {
      definition: {
        name: 'list_directory',
        description: 'List files and directories in a path',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path to list' },
            recursive: { type: 'boolean', description: 'List recursively (default: false)' },
          },
          required: ['path'],
        },
      },
      handler: async ({ path, recursive = false }) => {
        const resolved = assertAllowed(path as string)
        if (!existsSync(resolved)) throw new Error(`Directory not found: ${path}`)

        function listDir(dir: string, depth = 0): string[] {
          if (depth > 5) return [] // Max depth for recursive
          const entries = readdirSync(dir, { withFileTypes: true })
          const results: string[] = []
          for (const entry of entries) {
            const fullPath = join(dir, entry.name)
            const rel = relative(resolved, fullPath)
            results.push(`${entry.isDirectory() ? '[DIR]' : '[FILE]'} ${rel}`)
            if (recursive && entry.isDirectory()) {
              results.push(...listDir(fullPath, depth + 1))
            }
          }
          return results
        }

        const entries = listDir(resolved)
        return entries.slice(0, maxResults).join('\n')
      },
    },

    {
      definition: {
        name: 'search_files',
        description: 'Search for text patterns in files within a directory',
        input_schema: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Directory to search in' },
            pattern: { type: 'string', description: 'Text pattern to search for' },
            fileExtension: { type: 'string', description: 'Filter by extension (e.g. .ts, .py)' },
          },
          required: ['directory', 'pattern'],
        },
      },
      handler: async ({ directory, pattern, fileExtension }) => {
        const resolved = assertAllowed(directory as string)
        const results: string[] = []
        const regex = new RegExp(pattern as string, 'gi')

        function searchDir(dir: string) {
          if (results.length >= maxResults) return
          const entries = readdirSync(dir, { withFileTypes: true })
          for (const entry of entries) {
            if (results.length >= maxResults) break
            const fullPath = join(dir, entry.name)
            if (entry.isDirectory()) {
              searchDir(fullPath)
            } else {
              if (fileExtension && !entry.name.endsWith(fileExtension as string)) continue
              try {
                const stat = statSync(fullPath)
                if (stat.size > maxFileSize) continue
                const content = readFileSync(fullPath, 'utf-8')
                const lines = content.split('\n')
                for (let i = 0; i < lines.length; i++) {
                  if (regex.test(lines[i])) {
                    results.push(`${relative(resolved, fullPath)}:${i + 1}: ${lines[i].trim()}`)
                  }
                }
              } catch {
                // Skip unreadable files
              }
            }
          }
        }

        searchDir(resolved)
        return results.length > 0
          ? results.join('\n')
          : `No matches found for "${pattern}"`
      },
    },
  ]
}
