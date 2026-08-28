/**
 * In-memory per-room mute bookkeeping (who is currently muted).
 * Process-lifetime cache — rooms are ephemeral anyway.
 */
const byRoom = new Map<string, Set<string>>();

export const MutesRegistry = {
  add(roomId: string, userId: string): void {
    const set = byRoom.get(roomId) ?? new Set<string>();
    set.add(userId);
    byRoom.set(roomId, set);
  },

  remove(roomId: string, userId: string): boolean {
    return byRoom.get(roomId)?.delete(userId) ?? false;
  },

  has(roomId: string, userId: string): boolean {
    return byRoom.get(roomId)?.has(userId) ?? false;
  },

  list(roomId: string): string[] {
    return [...(byRoom.get(roomId) ?? [])];
  },
};
