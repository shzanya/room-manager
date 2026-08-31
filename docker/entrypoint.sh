#!/bin/sh
set -e

echo "[entrypoint] Starting bot..."
exec node --import tsx src/shard.ts
