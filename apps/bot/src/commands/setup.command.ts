import type { Logger } from "@room-manager/logger";
import {
  ApplicationCommandOptionType,
  type CategoryChannel,
  ChannelType,
  type ChatInputCommandInteraction,
  type CommandInteraction,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  type TextChannel,
  type VoiceChannel,
} from "discord.js";
import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { v2ActionFor, v2Error } from "../discord/V2";
import { tOf } from "../i18n";
import { svc } from "../services/registry";

@Discord()
@SlashGroup({
  name: "setup",
  description: "Настройка приватных комнат",
})
export class SetupCommands {
  private readonly logger: Logger = svc().logger;

  @Slash({
    name: "basic",
    description: "Основные каналы: категория, канал создания, панель",
    defaultMemberPermissions: [PermissionFlagsBits.ManageGuild],
  })
  @SlashGroup("setup")
  async basic(
    @SlashOption({
      name: "category",
      description: "Категория для комнат (если не указана, будет создана)",
      required: false,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildCategory],
    })
    category: CategoryChannel | null,

    @SlashOption({
      name: "hub",
      description:
        "Голосовой канал для создания комнат (если не указан, будет создан)",
      required: false,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildVoice],
    })
    hub: VoiceChannel | null,

    @SlashOption({
      name: "panel",
      description:
        "Текстовый канал для панели управления (если не указан, будет создан)",
      required: false,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText],
    })
    panel: TextChannel | null,

    interaction: CommandInteraction,
  ): Promise<void> {
    const L = tOf(interaction.guild?.id);
    const guild = interaction.guild;

    // Only managers may run setup — tribunal answer with their avatar.
    if (
      !guild ||
      !(interaction.member instanceof GuildMember) ||
      !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
    ) {
      await interaction.editReply({
        ...(guild
          ? {
              ...(await v2ActionFor(
                guild,
                interaction.user.id,
                L.setup.doneTitle,
                L.common.noPerms,
              )),
            }
          : { ...v2Error(L.setup.doneTitle, L.common.guildOnly) }),
      });
      return;
    }

    await svc().setupService.handleSetup(interaction, {
      category,
      hub,
      panel,
    });
  }

  @Slash({
    name: "settings",
    description: "Настройки: иконки, дизайн, управление комнатами",
    defaultMemberPermissions: [PermissionFlagsBits.ManageGuild],
  })
  @SlashGroup("setup")
  async settings(interaction: ChatInputCommandInteraction): Promise<void> {
    await svc().iconSettings.show(interaction);
  }
}
