import type { StreamChunk } from './types.js'

// ─── Stream Utilities ────────────────────────────────────────────────────────

// Collect all text chunks from a stream into a single string
export async function collectStream(
  stream: AsyncGenerator<StreamChunk>
): Promise<string> {
  let result = ''
  for await (const chunk of stream) {
    if (chunk.type === 'text' && chunk.text) {
      result += chunk.text
    }
  }
  return result
}

// Pipe a stream to stdout (useful for CLI)
export async function pipeStreamToStdout(
  stream: AsyncGenerator<StreamChunk>
): Promise<string> {
  let result = ''
  for await (const chunk of stream) {
    if (chunk.type === 'text' && chunk.text) {
      process.stdout.write(chunk.text)
      result += chunk.text
    }
  }
  process.stdout.write('\n')
  return result
}

// Convert a stream to an SSE string for HTTP response
export async function* streamToSSE(
  stream: AsyncGenerator<StreamChunk>
): AsyncGenerator<string> {
  for await (const chunk of stream) {
    yield `data: ${JSON.stringify(chunk)}\n\n`
    if (chunk.type === 'done') break
  }
}
