import type { UserId } from "@room-manager/shared";
import { and, eq } from "drizzle-orm";

import { db } from "../client";
import { roomMutes } from "../schema";

export class RoomMuteRepository {
  public async add(roomId: string, userId: UserId): Promise<void> {
    await db.insert(roomMutes).values({ roomId, userId }).onConflictDoNothing();
  }

  public async remove(roomId: string, userId: UserId): Promise<boolean> {
    const result = await db
      .delete(roomMutes)
      .where(and(eq(roomMutes.roomId, roomId), eq(roomMutes.userId, userId)))
      .returning({ userId: roomMutes.userId });

    return result.length > 0;
  }

  public async has(roomId: string, userId: UserId): Promise<boolean> {
    const result = await db
      .select({ userId: roomMutes.userId })
      .from(roomMutes)
      .where(and(eq(roomMutes.roomId, roomId), eq(roomMutes.userId, userId)))
      .limit(1);

    return result.length > 0;
  }

  public async list(roomId: string): Promise<UserId[]> {
    const result = await db
      .select({ userId: roomMutes.userId })
      .from(roomMutes)
      .where(eq(roomMutes.roomId, roomId));

    return result.map((r) => r.userId as UserId);
  }

  public async deleteByRoom(roomId: string): Promise<void> {
    await db.delete(roomMutes).where(eq(roomMutes.roomId, roomId));
  }
}
