import type { GuildId, RoomId, UserId } from "@room-manager/shared";

/**
 * Redis key conventions.
 *
 * Pattern: {domain}:{id}[:{subdomain}]
 *
 * TTL guidelines:
 * - Guild config: 5 min (hot path, invalidated on write)
 * - Room state: until changed (invalidated on state transition)
 * - Cooldowns: remaining TTL = creationCooldownSeconds
 * - Mutes/Whitelist: until changed (invalidated on add/remove)
 */

export const Key = {
  /** Guild configuration cache. TTL: 300s */
  guildConfig: (guildId: GuildId) => `guild:${guildId}:config`,

  /** Room active state. TTL: none (explicitly deleted) */
  roomState: (roomId: RoomId) => `room:${roomId}:state`,

  /** Room mute set. TTL: none (explicitly deleted) */
  roomMutes: (roomId: RoomId) => `room:${roomId}:mutes`,

  /** Room whitelist set. TTL: none (explicitly deleted) */
  roomWhitelist: (roomId: RoomId) => `room:${roomId}:whitelist`,

  /** Guild creation cooldown. TTL: creationCooldownSeconds */
  guildCooldown: (guildId: GuildId) => `cooldown:${guildId}`,

  /** Emoji cache by content hash. TTL: 86400s */
  emojiCache: (hash: string) => `emoji:cache:${hash}`,

  /** Generic pattern for custom TTLs */
  custom: (key: string) => key,
} as const;

export const TTL = {
  GUILD_CONFIG: 300,
  EMOJI_CACHE: 86_400,
} as const;
