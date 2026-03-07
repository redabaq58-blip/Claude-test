import type { Tool } from '@claudeforge/core'

// ─── Web MCP Server ───────────────────────────────────────────────────────────
// Provides web fetch and search tools to Claude agents.

export interface WebServerOptions {
  maxResponseSize?: number  // Max response bytes (default: 500KB)
  timeoutMs?: number        // Request timeout (default: 10s)
  userAgent?: string
}

export function createWebTools(options: WebServerOptions = {}): Tool[] {
  const maxResponseSize = options.maxResponseSize ?? 512_000
  const timeoutMs = options.timeoutMs ?? 10_000
  const userAgent = options.userAgent ?? 'ClaudeForge-Agent/1.0'

  return [
    {
      definition: {
        name: 'fetch_url',
        description: 'Fetch content from a URL and return it as text',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to fetch' },
            method: {
              type: 'string',
              description: 'HTTP method (default: GET)',
              enum: ['GET', 'POST', 'PUT'],
            },
            headers: {
              type: 'object',
              description: 'Optional HTTP headers',
            },
            body: {
              type: 'string',
              description: 'Request body (for POST/PUT)',
            },
          },
          required: ['url'],
        },
      },
      handler: async ({ url, method = 'GET', headers = {}, body }) => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), timeoutMs)

        try {
          const response = await fetch(url as string, {
            method: method as string,
            headers: {
              'User-Agent': userAgent,
              ...(headers as Record<string, string>),
            },
            body: body as string | undefined,
            signal: controller.signal,
          })

          clearTimeout(timeout)

          const text = await response.text()
          const truncated = text.length > maxResponseSize
          const content = truncated ? text.slice(0, maxResponseSize) + '\n\n[... truncated]' : text

          return {
            url: url as string,
            status: response.status,
            statusText: response.statusText,
            content,
            truncated,
            contentType: response.headers.get('content-type') ?? 'unknown',
          }
        } catch (err) {
          clearTimeout(timeout)
          throw new Error(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      },
    },

    {
      definition: {
        name: 'extract_links',
        description: 'Extract all links from an HTML page',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL of the page to extract links from' },
          },
          required: ['url'],
        },
      },
      handler: async ({ url }) => {
        const response = await fetch(url as string, {
          headers: { 'User-Agent': userAgent },
        })
        const html = await response.text()

        // Simple regex-based link extraction
        const linkRegex = /href=["']([^"']+)["']/gi
        const links: string[] = []
        let match

        while ((match = linkRegex.exec(html)) !== null) {
          const href = match[1]
          if (href.startsWith('http')) {
            links.push(href)
          } else if (href.startsWith('/')) {
            const base = new URL(url as string)
            links.push(`${base.origin}${href}`)
          }
        }

        const unique = [...new Set(links)].slice(0, 50)
        return unique
      },
    },

    {
      definition: {
        name: 'check_url',
        description: 'Check if a URL is accessible (HEAD request)',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to check' },
          },
          required: ['url'],
        },
      },
      handler: async ({ url }) => {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 5000)
          const response = await fetch(url as string, {
            method: 'HEAD',
            headers: { 'User-Agent': userAgent },
            signal: controller.signal,
          })
          clearTimeout(timeout)
          return {
            url: url as string,
            accessible: response.ok,
            status: response.status,
            statusText: response.statusText,
          }
        } catch {
          return { url: url as string, accessible: false, status: 0, statusText: 'Connection failed' }
        }
      },
    },
  ]
}
