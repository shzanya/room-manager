import type { ChannelId, GuildId, RoomId, UserId } from "@room-manager/shared";

export const ROOM_STATES = ["active", "cooldown", "deleting"] as const;

export type RoomState = (typeof ROOM_STATES)[number];

export interface Room {
  id: RoomId;

  guildId: GuildId;
  channelId: ChannelId;
  ownerId: UserId;

  name: string;
  userLimit: number;

  state: RoomState;

  locked: boolean;

  hidden: boolean;

  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}
