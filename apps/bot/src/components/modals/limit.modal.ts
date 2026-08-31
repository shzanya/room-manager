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
export class LimitModal {
  private readonly logger: Logger = svc().logger;
  private readonly roomService: RoomService = svc().roomService;
  private readonly roomRepository: RoomRepository = svc().roomRepository;

  @ModalComponent({ id: "room:limit:modal" })
  async onModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const L = tOf(interaction.guild?.id);
      const fail = (text: string) => v2Error(L.limit.title, text);

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) {
        await interaction.editReply({ ...fail(L.limit.notInVoice) });
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ ...fail(L.common.guildFail) });
        return;
      }

      const limitInput =
        interaction.fields.getTextInputValue("room:limit:input");
      const limit = Number.parseInt(limitInput, 10);

      if (Number.isNaN(limit) || limit < 0 || limit > 99) {
        await interaction.editReply({ ...fail(L.limit.invalid) });
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
        await interaction.editReply({ ...fail(L.limit.ownerOnly) });
        return;
      }

      await this.roomService.update(room.id, { userLimit: limit });

      await svc().logService.send(guild, guild.id as import("@room-manager/shared").GuildId, {
        type: "limit",
        actorId: interaction.user.id,
        details: [
          limit === 0 ? "Без лимита" : `Лимит: ${limit}`,
        ],
      });

      const channel = await guild.channels.fetch(room.channelId);
      if (channel?.isVoiceBased()) {
        await channel.setUserLimit(limit);
      }

      await interaction.editReply({
        ...v2Action({
          title: L.limit.title,
          actorId: interaction.user.id,
          text: L.limit.doneText,
          details: [
            format(L.limit.newLimit, {
              limit: limit === 0 ? L.limit.noLimit : String(limit),
            }),
          ],
          avatarUrl: await actorAvatarUrl(guild, interaction.user.id),
        }),
      });
    } catch (error) {
      this.logger.error("Failed to process limit modal", error);
      const L = tOf(interaction.guild?.id);
      await interaction.editReply({
        ...v2Error(L.limit.title, L.common.error),
      });
    }
  }
}
