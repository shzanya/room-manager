import type { ChannelId, GuildId, RoomId } from "@room-manager/shared";
import { Queue } from "bullmq";

import { createQueueConnection } from "../connection";

export interface RoomCleanupJobData {
  roomId: RoomId;
  guildId: GuildId;
  channelId: ChannelId;
}

const QUEUE_NAME = "room-cleanup";

export function createRoomCleanupQueue(): Queue<RoomCleanupJobData> {
  return new Queue<RoomCleanupJobData>(QUEUE_NAME, {
    connection: createQueueConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: 50,
    },
  });
}
