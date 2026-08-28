import type { RoomRepository } from "@room-manager/database";
import type { Logger } from "@room-manager/logger";
import type { ChannelId } from "@room-manager/shared";
import {
  ActionRowBuilder,
  type ButtonInteraction,
  GuildMember,
  MessageFlags,
  UserSelectMenuBuilder,
} from "discord.js";
import { ButtonComponent, Discord } from "discordx";
import { actorAvatarUrl, v2Action, v2Error } from "../../discord/V2";
import { tOf } from "../../i18n";
import { svc } from "../../services/registry";

@Discord()
export class OwnerButton {
  private readonly logger: Logger = svc().logger;
  private readonly roomRepository: RoomRepository = svc().roomRepository;

  @ButtonComponent({ id: "room:owner" })
  async onButton(interaction: ButtonInteraction): Promise<void> {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const L = tOf(interaction.guild?.id);
      const fail = (text: string) => v2Error(L.transfer.title, text);

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) {
        await interaction.editReply({ ...fail(L.transfer.notInVoice) });
        return;
      }

      const room = await this.roomRepository.findByChannelId(
        member.voice.channelId as ChannelId,
      );
      if (!room) {
        await interaction.editReply({ ...fail(L.common.roomNotFound) });
        return;
      }

      if (room.ownerId !== interaction.user.id) {
        await interaction.editReply({ ...fail(L.transfer.ownerOnly) });
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ ...fail(L.common.guildFail) });
        return;
      }

      const channel = await guild.channels.fetch(room.channelId);
      if (!channel?.isVoiceBased()) {
        await interaction.editReply({ ...fail(L.lock.channelMissing) });
        return;
      }

      const candidates = channel.members.filter(
        (m) => m.id !== interaction.user.id && m.id !== guild.members.me?.id,
      );
      if (candidates.size === 0) {
        await interaction.editReply({ ...fail(L.transfer.noCandidates) });
        return;
      }

      await interaction.editReply({
        ...v2Action({
          title: L.transfer.title,
          actorId: interaction.user.id,
          text: L.transfer.promptText,
          avatarUrl: await actorAvatarUrl(guild, interaction.user.id),
          rows: [
            new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
              new UserSelectMenuBuilder()
                .setCustomId("room:owner:select")
                .setPlaceholder(L.transfer.placeholder)
                .setMinValues(1)
                .setMaxValues(1),
            ),
          ],
        }),
      });
    } catch (error) {
      this.logger.error("Failed to open owner select", error);
      const L = tOf(interaction.guild?.id);
      await interaction.editReply({
        ...v2Error(L.transfer.title, L.common.error),
      });
    }
  }
}
