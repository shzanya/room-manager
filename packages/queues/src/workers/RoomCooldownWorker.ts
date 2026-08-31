import type { GuildId } from "@room-manager/shared";
import { Worker } from "bullmq";

import { createWorkerConnection } from "../connection";

export interface RoomCooldownJobData {
  guildId: GuildId;
}

export interface RoomCooldownWorkerDeps {
  logger: { info: (msg: string) => void; error: (msg: string, err?: unknown) => void };
  onCooldownExpired: (guildId: GuildId) => Promise<void>;
}

const QUEUE_NAME = "room-cooldown";

export function createRoomCooldownWorker(
  deps: RoomCooldownWorkerDeps,
): Worker<RoomCooldownJobData> {
  return new Worker<RoomCooldownJobData>(
    QUEUE_NAME,
    async (job) => {
      deps.logger.info(`Processing cooldown job ${job.id} for guild ${job.data.guildId}`);

      await deps.onCooldownExpired(job.data.guildId);

      deps.logger.info(`Cooldown job ${job.id} completed for guild ${job.data.guildId}`);
    },
    {
      connection: createWorkerConnection(),
      concurrency: 10,
    },
  );
}
