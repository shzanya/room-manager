#!/bin/sh
set -e

if [ "$ENABLE_SHARDING" = "true" ] || [ "$SHARDING" = "true" ]; then
  echo "[entrypoint] Starting bot with sharding..."
  exec node --import tsx src/shard.ts
else
  echo "[entrypoint] Starting bot..."
  exec node --import tsx src/index.ts
fi
