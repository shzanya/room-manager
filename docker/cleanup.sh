#!/bin/bash
# ── Room Manager — Cleanup ───────────────────────────────────────
set -euo pipefail

echo "⚠  This will remove all containers, volumes, and images."
read -p "Continue? [y/N] " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo "→ Stopping services..."
docker compose down -v --rmi local

echo "→ Pruning dangling images..."
docker image prune -f

echo "✅ Cleanup complete."
