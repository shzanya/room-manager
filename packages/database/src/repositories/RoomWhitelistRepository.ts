import type { UserId } from "@room-manager/shared";
import { and, eq } from "drizzle-orm";

import { db } from "../client";
import { roomWhitelists } from "../schema";

export class RoomWhitelistRepository {
  public async add(roomId: string, userId: UserId): Promise<void> {
    await db.insert(roomWhitelists).values({ roomId, userId }).onConflictDoNothing();
  }

  public async remove(roomId: string, userId: UserId): Promise<boolean> {
    const result = await db
      .delete(roomWhitelists)
      .where(and(eq(roomWhitelists.roomId, roomId), eq(roomWhitelists.userId, userId)))
      .returning({ userId: roomWhitelists.userId });

    return result.length > 0;
  }

  public async list(roomId: string): Promise<UserId[]> {
    const result = await db
      .select({ userId: roomWhitelists.userId })
      .from(roomWhitelists)
      .where(eq(roomWhitelists.roomId, roomId));

    return result.map((r) => r.userId as UserId);
  }

  public async deleteByRoom(roomId: string): Promise<void> {
    await db.delete(roomWhitelists).where(eq(roomWhitelists.roomId, roomId));
  }
}
