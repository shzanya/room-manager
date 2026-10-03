import type { GuildId, RoomId, } from "@room-manager/shared";

export const Key = {
  guildConfig: (guildId: GuildId) => `guild:${guildId}:config`,

  roomState: (roomId: RoomId) => `room:${roomId}:state`,

  roomMutes: (roomId: RoomId) => `room:${roomId}:mutes`,

  roomWhitelist: (roomId: RoomId) => `room:${roomId}:whitelist`,

  guildCooldown: (guildId: GuildId) => `cooldown:${guildId}`,

  emojiCache: (hash: string) => `emoji:cache:${hash}`,

  custom: (key: string) => key,
} as const;

export const TTL = {
  GUILD_CONFIG: 300,
  EMOJI_CACHE: 86_400,
} as const;
