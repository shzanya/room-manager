#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
cd /app
npx drizzle-kit push

echo "[entrypoint] Starting bot..."
cd /app/apps/bot
exec node --import tsx src/shard.ts
