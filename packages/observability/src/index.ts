export {
  createStructuredLogger,
  getLogger,
  createChildLogger,
} from "./logger";

export {
  register,
  roomCleanupDuration,
  roomCleanupErrors,
  roomsCreated,
  roomsDeleted,
  activeRooms,
  redisOperationDuration,
  dbQueryDuration,
  interactionCounter,
  discordLatency,
  getMetrics,
  getMetricsContentType,
} from "./metrics";

export {
  startHealthServer,
  createHealthChecker,
  type HealthServerDeps,
} from "./health";
