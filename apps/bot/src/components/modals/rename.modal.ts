import type { RoomService } from "@room-manager/core";
import type { RoomRepository } from "@room-manager/database";
import type { Logger } from "@room-manager/logger";
import type { ChannelId } from "@room-manager/shared";
import {
  GuildMember,
  MessageFlags,
  type ModalSubmitInteraction,
} from "discord.js";
import { Discord, ModalComponent } from "discordx";
import { actorAvatarUrl, v2Action, v2Error } from "../../discord/V2";
import { format, tOf } from "../../i18n";
import { svc } from "../../services/registry";

@Discord()
export class RenameModal {
  private readonly logger: Logger = svc().logger;
  private readonly roomService: RoomService = svc().roomService;
  private readonly roomRepository: RoomRepository = svc().roomRepository;

  @ModalComponent({ id: "room:rename:modal" })
  async onModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const L = tOf(interaction.guild?.id);
      const fail = (text: string) => v2Error(L.rename.title, text);

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) {
        await interaction.editReply({ ...fail(L.rename.notInVoice) });
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ ...fail(L.common.guildFail) });
        return;
      }

      const newName = interaction.fields.getTextInputValue("room:rename:input");

      if (newName.length < 1 || newName.length > 100) {
        await interaction.editReply({ ...fail(L.rename.invalidLength) });
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
        await interaction.editReply({ ...fail(L.rename.ownerOnly) });
        return;
      }

      await this.roomService.update(room.id, { name: newName });

      await svc().logService.send(guild, guild.id as import("@room-manager/shared").GuildId, {
        type: "rename",
        actorId: interaction.user.id,
        details: [`на ${newName}`],
      });

      const channel = await guild.channels.fetch(room.channelId);
      if (channel?.isVoiceBased()) {
        await channel.setName(newName);
      }

      await interaction.editReply({
        ...v2Action({
          title: L.rename.title,
          actorId: interaction.user.id,
          text: L.rename.doneText,
          details: [format(L.rename.newName, { name: newName })],
          avatarUrl: await actorAvatarUrl(guild, interaction.user.id),
        }),
      });
    } catch (error) {
      this.logger.error("Failed to process rename modal", error);
      const L = tOf(interaction.guild?.id);
      await interaction.editReply({
        ...v2Error(L.rename.title, L.common.error),
      });
    }
  }
}
