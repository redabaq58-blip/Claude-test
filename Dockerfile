# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

# Install Python + build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests first for layer caching
COPY package*.json turbo.json tsconfig.base.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/agents/package*.json ./packages/agents/
COPY packages/mcp/package*.json ./packages/mcp/
COPY packages/api/package*.json ./packages/api/
COPY apps/web/package*.json ./apps/web/

RUN npm install

# Copy source and build everything
COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only what's needed to run
COPY package*.json turbo.json tsconfig.base.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/agents/package*.json ./packages/agents/
COPY packages/mcp/package*.json ./packages/mcp/
COPY packages/api/package*.json ./packages/api/
COPY apps/web/package*.json ./apps/web/

RUN npm install --omit=dev

# Copy compiled output and web dist from builder
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/agents/dist ./packages/agents/dist
COPY --from=builder /app/packages/mcp/dist ./packages/mcp/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Persistent data directory (use Railway Volumes for persistence)
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "packages/api/dist/server.js"]
