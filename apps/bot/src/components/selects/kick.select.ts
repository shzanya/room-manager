import type { RoomRepository } from "@room-manager/database";
import type { Logger } from "@room-manager/logger";
import type { ChannelId } from "@room-manager/shared";
import { type AnySelectMenuInteraction, GuildMember } from "discord.js";
import { Discord, SelectMenuComponent } from "discordx";
import { v2Action, v2Error } from "../../discord/V2";
import { format, tOf } from "../../i18n";
import { svc } from "../../services/registry";

@Discord()
export class KickSelect {
  private readonly logger: Logger = svc().logger;
  private readonly roomRepository: RoomRepository = svc().roomRepository;

  @SelectMenuComponent({ id: "room:kick:select" })
  async onSelect(interaction: AnySelectMenuInteraction): Promise<void> {
    try {
      await interaction.deferUpdate();
      const L = tOf(interaction.guild?.id);

      if (!("values" in interaction) || interaction.values.length === 0) {
        return;
      }

      const targetUserId = interaction.values[0] as string;

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) {
        await interaction.editReply({
          ...v2Error(L.kick.title, L.kick.notInVoice),
        });
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({
          ...v2Error(L.kick.title, L.common.guildFail),
        });
        return;
      }

      const room = await this.roomRepository.findByChannelId(
        member.voice.channelId as ChannelId,
      );
      if (!room) {
        await interaction.editReply({
          ...v2Error(L.kick.title, L.common.roomNotFound),
        });
        return;
      }

      if (room.ownerId !== interaction.user.id) {
        await interaction.editReply({
          ...v2Error(L.transfer.title, L.kick.ownerOnly),
        });
        return;
      }

      const targetMember = await guild.members
        .fetch({ user: targetUserId })
        .catch(() => null);
      if (!targetMember) {
        await interaction.editReply({
          ...v2Error(L.kick.title, L.access.targetNotFound),
        });
        return;
      }

      // Anti-self / anti-bot guard
      if (targetUserId === interaction.user.id) {
        await interaction.editReply({
          ...v2Error(L.kick.title, L.common.invalidTarget),
        });
        return;
      }
      if (targetMember.user.bot) {
        await interaction.editReply({
          ...v2Error(L.kick.title, L.common.invalidTarget),
        });
        return;
      }

      if (
        !targetMember.voice.channelId ||
        targetMember.voice.channelId !== room.channelId
      ) {
        await interaction.editReply({
          ...v2Error(L.kick.title, L.access.targetNotInRoom),
        });
        return;
      }

      await targetMember.voice.setChannel(null);

      // Thumbnail = the kicked participant.
      const targetAvatar = targetMember.displayAvatarURL({
        extension: "png",
        size: 128,
      });

      await interaction.editReply({
        ...v2Action({
          title: L.kick.title,
          actorId: interaction.user.id,
          text: L.kick.doneText,
          details: [
            format(L.common.memberLabel, { user: `<@${targetUserId}>` }),
          ],
          avatarUrl: targetAvatar,
        }),
      });
    } catch (error) {
      this.logger.error("Failed to kick user", error);
      const L = tOf(interaction.guild?.id);
      await interaction.editReply({
        ...v2Error(L.kick.title, L.common.error),
      });
    }
  }
}
