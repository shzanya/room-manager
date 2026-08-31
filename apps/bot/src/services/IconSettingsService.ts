import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { GuildConfig } from "@room-manager/contracts";
import { ICON_COLOR_PRESETS, type IconColors } from "@room-manager/contracts";
import type { GuildService } from "@room-manager/core";
import type { Logger } from "@room-manager/logger";
import type { GuildId } from "@room-manager/shared";
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  type ChatInputCommandInteraction,
  ChannelType,
  ContainerBuilder,
  type Guild,
  GuildMember,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { FLAGS_V2_EPHEMERAL, v2ActionFor, v2Error } from "../discord/V2";
import { format, LOCALE_OPTIONS, type Locale, tOf } from "../i18n";
import type { AppEmojiService } from "./AppEmojiService";
import { EMOJI_KEYS } from "./AppEmojiService";
import type { BannerService } from "./BannerService";
import type { PanelTextService } from "./PanelTextService";
import { svc } from "./registry";
import type { SetupService } from "./SetupService";
import { TemplateService } from "./TemplateService";

const COLOR_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "default", label: "Default" },
  { value: "white", label: "White" },
  { value: "gray", label: "Gray" },
  { value: "black", label: "Black" },
  { value: "red", label: "Red" },
  { value: "orange", label: "Orange" },
  { value: "yellow", label: "Yellow" },
  { value: "green", label: "Green" },
  { value: "cyan", label: "Cyan" },
  { value: "blue", label: "Blue" },
  { value: "purple", label: "Purple" },
  { value: "pink", label: "Pink" },
];

const PRESET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "default", label: "Default" },
  { value: "rainbow", label: "Rainbow" },
];

/**
 * Icon packs are REAL folders in assets/emojis/packs/.
 * Drop a new folder there (see docs/emojis.md) — the bot picks it up
 * automatically, no code changes needed.
 */
function availableIconPacks(): Array<{ value: string; label: string }> {
  const packsDir = join(process.cwd(), "assets", "emojis", "packs");
  try {
    if (!existsSync(packsDir)) return [{ value: "niako", label: "Niako" }];
    const dirs = readdirSync(packsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({
        value: d.name,
        label: d.name.charAt(0).toUpperCase() + d.name.slice(1),
      }));
    return dirs.length > 0 ? dirs : [{ value: "niako", label: "Niako" }];
  } catch {
    return [{ value: "niako", label: "Niako" }];
  }
}

export const CONTROL_MODE_OPTIONS: Array<{
  value: "both" | "voice" | "chat";
}> = [{ value: "both" }, { value: "voice" }, { value: "chat" }];

export class IconSettingsService {
  private readonly guildEmojis: AppEmojiService;
  private readonly templates = new TemplateService();

  constructor(
    private readonly logger: Logger,
    private readonly guildService: GuildService,
    private readonly setupService: SetupService,
    private readonly bannerService: BannerService,
    private readonly panelText: PanelTextService,
    guildEmojis: AppEmojiService,
  ) {
    this.guildEmojis = guildEmojis;
  }

  /** Where room-control settings come from (mode + instant delete). */
  private get controlSettings() {
    return svc().controlSettings;
  }

  private get locale() {
    return svc().locale;
  }

  /** Hub view: pick a settings section. */
  buildHub(config: GuildConfig): ContainerBuilder {
    const L = tOf(config.guildId);

    const container = new ContainerBuilder()
      .setAccentColor(config.accentColor)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `## ${L.settings.title}`,
            L.settings.pickSection,
            L.settings.iconsHint,
            L.settings.designHint,
            L.settings.controlHint,
            L.settings.rolesHint,
            L.settings.channelsHint,
            L.settings.languageHint,
          ].join("\n"),
        ),
      )
      .addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("setup:set:section")
            .setPlaceholder(L.settings.sectionPlaceholder)
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel(L.settings.secIcons)
                .setDescription(L.settings.secIconsDesc)
                .setValue("icons")
                .setEmoji("🎨"),
              new StringSelectMenuOptionBuilder()
                .setLabel(L.settings.secDesign)
                .setDescription(L.settings.secDesignDesc)
                .setValue("design")
                .setEmoji("🖌️"),
              new StringSelectMenuOptionBuilder()
                .setLabel(L.settings.secControl)
                .setDescription(L.settings.secControlDesc)
                .setValue("control")
                .setEmoji("🎛️"),
              new StringSelectMenuOptionBuilder()
                .setLabel(L.settings.secChannels)
                .setDescription(L.settings.secChannelsDesc)
                .setValue("channels")
                .setEmoji("📡"),
              new StringSelectMenuOptionBuilder()
                .setLabel(L.settings.secLang)
                .setDescription(L.settings.secLangDesc)
                .setValue("language")
                .setEmoji("🌐"),
            ),
        ),
      );

    return container;
  }

  private backRow(guildId: GuildId): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("setup:set:home")
        .setLabel(tOf(guildId).settings.back)
        .setStyle(ButtonStyle.Secondary),
    );
  }

  /** Language switcher view. */
  buildLanguage(config: GuildConfig, flash?: string | null): ContainerBuilder {
    const L = tOf(config.guildId);
    const current = this.locale.get(config.guildId);

    const headerLines = [
      `### ${L.settings.langTitle}`,
      format(L.settings.langCurrent, { lang: L.meta.name }),
      "",
      L.settings.langNote,
    ];

    if (flash) {
      headerLines.push("", `-# ${flash}`);
    }

    const container = new ContainerBuilder()
      .setAccentColor(config.accentColor)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(headerLines.join("\n")),
      );

    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("setup:lang")
          .setPlaceholder(L.settings.langPlaceholder)
          .addOptions(
            LOCALE_OPTIONS.map((o) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(o.label)
                .setValue(o.value)
                .setDefault(current === o.value),
            ),
          ),
      ),
    );

    container.addActionRowComponents(this.backRow(config.guildId));
    return container;
  }

  /**
   * Design view: live banner preview + source, panel layout
   * (text list vs pure image) and accent color. Everything in one place.
   */
  async buildDesign(
    config: GuildConfig,
    flash?: string | null,
  ): Promise<{
    flags: number;
    components: [ContainerBuilder];
    files: Array<{ attachment: Buffer; name: string }>;
  }> {
    const bannerState = this.bannerService.getBannerState(config);
    const tpl = this.templates.get(config.template ?? "default");
    const textOverride = this.panelText.hasOverride(config.guildId);
    const L = tOf(config.guildId);

    const bannerSource = config.bannerUrl
      ? bannerState.type === "custom_url"
        ? L.settings.bannerByUrl
        : L.settings.bannerUploaded
      : tpl.image
        ? format(L.settings.bannerFromTemplate, { tpl: tpl.name })
        : L.settings.bannerDefault;

    const layoutLabel = this.templates.isMinimal(config.template ?? "default")
      ? format(L.settings.layoutMinimal, { tpl: tpl.name })
      : format(L.settings.layoutFull, { tpl: tpl.name });

    const headerLines = [
      `### ${L.settings.designTitle}`,
      format(L.settings.bannerSource, { value: bannerSource }),
      `**${L.settings.layoutField}:** ${layoutLabel}`,
      `**${L.settings.textField}:** ${
        textOverride
          ? L.settings.textSourceCustom
          : format(L.settings.textSourceTemplate, { tpl: tpl.name })
      }`,
      "",
      L.settings.designFooterNote,
    ];

    if (flash) {
      headerLines.push("", `-# ${flash}`);
    }

    const header = headerLines.join("\n");

    // Preview mirrors the real publish priority:
    // user banner > template image > default gif.
    let previewUrl = bannerState.displayUrl;
    let previewFiles: Array<{ attachment: Buffer; name: string }> =
      this.bannerService.resolveBannerAttachments(config);

    if (!config.bannerUrl && tpl.image?.file) {
      const filePath = join(process.cwd(), "assets", "panel", tpl.image.file);
      if (existsSync(filePath)) {
        const fname = basename(filePath);
        previewUrl = `attachment://${fname}`;
        previewFiles = [{ attachment: readFileSync(filePath), name: fname }];
      }
    } else if (!config.bannerUrl && tpl.image?.url) {
      previewUrl = tpl.image.url;
      previewFiles = [];
    }

    const galleryItem = new MediaGalleryItemBuilder().setURL(previewUrl);

    const container = new ContainerBuilder()
      .setAccentColor(config.accentColor)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(header))
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(galleryItem),
      );

    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("setup:banner:url")
          .setLabel(L.settings.btnByUrl)
          .setEmoji("🔗")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("setup:design:upload")
          .setLabel(L.settings.btnByFile)
          .setEmoji("📎")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("setup:banner:reset")
          .setLabel(L.settings.btnBannerReset)
          .setEmoji("♻️")
          .setStyle(ButtonStyle.Secondary),
      ),
    );

    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("setup:design:text")
          .setLabel(L.settings.btnPanelText)
          .setEmoji("📝")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("setup:design:text:reset")
          .setLabel(L.settings.btnTextReset)
          .setStyle(ButtonStyle.Secondary),
      ),
    );

    const templateRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("setup:tpl")
          .setPlaceholder(L.settings.tplPlaceholder)
          .addOptions(
            this.templates.list().map((t) => {
              const option = new StringSelectMenuOptionBuilder()
                .setLabel(t.name)
                .setValue(t.name)
                .setDefault((config.template ?? "default") === t.name);
              if (t.description) {
                option.setDescription(t.description.slice(0, 100));
              }
              return option;
            }),
          ),
      );
    container.addActionRowComponents(templateRow);

    container.addActionRowComponents(this.backRow(config.guildId));

    return {
      flags: FLAGS_V2_EPHEMERAL,
      components: [container],
      files: previewFiles,
    };
  }

  /**
   * Control view: where the room control panel lives
   * (voice channel / room chat / both) and instant room deletion.
   */
  buildControl(config: GuildConfig, flash?: string | null): ContainerBuilder {
    const control = this.controlSettings.get(config.guildId);
    const L = tOf(config.guildId);

    const modeLabel =
      control.mode === "both"
        ? L.settings.modeBoth
        : control.mode === "voice"
          ? L.settings.modeVoice
          : L.settings.modeChat;

    const headerLines = [
      `### ${L.settings.controlTitle}`,
      format(L.settings.ctrlPanelMode, { mode: modeLabel }),
      format(L.settings.ctrlDelete, {
        value: control.instantDelete
          ? L.settings.deleteInstant
          : L.settings.deleteTimed,
      }),
      format(L.settings.ctrlCategory, {
        value: control.publicCategory
          ? L.settings.catPublic
          : L.settings.catHidden,
      }),
      "",
      L.settings.controlNote,
    ];

    if (flash) {
      headerLines.push("", `-# ${flash}`);
    }

    const container = new ContainerBuilder()
      .setAccentColor(config.accentColor)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(headerLines.join("\n")),
      );

    const modeRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("setup:ctrl:mode")
          .setPlaceholder(L.settings.modePlaceholder)
          .addOptions(
            CONTROL_MODE_OPTIONS.map((o) => {
              const meta =
                o.value === "both"
                  ? {
                      label: L.settings.modeBoth,
                      description: L.settings.modeBothDesc,
                    }
                  : o.value === "voice"
                    ? {
                        label: L.settings.modeVoice,
                        description: L.settings.modeVoiceDesc,
                      }
                    : {
                        label: L.settings.modeChat,
                        description: L.settings.modeChatDesc,
                      };
              return new StringSelectMenuOptionBuilder()
                .setLabel(meta.label)
                .setDescription(meta.description)
                .setValue(o.value)
                .setDefault(control.mode === o.value);
            }),
          ),
      );
    container.addActionRowComponents(modeRow);

    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("setup:ctrl:instant")
          .setLabel(
            control.instantDelete
              ? L.settings.btnInstantOn
              : L.settings.btnInstantOff,
          )
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("setup:ctrl:public")
          .setLabel(
            control.publicCategory
              ? L.settings.btnPublicOn
              : L.settings.btnPublicOff,
          )
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("setup:ctrl:logs")
          .setLabel(
            config.logChannelId
              ? L.settings.btnLogsOn
              : L.settings.btnLogsOff,
          )
          .setStyle(
            config.logChannelId ? ButtonStyle.Success : ButtonStyle.Secondary,
          ),
      ),
    );

    container.addActionRowComponents(this.backRow(config.guildId));
    return container;
  }

  buildChannels(config: GuildConfig, flash?: string | null): ContainerBuilder {
    const L = tOf(config.guildId);

    const headerLines = [
      `### ${L.settings.channelsTitle}`,
      format(L.settings.channelsCategory, {
        value: config.categoryId ? `<#${config.categoryId}>` : L.settings.channelsCategoryNone,
      }),
      format(L.settings.channelsCreator, {
        value: config.creatorChannelId ? `<#${config.creatorChannelId}>` : L.settings.channelsCreatorNone,
      }),
      format(L.settings.channelsLog, {
        value: config.logChannelId ? `<#${config.logChannelId}>` : L.settings.channelsLogNone,
      }),
      "",
      L.settings.channelsNote,
    ];

    if (flash) {
      headerLines.push("", `-# ${flash}`);
    }

    const container = new ContainerBuilder()
      .setAccentColor(config.accentColor)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(headerLines.join("\n")),
      );

    container.addActionRowComponents(
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("setup:channels:category")
          .setPlaceholder(L.settings.channelsPlaceholderCategory)
          .setChannelTypes(ChannelType.GuildCategory)
          .setMinValues(0)
          .setMaxValues(1),
      ),
    );

    container.addActionRowComponents(
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("setup:channels:creator")
          .setPlaceholder(L.settings.channelsPlaceholderCreator)
          .setChannelTypes(ChannelType.GuildVoice)
          .setMinValues(0)
          .setMaxValues(1),
      ),
    );

    container.addActionRowComponents(
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("setup:channels:log")
          .setPlaceholder(L.settings.channelsPlaceholderLog)
          .setChannelTypes(ChannelType.GuildText)
          .setMinValues(0)
          .setMaxValues(1),
      ),
    );

    container.addActionRowComponents(this.backRow(config.guildId));
    return container;
  }

  private buildIcons(config: GuildConfig): ContainerBuilder {
    const packs = availableIconPacks();
    // Stored pack may point to a removed folder — fall back gracefully.
    const activePack = packs.some((p) => p.value === config.iconPack)
      ? config.iconPack
      : (packs[0]?.value ?? "niako");
    const L = tOf(config.guildId);

    const packRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("setup:icons:pack")
          .setPlaceholder(L.settings.packPlaceholder)
          .addOptions(
            packs.map((o) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(o.label)
                .setValue(o.value)
                .setDefault(activePack === o.value),
            ),
          ),
      );

    const presetRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("setup:icons:preset")
          .setPlaceholder(L.settings.presetPlaceholder)
          .addOptions(
            PRESET_OPTIONS.map((o) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(o.label)
                .setValue(o.value)
                .setDefault(false),
            ),
          ),
      );

    const globalRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("setup:icons:global")
          .setPlaceholder(L.settings.colorAllPlaceholder)
          .addOptions(
            COLOR_OPTIONS.map((o) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(o.label)
                .setValue(o.value),
            ),
          ),
      );

    const container = new ContainerBuilder()
      .setAccentColor(config.accentColor)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `### ${L.settings.iconsTitle}`,
            format(L.settings.iconsPack, { pack: activePack }),
            L.settings.iconsNote,
          ].join("\n"),
        ),
      )
      .addActionRowComponents(packRow, presetRow, globalRow);

    container.addActionRowComponents(this.backRow(config.guildId));
    return container;
  }

  async handleSection(
    interaction: import("discord.js").StringSelectMenuInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const member = interaction.member;
      if (
        !(member instanceof GuildMember) ||
        !member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return;
      }

      const guild = interaction.guild;
      if (!guild || interaction.values.length === 0) return;

      const section = interaction.values[0];
      if (
        section !== "icons" &&
        section !== "design" &&
        section !== "control" &&
        section !== "channels" &&
        section !== "language"
      )
        return;

      const config = await this.guildService.getById(guild.id as GuildId);
      if (!config) return;

      if (section === "design") {
        const view = await this.buildDesign(config);
        await interaction.editReply({
          components: view.components,
          files: view.files,
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
        return;
      }

      if (section === "control") {
        await interaction.editReply({
          components: [this.buildControl(config)],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
        return;
      }

      if (section === "channels") {
        await interaction.editReply({
          components: [this.buildChannels(config)],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
        return;
      }

      if (section === "language") {
        await interaction.editReply({
          components: [this.buildLanguage(config)],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
        return;
      }

      await interaction.editReply({
        components: [this.buildIcons(config)],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      this.logger.error("Failed to open settings section", error);
    }
  }

  async handleHome(
    interaction: import("discord.js").ButtonInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const member = interaction.member;
      if (
        !(member instanceof GuildMember) ||
        !member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return;
      }

      const guild = interaction.guild;
      if (!guild) return;

      const config = await this.guildService.getById(guild.id as GuildId);
      if (!config) return;

      await interaction.editReply({
        components: [this.buildHub(config)],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      this.logger.error("Failed to open settings hub", error);
    }
  }

  async show(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });

    const guild = interaction.guild;
    const L = tOf(guild ? (guild.id as GuildId) : null);

    if (!guild) {
      await interaction.editReply({
        ...v2Error(L.settings.title, L.common.guildOnly),
      });
      return;
    }

    const config = await this.guildService.getById(guild.id as GuildId);
    if (!config) {
      await interaction.editReply({
        ...v2Error(L.settings.title, L.settings.needBasic),
      });
      return;
    }

    // Only managers may open the settings hub.
    const member = interaction.member;
    if (
      !(member instanceof GuildMember) ||
      !member.permissions.has(PermissionFlagsBits.ManageGuild)
    ) {
      await interaction.editReply({
        ...(await v2ActionFor(
          guild,
          interaction.user.id,
          L.settings.title,
          L.common.noPerms,
        )),
      });
      return;
    }

    await interaction.editReply({
      components: [this.buildHub(config)],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  }

  /** Language switcher handler. */
  async handleLanguage(
    interaction: StringSelectMenuInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const member = interaction.member;
      if (
        !(member instanceof GuildMember) ||
        !member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return;
      }

      const guild = interaction.guild;
      if (!guild || interaction.values.length === 0) return;

      const value = interaction.values[0];
      if (value !== "ru" && value !== "en") return;

      await this.locale.set(guild.id as GuildId, value as Locale);

      // Re-render in the NEW locale.
      const config = await this.guildService.getById(guild.id as GuildId);
      if (!config) return;

      const L = tOf(guild.id as GuildId);
      await interaction.editReply({
        components: [
          this.buildLanguage(
            config,
            format(L.settings.flashLangSet, { lang: L.meta.name }),
          ),
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });

      // Full sync: published panel + every active room's voice menu
      // are rebuilt in the new language.
      await this.setupService.refreshPanel(guild);
      await svc()
        .voiceStateHandler.applyControlMode(
          guild,
          this.controlSettings.get(guild.id as GuildId).mode,
        )
        .catch((e) => this.logger.warn("Failed to re-sync control panels", e));
    } catch (error) {
      this.logger.error("Failed to set language", error);
    }
  }

  async handlePack(
    interaction: import("discord.js").StringSelectMenuInteraction,
  ): Promise<void> {
    await this.applyChange(interaction, (config, value) => {
      config.iconPack = value as GuildConfig["iconPack"];
    });
  }

  async handleTemplate(
    interaction: import("discord.js").StringSelectMenuInteraction,
  ): Promise<void> {
    await this.applyChange(interaction, (config, value) => {
      config.template = value;
    });
  }

  async handlePreset(
    interaction: import("discord.js").StringSelectMenuInteraction,
  ): Promise<void> {
    await this.applyChange(interaction, (config, value) => {
      const preset = ICON_COLOR_PRESETS[value];
      if (preset) {
        config.iconColors = { ...preset };
      }
    });
  }

  async handleGlobal(
    interaction: import("discord.js").StringSelectMenuInteraction,
  ): Promise<void> {
    await this.applyChange(interaction, (config, value) => {
      for (const key of Object.keys(config.iconColors)) {
        config.iconColors[key as keyof IconColors] = value;
      }
    });
  }

  async handleControlMode(
    interaction: StringSelectMenuInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const member = interaction.member;
      if (
        !(member instanceof GuildMember) ||
        !member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return;
      }

      const guild = interaction.guild;
      if (!guild || interaction.values.length === 0) return;

      const mode = interaction.values[0];
      if (mode !== "both" && mode !== "voice" && mode !== "chat") return;

      await this.controlSettings.set(guild.id as GuildId, {
        mode: mode as "both" | "voice" | "chat",
      });

      // Apply to live rooms right away:
      // voice → paired chats are deleted; chat/both → created and filled.
      await svc()
        .voiceStateHandler.applyControlMode(
          guild,
          mode as "both" | "voice" | "chat",
        )
        .catch((e) =>
          this.logger.warn("Failed to apply control mode to live rooms", e),
        );

      const config = await this.guildService.getById(guild.id as GuildId);
      if (!config) return;

      await interaction.editReply({
        components: [
          this.buildControl(
            config,
            tOf(guild.id as GuildId).settings.flashModeChanged,
          ),
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      this.logger.error("Failed to set control mode", error);
    }
  }

  async handleInstantDeleteToggle(
    interaction: ButtonInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const member = interaction.member;
      if (
        !(member instanceof GuildMember) ||
        !member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return;
      }

      const guild = interaction.guild;
      if (!guild) return;

      const current = this.controlSettings.get(guild.id as GuildId);
      await this.controlSettings.set(guild.id as GuildId, {
        instantDelete: !current.instantDelete,
      });

      const config = await this.guildService.getById(guild.id as GuildId);
      if (!config) return;

      await interaction.editReply({
        components: [
          this.buildControl(
            config,
            current.instantDelete
              ? tOf(guild.id as GuildId).settings.flashInstantOff
              : tOf(guild.id as GuildId).settings.flashInstantOn,
          ),
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      this.logger.error("Failed to toggle instant delete", error);
    }
  }

  /**
   * Toggles whether the rooms category is visible/joinable by @everyone
   * or restricted to roles. Applies the overwrite change immediately.
   */
  async handlePublicCategoryToggle(
    interaction: ButtonInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const member = interaction.member;
      if (
        !(member instanceof GuildMember) ||
        !member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return;
      }

      const guild = interaction.guild;
      if (!guild) return;

      const guildId = guild.id as GuildId;
      const current = this.controlSettings.get(guildId);
      const makePublic = !current.publicCategory;
      await this.controlSettings.set(guildId, { publicCategory: makePublic });

      // Apply to the existing category right away.
      const config = await this.guildService.getById(guildId);
      if (config?.categoryId) {
        const category = await guild.channels
          .fetch(config.categoryId)
          .catch(() => null);
        if (category?.type === 4) {
          const cat = category as import("discord.js").CategoryChannel;
          await cat.permissionOverwrites
            .edit(
              guild.roles.everyone,
              makePublic
                ? { ViewChannel: null, Connect: null }
                : { ViewChannel: false, Connect: false },
            )
            .catch(() => undefined);
          // The bot must keep access to its own channels when hiding.
          if (!makePublic && guild.members.me) {
            await cat.permissionOverwrites
              .edit(guild.members.me, {
                ViewChannel: true,
                Connect: true,
                MoveMembers: true,
              })
              .catch(() => undefined);
          }
        }
      }
      if (!config) return;

      await interaction.editReply({
        components: [
          this.buildControl(
            config,
            makePublic
              ? tOf(guild.id as GuildId).settings.flashPublicOn
              : tOf(guild.id as GuildId).settings.flashPublicOff,
          ),
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      this.logger.error("Failed to toggle public category", error);
    }
  }

  async handleLogsToggle(
    interaction: import("discord.js").ButtonInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const member = interaction.member;
      if (
        !(member instanceof GuildMember) ||
        !member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return;
      }

      const guild = interaction.guild;
      if (!guild) return;

      const config = await this.guildService.getById(guild.id as GuildId);
      if (!config) return;

      const L = tOf(config.guildId);

      if (config.logChannelId) {
        const logChannel = await guild.channels
          .fetch(config.logChannelId)
          .catch(() => null);

        if (logChannel) {
          await logChannel.delete().catch(() => null);
        }

        await this.guildService.update(config.guildId, {
          logChannelId: null,
        });

        const updated = await this.guildService.getById(config.guildId);
        if (!updated) return;

        await interaction.editReply({
          components: [
            this.buildControl(updated, L.settings.flashLogCleared),
          ],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      } else {
        await interaction.editReply({
          components: [
            this.buildControl(
              config,
              L.settings.flashLogCleared,
            ),
          ],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }
    } catch (error) {
      this.logger.error("Failed to toggle logs", error);
    }
  }

  async applyChange(
    interaction: StringSelectMenuInteraction,
    mutator: (config: GuildConfig, value: string) => void,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const member = interaction.member;
      if (
        !(member instanceof GuildMember) ||
        !member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return;
      }

      const guild = interaction.guild;
      if (!guild || interaction.values.length === 0) return;

      const value = interaction.values[0];
      if (!value) return;

      const config = await this.guildService.getById(guild.id as GuildId);
      if (!config) return;

      mutator(config, value);

      await this.guildService.update(guild.id as GuildId, {
        iconPack: config.iconPack,
        iconColors: config.iconColors,
        template: config.template,
        accentColor: config.accentColor,
      });

      const isTemplate = interaction.customId.startsWith("setup:tpl");

      if (isTemplate) {
        // Design changes render instantly — no emoji pipeline involved.
        const view = await this.buildDesign(config);
        await interaction.editReply({
          components: view.components,
          files: view.files,
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
        await this.setupService.refreshPanel(guild);
        return;
      }

      const total = EMOJI_KEYS.length;
      const Lp = tOf(guild.id as GuildId);
      const progress = (done: number) =>
        format(Lp.settings.uploading, {
          done,
          total,
          percent: Math.round((done / total) * 100),
        });

      await interaction.editReply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              format(Lp.settings.applying, { done: 0, total }),
            ),
          ),
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });

      await this.guildEmojis.ensureForConfig(
        config.iconColors,
        async (done, _t) => {
          await interaction.editReply({
            components: [
              new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(progress(done)),
              ),
            ],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          });
        },
      );

      await interaction.editReply({
        components: [this.buildIcons(config)],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });

      await this.setupService.refreshPanel(guild);
    } catch (error) {
      this.logger.error("Failed to apply icon setting", error);
    }
  }

  /**
   * Re-renders the design view into an existing ephemeral reply,
   * optionally confirming what just changed.
   */
  async renderDesignInto(
    interaction: Pick<import("discord.js").ButtonInteraction, "editReply">,
    guild: Guild,
    flash?: string,
  ): Promise<void> {
    const config = await this.guildService.getById(guild.id as GuildId);
    if (!config) return;

    const view = await this.buildDesign(config, flash);
    await interaction.editReply({
      components: view.components,
      files: view.files,
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  }

  async handleChannelsCategory(
    interaction: import("discord.js").ChannelSelectMenuInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const member = interaction.member;
      if (
        !(member instanceof GuildMember) ||
        !member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return;
      }

      const guild = interaction.guild;
      if (!guild) return;

      const config = await this.guildService.getById(guild.id as GuildId);
      if (!config) return;

      const categoryId =
        interaction.values.length > 0 ? interaction.values[0] : null;

      await this.guildService.update(config.guildId, { categoryId });

      const L = tOf(config.guildId);
      const updated = await this.guildService.getById(config.guildId);
      if (!updated) return;

      await interaction.editReply({
        components: [
          this.buildChannels(
            updated,
            L.settings.flashCategorySet,
          ),
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      this.logger.error("Failed to update category", error);
    }
  }

  async handleChannelsCreator(
    interaction: import("discord.js").ChannelSelectMenuInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const member = interaction.member;
      if (
        !(member instanceof GuildMember) ||
        !member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return;
      }

      const guild = interaction.guild;
      if (!guild) return;

      const config = await this.guildService.getById(guild.id as GuildId);
      if (!config) return;

      const creatorChannelId =
        interaction.values.length > 0 ? interaction.values[0] : null;

      await this.guildService.update(config.guildId, { creatorChannelId });

      const L = tOf(config.guildId);
      const updated = await this.guildService.getById(config.guildId);
      if (!updated) return;

      await interaction.editReply({
        components: [
          this.buildChannels(
            updated,
            L.settings.flashCreatorSet,
          ),
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      this.logger.error("Failed to update creator channel", error);
    }
  }

  async handleChannelsLog(
    interaction: import("discord.js").ChannelSelectMenuInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const member = interaction.member;
      if (
        !(member instanceof GuildMember) ||
        !member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return;
      }

      const guild = interaction.guild;
      if (!guild) return;

      const config = await this.guildService.getById(guild.id as GuildId);
      if (!config) return;

      const logChannelId =
        interaction.values.length > 0 ? interaction.values[0] : null;

      await this.guildService.update(config.guildId, { logChannelId });

      const L = tOf(config.guildId);
      const updated = await this.guildService.getById(config.guildId);
      if (!updated) return;

      // Send "logs active" confirmation to the log channel
      if (logChannelId) {
        const logCh = await guild.channels.fetch(logChannelId).catch(() => null);
        if (logCh?.isTextBased()) {
          const container = new ContainerBuilder()
            .setAccentColor(0x57f287)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                [
                  "## 📋 Логи активированы",
                  `> <@${interaction.user.id}>`,
                  "",
                  "Все события комнат будут записываться сюда.",
                ].join("\n"),
              ),
            );

          await logCh
            .send({
              flags: 32768,
              components: [container],
              allowedMentions: { parse: [] },
            })
            .catch(() => null);
        }
      }

      await interaction.editReply({
        components: [
          this.buildChannels(
            updated,
            logChannelId
              ? L.settings.flashLogSet
              : L.settings.flashLogCleared,
          ),
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      this.logger.error("Failed to update log channel", error);
    }
  }
}
