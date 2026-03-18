import type { Request, Response, NextFunction } from 'express'

// ─── Bearer-token auth middleware ─────────────────────────────────────────────
// When API_SECRET is set, every request must include:
//   Authorization: Bearer <API_SECRET>
// If API_SECRET is not set the middleware is a no-op (open / local-only mode).

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.API_SECRET
  if (!secret) {
    // No secret configured — open mode (document this risk clearly in README/SECURITY.md)
    next()
    return
  }

  const authHeader = req.headers['authorization'] ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (token !== secret) {
    res.status(401).json({ data: null, error: 'Unauthorized: valid API_SECRET required' })
    return
  }

  next()
}
