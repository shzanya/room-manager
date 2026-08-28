import type { GuildConfig, Room } from "@room-manager/contracts";

export function canCreateRoom(
  guild: GuildConfig,
  existingRoom: Room | null,
): boolean {
  return guild.enabled && existingRoom === null;
}

export function canDeleteRoom(room: Room): boolean {
  return room.state !== "deleting";
}

export function canUseRoom(room: Room): boolean {
  return room.state === "active";
}
