import type { RoomRepository } from "@room-manager/database";
import type { Logger } from "@room-manager/logger";
import type { ChannelId } from "@room-manager/shared";
import { type ButtonInteraction, GuildMember } from "discord.js";
import { ButtonComponent, Discord } from "discordx";
import { v2Error } from "../../discord/V2";
import { tOf } from "../../i18n";
import { svc } from "../../services/registry";
import { buildMutesView } from "../selects/voiceControl.select";

@Discord()
export class MuteButton {
  private readonly logger: Logger = svc().logger;
  private readonly roomRepository: RoomRepository = svc().roomRepository;

  @ButtonComponent({ id: "room:mute" })
  async onButton(interaction: ButtonInteraction): Promise<void> {
    try {
      const L = tOf(interaction.guild?.id);
      const fail = (text: string) => v2Error(L.mutes.title, text);

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) {
        await interaction.reply({ ...fail(L.mutes.notInVoice) });
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
        await interaction.reply({ ...fail(L.mutes.ownerOnly) });
        return;
      }

      const guild = interaction.guild;
      if (!guild) return;

      await interaction.reply(
        await buildMutesView(guild, interaction.user.id, room.id, "mute"),
      );
    } catch (error) {
      this.logger.error("Failed to open mute view", error);
    }
  }
}
