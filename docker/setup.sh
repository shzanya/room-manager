#!/bin/bash
# ── Room Manager — First-time Setup ──────────────────────────────
set -euo pipefail

echo "╔══════════════════════════════════════════════════╗"
echo "║       Room Manager — Docker Setup               ║"
echo "╚══════════════════════════════════════════════════╝"

# ── Check .env ────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "→ Creating .env from .env.docker..."
  cp .env.docker .env
  echo "⚠  Edit .env and fill in DISCORD_TOKEN and DISCORD_CLIENT_ID"
  echo "   Then run this script again."
  exit 0
fi

# ── Check required vars ──────────────────────────────────────────
source .env
if [ -z "${DISCORD_TOKEN:-}" ] || [ -z "${DISCORD_CLIENT_ID:-}" ]; then
  echo "⚠  DISCORD_TOKEN or DISCORD_CLIENT_ID is missing in .env"
  exit 1
fi

echo "→ Building bot image..."
docker compose build --no-cache bot

echo "→ Starting stack..."
docker compose up -d

echo "→ Waiting for PostgreSQL..."
sleep 5

echo "→ Running migrations..."
docker compose exec bot bun run db:migrate || echo "⚠  Migration skipped (no changes or DB not ready)"

echo "→ Status:"
docker compose ps

echo ""
echo "✅ Stack is running!"
echo "   Bot:      http://localhost:${BOT_PORT:-9090}/health"
echo "   Nginx:    http://localhost:${NGINX_PORT:-80}/nginx-health"
echo "   Postgres: localhost:${POSTGRES_PORT:-5432}"
echo "   Redis:    localhost:${REDIS_PORT:-6379}"
