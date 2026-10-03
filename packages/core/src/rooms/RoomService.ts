import { randomUUID } from "node:crypto";

import type { Room } from "@room-manager/contracts";
import type { RoomRepository } from "@room-manager/database";
import type { ChannelId, GuildId, RoomId, UserId } from "@room-manager/shared";

import {
  InvalidRoomStateTransitionError,
  RoomAlreadyExistsError,
  RoomNotFoundError,
} from "./RoomErrors";
import { canTransitionRoomState } from "./RoomStateMachine";

export class RoomService {
  public constructor(private readonly rooms: RoomRepository) {}

  public async getById(roomId: RoomId): Promise<Room | null> {
    return this.rooms.findById(roomId);
  }

  public async getByChannelId(channelId: ChannelId): Promise<Room | null> {
    return this.rooms.findByChannelId(channelId);
  }

  public async getByGuildId(guildId: GuildId): Promise<Room[]> {
    return this.rooms.findByGuildId(guildId);
  }

  public async getByState(state: Room["state"]): Promise<Room[]> {
    return this.rooms.findByState(state);
  }

  public async getLatestOwned(guildId: GuildId, ownerId: UserId): Promise<Room | null> {
    return this.rooms.findLatestOwned(guildId, ownerId);
  }

  public async create(room: Room): Promise<Room> {
    const existing = await this.rooms.findByChannelId(room.channelId);
    if (existing) {
      throw new RoomAlreadyExistsError(room.channelId);
    }

    return this.rooms.create(room);
  }

  public async update(
    roomId: RoomId,
    changes: Partial<
      Pick<
        Room,
        | "ownerId"
        | "name"
        | "userLimit"
        | "state"
        | "locked"
        | "hidden"
        | "updatedAt"
        | "lastActivityAt"
      >
    >,
  ): Promise<Room | null> {
    return this.rooms.update(roomId, changes);
  }

  public async createForOwner(
    guildId: GuildId,
    channelId: ChannelId,
    ownerId: UserId,
    name: string,
    userLimit: number,
  ): Promise<Room> {
    const now = new Date();

    return this.create({
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

  public async transition(roomId: RoomId, state: Room["state"]): Promise<Room> {
    const room = await this.rooms.findById(roomId);

    if (!room) {
      throw new RoomNotFoundError(roomId);
    }

    if (!canTransitionRoomState(room.state, state)) {
      throw new InvalidRoomStateTransitionError(room.state, state);
    }

    const updated = await this.rooms.update(roomId, {
      state,
      updatedAt: new Date(),
    });

    if (!updated) {
      throw new RoomNotFoundError(roomId);
    }

    return updated;
  }

  public async delete(roomId: RoomId): Promise<boolean> {
    return this.rooms.delete(roomId);
  }
}
