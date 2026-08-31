FROM oven/bun:1.3.14-slim

WORKDIR /app

COPY package.json tsconfig.json ./
COPY apps/bot/package.json apps/bot/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/observability/package.json packages/observability/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/cache/package.json packages/cache/package.json
COPY packages/queues/package.json packages/queues/package.json

COPY apps/bot/src ./apps/bot/src
COPY apps/bot/assets ./apps/bot/assets
COPY packages/config ./packages/config
COPY packages/contracts ./packages/contracts
COPY packages/core ./packages/core
COPY packages/database ./packages/database
COPY packages/logger ./packages/logger
COPY packages/observability ./packages/observability
COPY packages/shared ./packages/shared
COPY packages/cache ./packages/cache
COPY packages/queues ./packages/queues

RUN bun install

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD bun -e "const r = await fetch('http://localhost:9090/health'); process.exit(r.ok ? 0 : 1)" || exit 1

EXPOSE 9090

WORKDIR /app/apps/bot

CMD ["bun", "run", "src/shard.ts"]
