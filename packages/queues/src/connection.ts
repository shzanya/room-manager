import { loadEnv } from "@room-manager/config";
import Redis from "ioredis";

let queueConnection: Redis | null = null;
let workerConnection: Redis | null = null;

function createConnection(): Redis {
  const env = loadEnv();
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      if (times > 10) return null;
      return Math.min(times * 200, 5000);
    },
  });
}

/** Connection for adding jobs to queues. */
export function createQueueConnection(): Redis {
  if (!queueConnection) {
    queueConnection = createConnection();
  }
  return queueConnection;
}

/** Connection for BullMQ workers (must be separate from queue connection). */
export function createWorkerConnection(): Redis {
  if (!workerConnection) {
    workerConnection = createConnection();
  }
  return workerConnection;
}

export async function closeQueueConnection(): Promise<void> {
  const promises: Promise<void>[] = [];
  if (queueConnection) {
    promises.push(queueConnection.quit().then(() => { queueConnection = null; }));
  }
  if (workerConnection) {
    promises.push(workerConnection.quit().then(() => { workerConnection = null; }));
  }
  await Promise.all(promises);
}
