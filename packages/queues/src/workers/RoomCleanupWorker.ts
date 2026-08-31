import type { ChannelId, GuildId, RoomId } from "@room-manager/shared";
import { Worker } from "bullmq";

import { createWorkerConnection } from "../connection";

export interface RoomCleanupJobData {
  roomId: RoomId;
  guildId: GuildId;
  channelId: ChannelId;
}

export interface RoomCleanupWorkerDeps {
  logger: { info: (msg: string) => void; error: (msg: string, err?: unknown) => void; warn: (msg: string) => void };
  onCleanup: (data: RoomCleanupJobData) => Promise<void>;
}

const QUEUE_NAME = "room-cleanup";

export function createRoomCleanupWorker(
  deps: RoomCleanupWorkerDeps,
): Worker<RoomCleanupJobData> {
  return new Worker<RoomCleanupJobData>(
    QUEUE_NAME,
    async (job) => {
      deps.logger.info(`Processing cleanup job ${job.id} for room ${job.data.roomId}`);

      await deps.onCleanup(job.data);

      deps.logger.info(`Cleanup job ${job.id} completed for room ${job.data.roomId}`);
    },
    {
      connection: createWorkerConnection(),
      concurrency: 5,
    },
  );
}
