import type { Request, Response, NextFunction } from 'express'
import type { ApiResponse } from '@claudeforge/core'

// ─── Response helpers ─────────────────────────────────────────────────────────

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>): void {
  const body: ApiResponse<T> = { data, error: null, meta }
  res.json(body)
}

export function fail(res: Response, message: string, status = 400): void {
  const body: ApiResponse<null> = { data: null, error: message }
  res.status(status).json(body)
}

// ─── Error handler middleware ─────────────────────────────────────────────────

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[API Error]', err.message)
  fail(res, err.message, 500)
}

// ─── Not found handler ────────────────────────────────────────────────────────

export function notFound(_req: Request, res: Response): void {
  fail(res, 'Route not found', 404)
}
