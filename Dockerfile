FROM oven/bun:1.4-alpine AS deps

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
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

RUN bun install --frozen-lockfile

# tsx локально, чтобы node --import tsx находил пакет
RUN bun add tsx

# ── Runtime: Node.js + tsx (Bun Linux emitDecoratorMetadata bug) ──
FROM node:22-alpine

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/package.json ./
COPY --from=deps /app/tsconfig.json ./

ENV NODE_ENV=production

EXPOSE 9090

WORKDIR /app/apps/bot

CMD ["node", "--import", "tsx", "src/shard.ts"]
