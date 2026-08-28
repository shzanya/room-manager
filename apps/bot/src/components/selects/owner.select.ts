import type { RoomService } from "@room-manager/core";
import type { RoomRepository } from "@room-manager/database";
import type { Logger } from "@room-manager/logger";
import type { ChannelId, UserId } from "@room-manager/shared";
import { type AnySelectMenuInteraction, GuildMember } from "discord.js";
import { Discord, SelectMenuComponent } from "discordx";
import { actorAvatarUrl, v2Action, v2Error } from "../../discord/V2";
import { format, tOf } from "../../i18n";
import { svc } from "../../services/registry";
import type { SetupService } from "../../services/SetupService";

@Discord()
export class OwnerSelect {
  private readonly logger: Logger = svc().logger;
  private readonly roomService: RoomService = svc().roomService;
  private readonly roomRepository: RoomRepository = svc().roomRepository;
  private readonly setupService: SetupService = svc().setupService;

  @SelectMenuComponent({ id: "room:owner:select" })
  async onSelect(interaction: AnySelectMenuInteraction): Promise<void> {
    try {
      await interaction.deferUpdate();
      const L = tOf(interaction.guild?.id);

      if (!("values" in interaction) || interaction.values.length === 0) {
        return;
      }

      const newOwnerId = interaction.values[0] as string;

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) {
        await interaction.editReply({
          ...v2Error(L.transfer.title, L.transfer.notInVoice),
        });
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({
          ...v2Error(L.transfer.title, L.common.guildFail),
        });
        return;
      }

      const room = await this.roomRepository.findByChannelId(
        member.voice.channelId as ChannelId,
      );
      if (!room) {
        await interaction.editReply({
          ...v2Error(L.transfer.title, L.common.roomNotFound),
        });
        return;
      }

      if (room.ownerId !== interaction.user.id) {
        await interaction.editReply({
          ...v2Error(L.transfer.title, L.transfer.ownerOnly),
        });
        return;
      }

      const targetMember = await guild.members
        .fetch({ user: newOwnerId })
        .catch(() => null);
      if (!targetMember) {
        await interaction.editReply({
          ...v2Error(L.transfer.title, L.access.targetNotFound),
        });
        return;
      }

      // Anti-self / anti-bot guard
      if (newOwnerId === interaction.user.id) {
        await interaction.editReply({
          ...v2Error(L.transfer.title, L.common.invalidTarget),
        });
        return;
      }
      if (targetMember.user.bot) {
        await interaction.editReply({
          ...v2Error(L.transfer.title, L.common.invalidTarget),
        });
        return;
      }

      if (
        !targetMember.voice.channelId ||
        targetMember.voice.channelId !== room.channelId
      ) {
        await interaction.editReply({
          ...v2Error(L.transfer.title, L.access.targetNotInRoom),
        });
        return;
      }

      await this.roomService.update(room.id, {
        ownerId: newOwnerId as UserId,
      });

      // Thumbnail = the new owner (person the action is about).
      const newOwnerAvatar = targetMember.displayAvatarURL({
        extension: "png",
        size: 128,
      });

      await interaction.editReply({
        ...v2Action({
          title: L.transfer.title,
          actorId: interaction.user.id,
          text: L.transfer.doneText,
          details: [format(L.transfer.newOwner, { user: `<@${newOwnerId}>` })],
          avatarUrl:
            newOwnerAvatar ??
            (await actorAvatarUrl(guild, interaction.user.id)),
        }),
      });
      await this.setupService.refreshPanel(guild);
    } catch (error) {
      this.logger.error("Failed to transfer ownership", error);
      const L = tOf(interaction.guild?.id);
      await interaction.editReply({
        ...v2Error(L.transfer.title, L.common.error),
      });
    }
  }
}
