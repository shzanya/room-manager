/**
 * Per-room access whitelist (users granted Connect by the owner).
 * Process-lifetime cache.
 */
const byRoom = new Map<string, Set<string>>();

export const WhitelistRegistry = {
  add(roomId: string, userId: string): void {
    const set = byRoom.get(roomId) ?? new Set<string>();
    set.add(userId);
    byRoom.set(roomId, set);
  },

  remove(roomId: string, userId: string): boolean {
    return byRoom.get(roomId)?.delete(userId) ?? false;
  },

  list(roomId: string): string[] {
    return [...(byRoom.get(roomId) ?? [])];
  },
};
