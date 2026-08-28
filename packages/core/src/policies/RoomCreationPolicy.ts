import type { GuildConfig } from "@room-manager/contracts";

export function canCreateRoomFromConfig(
  config: GuildConfig,
  activeRoomCount: number,
): boolean {
  if (!config.enabled) {
    return false;
  }

  if (!config.creatorChannelId) {
    return false;
  }

  return activeRoomCount >= 0;
}
