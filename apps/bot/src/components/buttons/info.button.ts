import type { RoomRepository } from "@room-manager/database";
import type { Logger } from "@room-manager/logger";
import type { ChannelId } from "@room-manager/shared";
import { type ButtonInteraction, GuildMember, MessageFlags } from "discord.js";
import { ButtonComponent, Discord } from "discordx";
import { actorAvatarUrl, v2Action, v2Error } from "../../discord/V2";
import { format, tOf } from "../../i18n";
import { svc } from "../../services/registry";

@Discord()
export class InfoButton {
  private readonly logger: Logger = svc().logger;
  private readonly roomRepository: RoomRepository = svc().roomRepository;

  @ButtonComponent({ id: "room:info" })
  async onButton(interaction: ButtonInteraction): Promise<void> {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const L = tOf(interaction.guild?.id);
      const fail = (text: string) => v2Error(L.info.title, text);

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) {
        await interaction.editReply({ ...fail(L.info.notInVoice) });
        return;
      }

      const room = await this.roomRepository.findByChannelId(
        member.voice.channelId as ChannelId,
      );
      if (!room) {
        await interaction.editReply({ ...fail(L.common.roomNotFound) });
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ ...fail(L.common.guildFail) });
        return;
      }

      const channel = await guild.channels.fetch(room.channelId);
      const memberCount = channel?.isVoiceBased() ? channel.members.size : 0;

      const limitText =
        room.userLimit === 0 ? L.limit.noLimit : String(room.userLimit);

      await interaction.editReply({
        ...v2Action({
          title: `${L.info.title} — ${room.name}`,
          actorId: interaction.user.id,
          text: L.info.stateText,
          details: [
            format(L.info.owner, { user: `<@${room.ownerId}>` }),
            room.userLimit > 0
              ? format(L.info.membersLimited, {
                  count: memberCount,
                  limit: room.userLimit,
                })
              : format(L.info.members, { count: memberCount }),
            format(L.info.limitLabel, { limit: limitText }),
            format(L.info.flags, {
              locked: room.locked ? L.info.yes : L.info.no,
              hidden: room.hidden ? L.info.yes : L.info.no,
            }),
            format(L.info.created, {
              time: `<t:${Math.floor(room.createdAt.getTime() / 1000)}:R>`,
            }),
          ],
          avatarUrl: await actorAvatarUrl(guild, interaction.user.id),
        }),
      });
    } catch (error) {
      this.logger.error("Failed to show room info", error);
      const L = tOf(interaction.guild?.id);
      await interaction.editReply({
        ...v2Error(L.info.title, L.common.error),
      });
    }
  }
}
