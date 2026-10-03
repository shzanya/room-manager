import type { GuildService } from "@room-manager/core";
import type { RoomRepository } from "@room-manager/database";
import type { Logger } from "@room-manager/logger";
import type { ChannelId, GuildId } from "@room-manager/shared";
import { type ButtonInteraction, GuildMember, MessageFlags } from "discord.js";
import { ButtonComponent, Discord } from "discordx";
import { v2ActionFor, v2Error } from "../../discord/V2";
import { format, tOf } from "../../i18n";
import { svc } from "../../services/registry";

@Discord()
export class ResetButton {
  private readonly logger: Logger = svc().logger;
  private readonly roomRepository: RoomRepository = svc().roomRepository;
  private readonly guildService: GuildService = svc().guildService;

  @ButtonComponent({ id: "room:reset" })
  async onButton(interaction: ButtonInteraction): Promise<void> {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const L = tOf(interaction.guild?.id);
      const fail = (text: string) => v2Error(L.reset.title, text);

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) {
        await interaction.editReply({ ...fail(L.reset.notInVoice) });
        return;
      }

      const room = await this.roomRepository.findByChannelId(member.voice.channelId as ChannelId);
      if (!room) {
        await interaction.editReply({ ...fail(L.common.roomNotFound) });
        return;
      }

      if (room.ownerId !== interaction.user.id) {
        await interaction.editReply({ ...fail(L.reset.ownerOnly) });
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

      const config = await this.guildService.getById(guild.id as GuildId);
      const defaultLimit = config?.defaultUserLimit ?? 0;

      await channel.setName(L.reset.defaultName);
      await channel.setUserLimit(defaultLimit);

      if (config?.categoryId) {
        await channel.lockPermissions().catch(() => undefined);
      } else {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          Connect: null,
          ViewChannel: null,
        });
      }

      for (const [, overwrite] of channel.permissionOverwrites.cache) {
        const isBot = overwrite.id === guild.members.me?.id;
        const isOwner = overwrite.id === room.ownerId;
        if (overwrite.type === 1 && !isBot && !isOwner) {
          await channel.permissionOverwrites.delete(overwrite.id).catch(() => {
            this.logger.warn(`Failed to delete overwrite ${overwrite.id}`);
          });
        }
      }

      await channel.permissionOverwrites
        .edit(room.ownerId, { ViewChannel: true, Connect: true })
        .catch(() => undefined);

      await this.roomRepository.update(room.id, {
        name: L.reset.defaultName,
        userLimit: defaultLimit,
        locked: false,
        hidden: false,
      });

      await interaction.editReply({
        ...(await v2ActionFor(guild, interaction.user.id, L.reset.title, L.reset.doneText, [
          format(L.reset.detailName, { name: L.reset.defaultName }),
          format(L.reset.detailLimit, {
            limit: defaultLimit === 0 ? L.limit.noLimit : defaultLimit,
          }),
          L.reset.detailOverwrites,
        ])),
      });
    } catch (error) {
      this.logger.error("Failed to reset room", error);
      const L = tOf(interaction.guild?.id);
      await interaction.editReply({
        ...v2Error(L.reset.title, L.common.error),
      });
    }
  }
}
