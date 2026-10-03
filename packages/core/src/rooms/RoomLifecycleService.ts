import { randomUUID } from "node:crypto";

import type { Room } from "@room-manager/contracts";
import type { ChannelId, GuildId, RoomId, UserId } from "@room-manager/shared";

import { RoomNotFoundError } from "./RoomErrors";
import type { RoomService } from "./RoomService";

export class RoomLifecycleService {
  public constructor(private readonly rooms: RoomService) {}

  public async createForOwner(
    guildId: GuildId,
    channelId: ChannelId,
    ownerId: UserId,
    name: string,
    userLimit: number,
  ): Promise<Room> {
    const now = new Date();

    return this.rooms.create({
      id: randomUUID() as RoomId,
      guildId,
      channelId,
      ownerId,
      name,
      userLimit,
      state: "active",
      locked: false,
      hidden: false,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    });
  }

  public async getByChannelId(channelId: ChannelId): Promise<Room | null> {
    return this.rooms.getByChannelId(channelId);
  }

  public async getById(roomId: RoomId): Promise<Room | null> {
    return this.rooms.getById(roomId);
  }

  public async getLatestOwned(guildId: GuildId, ownerId: UserId): Promise<Room | null> {
    return this.rooms.getLatestOwned(guildId, ownerId);
  }

  public async getByState(state: Room["state"]): Promise<Room[]> {
    return this.rooms.getByState(state);
  }

  public async activate(roomId: RoomId): Promise<Room> {
    const room = await this.requireRoom(roomId);

    if (room.state === "active") {
      return room;
    }

    return this.rooms.transition(roomId, "active");
  }

  public async startCooldown(roomId: RoomId): Promise<Room> {
    const room = await this.requireRoom(roomId);

    if (room.state === "cooldown") {
      return room;
    }

    return this.rooms.transition(roomId, "cooldown");
  }

  public async startDeletion(roomId: RoomId): Promise<Room> {
    const room = await this.requireRoom(roomId);

    if (room.state === "deleting") {
      return room;
    }

    return this.rooms.transition(roomId, "deleting");
  }

  public async destroy(roomId: RoomId): Promise<boolean> {
    await this.requireRoom(roomId);

    return this.rooms.delete(roomId);
  }

  private async requireRoom(roomId: RoomId): Promise<Room> {
    const room = await this.rooms.getById(roomId);

    if (!room) {
      throw new RoomNotFoundError(roomId);
    }

    return room;
  }
}
