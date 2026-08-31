#!/bin/bash
set -e

echo "=== Room Manager — Server Setup ==="

# 1. Check/install bun
if ! command -v bun &>/dev/null; then
  echo "[1/6] Installing bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
else
  echo "[1/6] bun already installed: $(bun --version)"
fi

# 2. Check/install node
if ! command -v node &>/dev/null; then
  echo "[2/6] Installing node via nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  . "$NVM_DIR/nvm.sh"
  nvm install 22
else
  echo "[2/6] node already installed: $(node --version)"
fi

# 3. Install dependencies
echo "[3/6] Installing dependencies..."
cd /root/room-manager
bun install --frozen-lockfile
bun add tsx

# 4. Start PostgreSQL + Redis
echo "[4/6] Starting infrastructure..."
docker compose -f docker-compose.infra.yml up -d
echo "Waiting for PostgreSQL..."
sleep 5

# 5. Create tables
echo "[5/6] Creating database tables..."
docker compose -f docker-compose.infra.yml exec -T postgres psql -U roommanager -d room_manager < packages/database/scripts/001_init.sql

# 6. Start bot
echo "[6/6] Starting bot..."
echo ""
echo "=== Setup complete! ==="
echo "Run the bot with:"
echo "  cd /root/room-manager"
echo "  bun run start"
