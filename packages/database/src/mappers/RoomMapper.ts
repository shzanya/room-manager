import type { Room } from "@room-manager/contracts";
import type { ChannelId, GuildId, RoomId, UserId } from "@room-manager/shared";

import type { rooms } from "../schema";

type RoomRow = typeof rooms.$inferSelect;

export function mapRoom(row: RoomRow): Room {
  return {
    id: row.id as RoomId,

    guildId: row.guildId as GuildId,
    channelId: row.channelId as ChannelId,
    ownerId: row.ownerId as UserId,

    name: row.name,
    userLimit: row.userLimit,

    state: row.state,
    locked: row.locked,
    hidden: row.hidden,

    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    lastActivityAt: new Date(row.lastActivityAt),
  };
}
