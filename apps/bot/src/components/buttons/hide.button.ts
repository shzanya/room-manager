import type { RoomRepository } from "@room-manager/database";
import type { Logger } from "@room-manager/logger";
import type { ChannelId } from "@room-manager/shared";
import { type ButtonInteraction, GuildMember, MessageFlags } from "discord.js";
import { ButtonComponent, Discord } from "discordx";
import { v2ActionFor, v2Error } from "../../discord/V2";
import { tOf } from "../../i18n";
import { svc } from "../../services/registry";

@Discord()
export class HideButton {
  private readonly logger: Logger = svc().logger;
  private readonly roomRepository: RoomRepository = svc().roomRepository;

  @ButtonComponent({ id: "room:hide" })
  async onButton(interaction: ButtonInteraction): Promise<void> {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const L = tOf(interaction.guild?.id);
      const fail = (text: string) => v2Error(L.hide.title, text);

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) {
        await interaction.editReply({ ...fail(L.hide.notInVoice) });
        return;
      }

      const room = await this.roomRepository.findByChannelId(member.voice.channelId as ChannelId);
      if (!room) {
        await interaction.editReply({ ...fail(L.common.roomNotFound) });
        return;
      }

      if (room.ownerId !== interaction.user.id) {
        await interaction.editReply({ ...fail(L.hide.ownerOnly) });
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

      const nowHidden = !room.hidden;

      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        ViewChannel: nowHidden ? false : null,
      });
      await this.roomRepository.update(room.id, { hidden: nowHidden });

      await interaction.editReply({
        ...(await v2ActionFor(
          guild,
          interaction.user.id,
          L.hide.title,
          nowHidden ? L.hide.hiddenText : L.hide.shownText,
          [nowHidden ? L.hide.hiddenDetail : L.hide.shownDetail],
        )),
      });
    } catch (error) {
      this.logger.error("Failed to toggle hide", error);
      const L = tOf(interaction.guild?.id);
      await interaction.editReply({
        ...v2Error(L.hide.title, L.common.error),
      });
    }
  }
}
