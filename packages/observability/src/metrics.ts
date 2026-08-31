import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

export const register = new Registry();

// Default Node.js metrics (event loop lag, GC, memory, etc.)
collectDefaultMetrics({ register });

// ── Custom Metrics ──────────────────────────────────────────────────

export const roomCleanupDuration = new Histogram({
  name: "room_cleanup_duration_seconds",
  help: "Duration of room cleanup operations in seconds",
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const roomCleanupErrors = new Counter({
  name: "room_cleanup_errors_total",
  help: "Total number of room cleanup errors",
  labelNames: ["error_type"] as const,
  registers: [register],
});

export const roomsCreated = new Counter({
  name: "rooms_created_total",
  help: "Total number of rooms created",
  labelNames: ["guild_id"] as const,
  registers: [register],
});

export const roomsDeleted = new Counter({
  name: "rooms_deleted_total",
  help: "Total number of rooms deleted",
  labelNames: ["guild_id"] as const,
  registers: [register],
});

export const activeRooms = new Gauge({
  name: "rooms_active",
  help: "Number of currently active rooms",
  labelNames: ["guild_id"] as const,
  registers: [register],
});

export const redisOperationDuration = new Histogram({
  name: "redis_operation_duration_seconds",
  help: "Duration of Redis operations in seconds",
  labelNames: ["operation"] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [register],
});

export const dbQueryDuration = new Histogram({
  name: "db_query_duration_seconds",
  help: "Duration of database queries in seconds",
  labelNames: ["operation"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
  registers: [register],
});

export const interactionCounter = new Counter({
  name: "discord_interactions_total",
  help: "Total number of Discord interactions handled",
  labelNames: ["type", "command"] as const,
  registers: [register],
});

export const discordLatency = new Gauge({
  name: "discord_websocket_latency_ms",
  help: "Discord websocket latency in milliseconds",
  registers: [register],
});

export async function getMetrics(): Promise<string> {
  return register.metrics();
}

export async function getMetricsContentType(): Promise<string> {
  return register.contentType;
}
