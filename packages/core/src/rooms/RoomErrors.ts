import { AppError } from "@room-manager/shared";

export class RoomNotFoundError extends AppError {
  public constructor(roomId: string) {
    super(`Room not found: ${roomId}`, "ROOM_NOT_FOUND");

    this.name = "RoomNotFoundError";
  }
}

export class RoomAlreadyExistsError extends AppError {
  public constructor(channelId: string) {
    super(
      `Room already exists for channel: ${channelId}`,
      "ROOM_ALREADY_EXISTS",
    );

    this.name = "RoomAlreadyExistsError";
  }
}

export class InvalidRoomStateTransitionError extends AppError {
  public constructor(from: string, to: string) {
    super(
      `Invalid room state transition: ${from} -> ${to}`,
      "INVALID_ROOM_STATE_TRANSITION",
    );

    this.name = "InvalidRoomStateTransitionError";
  }
}
