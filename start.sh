#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  ClaudeForge — one-command startup
#  Usage:  ./start.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓  $1${NC}"; }
warn() { echo -e "${YELLOW}⚠  $1${NC}"; }
fail() { echo -e "${RED}✗  $1${NC}"; }
info() { echo -e "${CYAN}→  $1${NC}"; }

echo ""
echo -e "${BOLD}"
echo "   ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗"
echo "  ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝"
echo "  ██║     ██║     ███████║██║   ██║██║  ██║█████╗  "
echo "  ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝  "
echo "  ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗"
echo "   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝"
echo -e "${NC}${DIM}   The Ultimate Claude & Anthropic Agent Platform${NC}"
echo ""

# ── Check Node.js ─────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  fail "Node.js is not installed."
  echo ""
  echo "  Install Node.js from: https://nodejs.org  (version 22 or higher)"
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 22 ]; then
  fail "Node.js 22+ is required. You have $(node -v)."
  echo "  Update at: https://nodejs.org"
  exit 1
fi
ok "Node.js $(node -v) detected"

# ── Check / create .env ───────────────────────────────────────────────────────
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    warn "Created .env from .env.example"
  fi
fi

if [ ! -f .env ]; then
  fail ".env file not found and no .env.example to copy from."
  exit 1
fi

# Check API key is set and not the placeholder
API_KEY=$(grep -E '^ANTHROPIC_API_KEY=' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
if [ -z "$API_KEY" ] || [ "$API_KEY" = "sk-ant-..." ]; then
  fail "ANTHROPIC_API_KEY is not set in your .env file."
  echo ""
  echo -e "  ${BOLD}How to fix:${NC}"
  echo "  1. Open the file called  .env  in a text editor"
  echo "  2. Replace the line:  ANTHROPIC_API_KEY=sk-ant-..."
  echo "     with your real key: ANTHROPIC_API_KEY=sk-ant-api03-..."
  echo ""
  echo -e "  Get your API key at: ${CYAN}https://console.anthropic.com${NC}"
  echo ""
  exit 1
fi
ok "API key found (${API_KEY:0:12}...)"

# ── Install dependencies if needed ────────────────────────────────────────────
if [ ! -d node_modules ]; then
  info "Installing dependencies (first run only — may take 1-2 minutes)…"
  npm install --silent
  ok "Dependencies installed"
else
  ok "Dependencies already installed"
fi

# ── Build if needed ───────────────────────────────────────────────────────────
if [ ! -d packages/api/dist ]; then
  info "Building the app (first run only — may take 30 seconds)…"
  npm run build --silent
  ok "Build complete"
else
  ok "Build already up to date"
fi

# ── Ensure data directory exists ─────────────────────────────────────────────
mkdir -p data

# ── Start ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  Everything is ready! Starting ClaudeForge…${NC}"
echo ""
echo -e "  ${BOLD}Open your browser at:${NC} ${CYAN}http://localhost:3000${NC}"
echo -e "  ${DIM}Press Ctrl+C to stop${NC}"
echo ""

exec node packages/api/dist/server.js
