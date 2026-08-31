import type { RoomWhitelistRepository } from "@room-manager/database";
import type { RoomId, UserId } from "@room-manager/shared";

/**
 * PG-backed per-room whitelist.
 */
export function createWhitelistRegistry(repo: RoomWhitelistRepository) {
  return {
    async add(roomId: RoomId, userId: UserId): Promise<void> {
      await repo.add(roomId, userId);
    },

    async remove(roomId: RoomId, userId: UserId): Promise<boolean> {
      return repo.remove(roomId, userId);
    },

    async list(roomId: RoomId): Promise<UserId[]> {
      return repo.list(roomId);
    },

    async clear(roomId: RoomId): Promise<void> {
      await repo.deleteByRoom(roomId);
    },
  };
}

export type WhitelistRegistry = ReturnType<typeof createWhitelistRegistry>;
