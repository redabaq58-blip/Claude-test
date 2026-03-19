# ── Build stage ──────────────────────────────────────────────────────────────
# v1.0.1 — bump this label to force a clean Railway rebuild when needed
FROM node:22-slim AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package*.json turbo.json tsconfig.base.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/agents/package*.json ./packages/agents/
COPY packages/mcp/package*.json ./packages/mcp/
COPY packages/api/package*.json ./packages/api/
COPY packages/cli/package*.json ./packages/cli/
COPY apps/web/package*.json ./apps/web/

RUN npm ci

# Copy source and build everything (TypeScript + React)
COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

# Run as non-root for security
RUN addgroup --system app && adduser --system --ingroup app app

WORKDIR /app

# Copy only what's needed to run
COPY package*.json turbo.json tsconfig.base.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/agents/package*.json ./packages/agents/
COPY packages/mcp/package*.json ./packages/mcp/
COPY packages/api/package*.json ./packages/api/
COPY packages/cli/package*.json ./packages/cli/
COPY apps/web/package*.json ./apps/web/

RUN npm ci --omit=dev

# Copy compiled output and web dist from builder
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/agents/dist ./packages/agents/dist
COPY --from=builder /app/packages/mcp/dist ./packages/mcp/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Copy static asset directories served by the API at runtime
COPY --from=builder /app/prompts ./prompts
COPY --from=builder /app/skills ./skills

# Persistent data directory (use Railway Volumes / Docker volumes for persistence)
RUN mkdir -p /app/data && chown -R app:app /app/data

ENV NODE_ENV=production
ENV PORT=3000

USER app

EXPOSE 3000

CMD ["node", "packages/api/dist/server.js"]
