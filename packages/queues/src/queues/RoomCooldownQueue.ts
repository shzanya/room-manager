import type { GuildId } from "@room-manager/shared";
import { Queue } from "bullmq";

import { createQueueConnection } from "../connection";

export interface RoomCooldownJobData {
  guildId: GuildId;
}

const QUEUE_NAME = "room-cooldown";

export function createRoomCooldownQueue(): Queue<RoomCooldownJobData> {
  return new Queue<RoomCooldownJobData>(QUEUE_NAME, {
    connection: createQueueConnection(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: 20,
    },
  });
}
