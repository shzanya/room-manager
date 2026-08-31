#!/bin/bash
# ── Room Manager — Server First-Time Setup ────────────────────────
# Run this ONCE on your server as root:
#   bash <(curl -s raw.githubusercontent.com/shzanya/room-manager/main/scripts/server-setup.sh)
set -euo pipefail

echo "╔══════════════════════════════════════════════════╗"
echo "║   Room Manager — Server Setup                    ║"
echo "╚══════════════════════════════════════════════════╝"

DEPLOY_DIR="/root/room-manager"
REPO="https://github.com/shzanya/room-manager.git"

# ── Install Docker ────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo "→ Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  echo "✅ Docker installed"
else
  echo "✅ Docker already installed"
fi

# ── Install Docker Compose plugin ────────────────────────────────
if ! docker compose version &> /dev/null; then
  echo "→ Installing Docker Compose plugin..."
  apt-get update && apt-get install -y docker-compose-plugin
  echo "✅ Docker Compose installed"
else
  echo "✅ Docker Compose already installed"
fi

# ── Clone repo ────────────────────────────────────────────────────
if [ -d "$DEPLOY_DIR" ]; then
  echo "→ Updating existing repo..."
  cd "$DEPLOY_DIR"
  git pull origin main
else
  echo "→ Cloning repo..."
  git clone "$REPO" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi

# ── Setup .env ────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.docker .env
  echo ""
  echo "⚠  EDIT .env with your tokens:"
  echo "   nano $DEPLOY_DIR/.env"
  echo ""
  echo "   Required:"
  echo "     DISCORD_TOKEN=your_bot_token"
  echo "     DISCORD_CLIENT_ID=your_client_id"
  echo ""
  echo "   Then run:"
  echo "     cd $DEPLOY_DIR && make deploy"
  exit 0
fi

# ── Build and start ───────────────────────────────────────────────
echo "→ Building and starting..."
make deploy

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Server is ready!"
echo ""
echo "  Bot:     http://localhost:9090/health"
echo "  Nginx:   http://localhost:80/nginx-health"
echo "  Postgres: localhost:5432"
echo "  Redis:   localhost:6379"
echo ""
echo "  Auto-deploy is now active."
echo "  Push to main → bot updates automatically."
echo "═══════════════════════════════════════════════════"
