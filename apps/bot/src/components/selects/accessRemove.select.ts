import type { Logger } from "@room-manager/logger";
import { GuildMember, type UserSelectMenuInteraction } from "discord.js";
import { Discord, SelectMenuComponent } from "discordx";
import { v2ActionFor, v2Error } from "../../discord/V2";
import { format, tOf } from "../../i18n";
import { svc } from "../../services/registry";
import type { SetupService } from "../../services/SetupService";

@Discord()
export class AccessRemoveSelect {
  private readonly logger: Logger = svc().logger;
  private readonly setupService: SetupService = svc().setupService;

  @SelectMenuComponent({ id: "room:access:remove:select" })
  async onSelect(interaction: UserSelectMenuInteraction): Promise<void> {
    try {
      await interaction.deferUpdate();
      const L = tOf(interaction.guild?.id);

      const targetUserId = interaction.values[0];
      if (!targetUserId) return;

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) {
        await interaction.followUp({
          ...v2Error(L.access.title, L.access.notInVoice),
        });
        return;
      }

      const guild = interaction.guild;
      if (!guild) return;

      const channel = await guild.channels.fetch(member.voice.channelId);
      if (!channel?.isVoiceBased()) return;

      const targetMember = await guild.members.fetch({ user: targetUserId }).catch(() => null);
      if (!targetMember) {
        await interaction.followUp({
          ...v2Error(L.access.title, L.access.targetNotFound),
        });
        return;
      }

      await channel.permissionOverwrites.edit(targetUserId, {
        ViewChannel: null,
        Connect: null,
      });

      const targetAvatar = targetMember.displayAvatarURL({
        extension: "png",
        size: 128,
      });

      await interaction.followUp({
        ...(await v2ActionFor(
          guild,
          interaction.user.id,
          L.access.title,
          L.access.revokedText,
          [format(L.common.userLabel, { user: `<@${targetUserId}>` })],
          { avatarUrl: targetAvatar },
        )),
      });
      await this.setupService.refreshPanel(guild);
    } catch (error) {
      this.logger.error("Failed to remove access", error);
      await interaction.followUp({
        ...v2Error(
          tOf(interaction.guild?.id).access.title,
          tOf(interaction.guild?.id).common.error,
        ),
      });
    }
  }
}
