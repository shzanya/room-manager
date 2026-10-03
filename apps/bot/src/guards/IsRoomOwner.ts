import type { RoomRepository } from "@room-manager/database";
import type { Logger } from "@room-manager/logger";
import type { ChannelId } from "@room-manager/shared";
import type { GuildMember, Interaction } from "discord.js";

export async function isRoomOwner(
  interaction: Interaction,
  _logger: Logger,
  roomRepository: RoomRepository,
): Promise<boolean> {
  if (!interaction.inGuild() || !interaction.member) {
    return false;
  }

  const member = interaction.member as GuildMember;

  if (!member.voice.channelId) {
    return false;
  }

  const room = await roomRepository.findByChannelId(member.voice.channelId as ChannelId);

  if (!room) {
    return false;
  }

  if (room.ownerId !== interaction.user.id) {
    return false;
  }

  return true;
}
