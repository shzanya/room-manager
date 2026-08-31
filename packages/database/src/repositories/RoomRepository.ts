import type { Room } from "@room-manager/contracts";
import type { ChannelId, GuildId, RoomId, UserId } from "@room-manager/shared";
import { and, desc, eq } from "drizzle-orm";

import { db } from "../client";
import { mapRoom } from "../mappers/RoomMapper";
import { rooms } from "../schema";

export class RoomRepository {
  public async findById(roomId: RoomId): Promise<Room | null> {
    const result = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    const room = result[0];

    return room ? mapRoom(room) : null;
  }

  public async findByChannelId(channelId: ChannelId): Promise<Room | null> {
    const result = await db
      .select()
      .from(rooms)
      .where(eq(rooms.channelId, channelId))
      .limit(1);

    const room = result[0];

    return room ? mapRoom(room) : null;
  }

  public async findByGuildId(guildId: GuildId): Promise<Room[]> {
    const result = await db
      .select()
      .from(rooms)
      .where(eq(rooms.guildId, guildId));

    return result.map(mapRoom);
  }

  public async findByState(state: Room["state"]): Promise<Room[]> {
    const result = await db.select().from(rooms).where(eq(rooms.state, state));

    return result.map(mapRoom);
  }

  public async findLatestOwned(
    guildId: GuildId,
    ownerId: UserId,
  ): Promise<Room | null> {
    const result = await db
      .select()
      .from(rooms)
      .where(and(eq(rooms.guildId, guildId), eq(rooms.ownerId, ownerId)))
      .orderBy(desc(rooms.createdAt))
      .limit(20);

    const usable = result.map(mapRoom).find((r) => r.state !== "deleting");

    return usable ?? null;
  }

  public async create(room: Room): Promise<Room> {
    const [created] = await db
      .insert(rooms)
      .values({
        id: room.id,
        guildId: room.guildId,
        channelId: room.channelId,
        ownerId: room.ownerId,
        name: room.name,
        userLimit: room.userLimit,
        state: room.state,
        locked: room.locked,
        hidden: room.hidden,
      })
      .returning();

    if (!created) {
      throw new Error(`Failed to create room: ${room.id}`);
    }

    return mapRoom(created);
  }

  public async update(
    roomId: RoomId,
    changes: Partial<
      Pick<
        Room,
        | "channelId"
        | "ownerId"
        | "name"
        | "userLimit"
        | "state"
        | "locked"
        | "hidden"
      >
    >,
  ): Promise<Room | null> {
    const [updated] = await db
      .update(rooms)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(rooms.id, roomId))
      .returning();

    return updated ? mapRoom(updated) : null;
  }

  public async delete(roomId: RoomId): Promise<boolean> {
    const result = await db
      .delete(rooms)
      .where(eq(rooms.id, roomId))
      .returning({
        id: rooms.id,
      });

    return result.length > 0;
  }
}
