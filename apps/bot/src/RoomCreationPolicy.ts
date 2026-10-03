import type { GuildCooldownRepository } from "@room-manager/database";
import type { GuildId } from "@room-manager/shared";

export function createRoomCreationPolicy(repo: GuildCooldownRepository) {
  return {
    async canCreate(guildId: GuildId): Promise<boolean> {
      const expiresAt = await repo.get(guildId);
      if (!expiresAt) return true;
      return new Date() > expiresAt;
    },

    async startCooldown(guildId: GuildId, durationSeconds: number): Promise<void> {
      if (durationSeconds <= 0) return;
      const expiresAt = new Date(Date.now() + durationSeconds * 1000);
      await repo.set(guildId, expiresAt);
    },

    async getRemainingTTL(guildId: GuildId): Promise<number> {
      const expiresAt = await repo.get(guildId);
      if (!expiresAt) return 0;
      return Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    },
  };
}

export type RoomCreationPolicy = ReturnType<typeof createRoomCreationPolicy>;
