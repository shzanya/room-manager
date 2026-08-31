import { loadEnv } from "@room-manager/config";
import type { Logger } from "@room-manager/logger";
import { RedisClient } from "bun";

let client: RedisClient | null = null;

export function createRedisClient(logger: Logger): RedisClient {
  if (client) {
    return client;
  }

  const env = loadEnv();

  client = new RedisClient(env.REDIS_URL, {
    connectionTimeout: 10_000,
    autoReconnect: true,
    maxRetries: 20,
    enableOfflineQueue: true,
    enableAutoPipelining: true,
  });

  client.onconnect = () => {
    logger.info("Redis connected");
  };

  client.onclose = (err) => {
    if (err) {
      logger.error(`Redis connection closed: ${err.message ?? err}`);
    } else {
      logger.warn("Redis connection closed");
    }
  };

  return client;
}

export function getRedisClient(): RedisClient {
  if (!client) {
    throw new Error("Redis client not initialized. Call createRedisClient first.");
  }
  return client;
}

export function closeRedis(): void {
  if (client) {
    client.close();
    client = null;
  }
}
