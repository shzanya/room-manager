import type { GuildConfig } from "@room-manager/contracts";
import type { GuildId, RoomId, UserId } from "@room-manager/shared";
import type { RedisClient } from "bun";

import { Key, TTL } from "./keys";

export class CacheService {
  public constructor(private readonly redis: RedisClient) {}

  public async getGuildConfig(guildId: GuildId): Promise<GuildConfig | null> {
    const raw = await this.redis.get(Key.guildConfig(guildId));
    return raw ? (JSON.parse(raw) as GuildConfig) : null;
  }

  public async setGuildConfig(guildId: GuildId, config: GuildConfig): Promise<void> {
    await this.redis.setex(Key.guildConfig(guildId), TTL.GUILD_CONFIG, JSON.stringify(config));
  }

  public async invalidateGuildConfig(guildId: GuildId): Promise<void> {
    await this.redis.del(Key.guildConfig(guildId));
  }

  public async getRoomState(roomId: RoomId): Promise<"active" | "cooldown" | "deleting" | null> {
    return (await this.redis.get(Key.roomState(roomId))) as
      | "active"
      | "cooldown"
      | "deleting"
      | null;
  }

  public async setRoomState(
    roomId: RoomId,
    state: "active" | "cooldown" | "deleting",
  ): Promise<void> {
    await this.redis.set(Key.roomState(roomId), state);
  }

  public async invalidateRoomState(roomId: RoomId): Promise<void> {
    await this.redis.del(Key.roomState(roomId));
  }

  public async addMute(roomId: RoomId, userId: UserId): Promise<void> {
    await this.redis.sadd(Key.roomMutes(roomId), userId);
  }

  public async removeMute(roomId: RoomId, userId: UserId): Promise<boolean> {
    return (await this.redis.srem(Key.roomMutes(roomId), userId)) > 0;
  }

  public async isMuted(roomId: RoomId, userId: UserId): Promise<boolean> {
    return this.redis.sismember(Key.roomMutes(roomId), userId);
  }

  public async listMutes(roomId: RoomId): Promise<UserId[]> {
    const members = await this.redis.smembers(Key.roomMutes(roomId));
    return members.map((m) => m as UserId);
  }

  public async clearMutes(roomId: RoomId): Promise<void> {
    await this.redis.del(Key.roomMutes(roomId));
  }

  public async addWhitelist(roomId: RoomId, userId: UserId): Promise<void> {
    await this.redis.sadd(Key.roomWhitelist(roomId), userId);
  }

  public async removeWhitelist(roomId: RoomId, userId: UserId): Promise<boolean> {
    return (await this.redis.srem(Key.roomWhitelist(roomId), userId)) > 0;
  }

  public async listWhitelist(roomId: RoomId): Promise<UserId[]> {
    const members = await this.redis.smembers(Key.roomWhitelist(roomId));
    return members.map((m) => m as UserId);
  }

  public async clearWhitelist(roomId: RoomId): Promise<void> {
    await this.redis.del(Key.roomWhitelist(roomId));
  }

  public async isOnCooldown(guildId: GuildId): Promise<boolean> {
    const ttl = await this.redis.ttl(Key.guildCooldown(guildId));
    return ttl > 0;
  }

  public async setCooldown(guildId: GuildId, durationSeconds: number): Promise<void> {
    if (durationSeconds <= 0) {
      return;
    }
    await this.redis.setex(Key.guildCooldown(guildId), durationSeconds, "1");
  }

  public async getCooldownTTL(guildId: GuildId): Promise<number> {
    const ttl = await this.redis.ttl(Key.guildCooldown(guildId));
    return Math.max(0, ttl);
  }

  public async getEmojiId(hash: string): Promise<string | null> {
    return this.redis.get(Key.emojiCache(hash));
  }

  public async setEmojiId(hash: string, emojiId: string): Promise<void> {
    await this.redis.setex(Key.emojiCache(hash), TTL.EMOJI_CACHE, emojiId);
  }

  public async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  public async flush(): Promise<void> {
    await this.redis.send("FLUSHDB", []);
  }
}
