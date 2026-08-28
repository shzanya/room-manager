import type { RoomRepository } from "@room-manager/database";
import type { Logger } from "@room-manager/logger";
import type { ChannelId } from "@room-manager/shared";
import {
  ActionRowBuilder,
  type ButtonInteraction,
  GuildMember,
  UserSelectMenuBuilder,
} from "discord.js";
import { ButtonComponent, Discord } from "discordx";
import { actorAvatarUrl, v2Action, v2Error } from "../../discord/V2";
import { tOf } from "../../i18n";
import { svc } from "../../services/registry";

@Discord()
export class KickButton {
  private readonly logger: Logger = svc().logger;
  private readonly roomRepository: RoomRepository = svc().roomRepository;

  @ButtonComponent({ id: "room:kick" })
  async onButton(interaction: ButtonInteraction): Promise<void> {
    try {
      const L = tOf(interaction.guild?.id);
      const fail = (text: string) => v2Error(L.kick.title, text);

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) {
        await interaction.reply({ ...fail(L.kick.notInVoice) });
        return;
      }

      const room = await this.roomRepository.findByChannelId(
        member.voice.channelId as ChannelId,
      );
      if (!room) {
        await interaction.reply({ ...fail(L.common.notPrivateRoom) });
        return;
      }

      if (room.ownerId !== interaction.user.id) {
        await interaction.reply({ ...fail(L.kick.ownerOnly) });
        return;
      }

      await interaction.reply({
        ...v2Action({
          title: L.kick.title,
          actorId: interaction.user.id,
          text: L.kick.promptText,
          avatarUrl: await actorAvatarUrl(
            interaction.guild ?? null,
            interaction.user.id,
          ),
          rows: [
            new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
              new UserSelectMenuBuilder()
                .setCustomId("room:kick:select")
                .setPlaceholder(L.kick.placeholder)
                .setMinValues(1)
                .setMaxValues(1),
            ),
          ],
        }),
      });
    } catch (error) {
      this.logger.error("Failed to open kick select", error);
      const L = tOf(interaction.guild?.id);
      await interaction.reply({
        ...v2Error(L.kick.title, L.common.error),
      });
    }
  }
}
