import { existsSync, readFileSync } from "node:fs";
import { join, basename as pathBasename } from "node:path";
import type { GuildConfig } from "@room-manager/contracts";
import { DEFAULT_ICON_COLORS } from "@room-manager/contracts";
import type { GuildService, RoomService } from "@room-manager/core";
import type { Logger } from "@room-manager/logger";
import type { GuildId } from "@room-manager/shared";
import type {
  CategoryChannel,
  Client,
  CommandInteraction,
  Guild,
  TextChannel,
  VoiceChannel,
} from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Message,
  MessageFlags,
} from "discord.js";
import { EMOJI_ACTIONS, EmojiLoader } from "../discord/EmojiLoader";
import { actorAvatarUrl, v2Action, v2Error } from "../discord/V2";
import { format, tOf } from "../i18n";
import type {
  EmojiKey as AppEmojiAction,
  AppEmojiService,
} from "./AppEmojiService";
import type { BannerService } from "./BannerService";
import type { PanelTextService } from "./PanelTextService";
import { svc } from "./registry";
import { TemplateService } from "./TemplateService";

const PANEL_BUTTONS: Array<{
  action: string;
  customId: string;
  label: string;
  row: number;
}> = [
  // Row 1
  { action: "limit", customId: "room:limit", label: "Лимит", row: 0 },
  { action: "lock", customId: "room:lock", label: "Закрыть", row: 0 },
  { action: "unlock", customId: "room:unlock", label: "Открыть", row: 0 },
  {
    action: "removeAccess",
    customId: "room:access:remove",
    label: "Забрать доступ",
    row: 0,
  },
  {
    action: "addAccess",
    customId: "room:access:add",
    label: "Выдать доступ",
    row: 0,
  },
  // Row 2
  { action: "rename", customId: "room:rename", label: "Название", row: 1 },
  { action: "owner", customId: "room:owner", label: "Передать", row: 1 },
  { action: "kick", customId: "room:kick", label: "Выгнать", row: 1 },
  { action: "mute", customId: "room:mute", label: "Мут", row: 1 },
  { action: "unmute", customId: "room:unmute", label: "Вернуть звук", row: 1 },
];

export class SetupService {
  private readonly emojiLoader: EmojiLoader;
  private readonly templates: TemplateService = new TemplateService();

  constructor(
    private readonly logger: Logger,
    private readonly guildService: GuildService,
    private readonly roomService: RoomService,
    private readonly client: Client,
    private readonly bannerService: BannerService,
    private readonly guildEmojis: AppEmojiService,
    private readonly panelText: PanelTextService,
  ) {
    this.emojiLoader = new EmojiLoader();
  }

  async handleSetup(
    interaction: CommandInteraction,
    options: {
      category?: CategoryChannel | null;
      hub?: VoiceChannel | null;
      panel?: TextChannel | null;
    },
  ): Promise<void> {
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    try {
      if (!interaction.guild) {
        await interaction.editReply({
          ...v2Error(
            "Настройка",
            "Эту команду можно использовать только на сервере.",
          ),
        });
        return;
      }

      const payload = await this.setup(interaction.guild, {
        ...options,
        actorId: interaction.user.id,
      });

      await interaction.editReply({ ...payload });
    } catch (error) {
      this.logger.error("Failed to run setup", error);
      await interaction.editReply({
        ...v2Error(
          "Настройка",
          "Произошла ошибка при настройке. Попробуйте ещё раз.",
        ),
      });
    }
  }

  async setup(
    guild: Guild,
    options: {
      category?: CategoryChannel | null;
      hub?: VoiceChannel | null;
      panel?: TextChannel | null;
      actorId?: string;
    },
  ): Promise<ReturnType<typeof v2Action>> {
    this.logger.info(`Running setup for guild ${guild.id}`);

    const existing = await this.guildService.getById(guild.id as GuildId);

    const config: GuildConfig = existing ?? {
      guildId: guild.id as GuildId,
      enabled: true,
      categoryId: null,
      creatorChannelId: null,
      panelChannelId: null,
      panelMessageId: null,
      defaultUserLimit: 0,
      deleteDelaySeconds: 30,
      creationCooldownSeconds: 5,
      accentColor: 0x2b2d31,
      bannerUrl: null,
      iconPack: "niako",
      iconColors: { ...DEFAULT_ICON_COLORS },
      template: "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (options.category) {
      config.categoryId = options.category.id;
    }
    if (options.hub) {
      config.creatorChannelId = options.hub.id;
    }
    if (options.panel) {
      config.panelChannelId = options.panel.id;
    }

    const ensured = await this.ensureChannels(guild, config);

    config.categoryId = ensured.categoryId;
    config.creatorChannelId = ensured.creatorChannelId;
    config.panelChannelId = ensured.panelChannelId;

    // Critical: a fresh guild has NO row yet — update() would silently
    // affect zero rows and every later /setup would recreate channels.
    if (existing) {
      await this.guildService.update(guild.id as GuildId, config);
    } else {
      await this.guildService.create(config);
    }

    await this.publishPanel(guild, config);

    const _status = (created: boolean): string =>
      created ? "создан" : "найден";

    const Ls = tOf(guild.id);
    const stateOf = (created: boolean): string =>
      created ? Ls.setup.created : Ls.setup.found;

    return v2Action({
      title: Ls.setup.doneTitle,
      actorId: options.actorId ?? null,
      text: Ls.setup.doneText,
      details: [
        format(Ls.setup.category, {
          channel: `<#${ensured.categoryId}>`,
          state: stateOf(ensured.createdCategory),
        }),
        format(Ls.setup.creator, {
          channel: `<#${ensured.creatorChannelId}>`,
          state: stateOf(
            ensured.creatorChannelId ? ensured.createdCreator : false,
          ),
        }),
        format(Ls.setup.panelChannel, {
          channel: `<#${ensured.panelChannelId}>`,
          state: stateOf(ensured.createdPanel),
        }),
        Ls.setup.hintSettings,
      ],
      avatarUrl:
        options.actorId != null
          ? await actorAvatarUrl(guild, options.actorId)
          : (this.client.user?.displayAvatarURL({
              extension: "png",
              size: 128,
            }) ?? null),
    });
  }

  private async fetchExistingChannel(
    guild: Guild,
    channelId: string | null,
  ): Promise<boolean> {
    if (!channelId) return false;
    try {
      const channel = await guild.channels.fetch(channelId);
      return channel !== null;
    } catch {
      return false;
    }
  }

  private async ensureChannels(
    guild: Guild,
    config: GuildConfig,
  ): Promise<{
    categoryId: string | null;
    creatorChannelId: string | null;
    panelChannelId: string | null;
    createdCategory: boolean;
    createdCreator: boolean;
    createdPanel: boolean;
  }> {
    // Reuse stored channels only if they still exist on the server.
    let categoryId = (await this.fetchExistingChannel(guild, config.categoryId))
      ? config.categoryId
      : null;
    let creatorChannelId = (await this.fetchExistingChannel(
      guild,
      config.creatorChannelId,
    ))
      ? config.creatorChannelId
      : null;
    let panelChannelId = (await this.fetchExistingChannel(
      guild,
      config.panelChannelId,
    ))
      ? config.panelChannelId
      : null;

    const createdCategory = !categoryId;
    const createdCreator = !creatorChannelId;
    const createdPanel = !panelChannelId;

    if (!categoryId) {
      const category = await guild.channels.create({
        name: "Приватные комнаты",
        type: 4,
      });

      // Privacy model lives on the CATEGORY; rooms sync to it.
      const isPublic = svc().controlSettings.get(
        guild.id as GuildId,
      ).publicCategory;
      await category.permissionOverwrites.edit(
        guild.roles.everyone,
        isPublic
          ? { ViewChannel: null, Connect: null }
          : { ViewChannel: false, Connect: false },
      );
      if (!isPublic && guild.members.me) {
        // The bot must keep access to its own channels.
        await category.permissionOverwrites.edit(guild.members.me, {
          ViewChannel: true,
          Connect: true,
          MoveMembers: true,
        });
      }
      categoryId = category.id;
      this.logger.info(`Created category: ${categoryId}`);
    }

    if (!creatorChannelId) {
      const creatorChannel = await guild.channels.create({
        name: "➕ Создать комнату",
        type: 2,
        parent: categoryId,
      });
      creatorChannelId = creatorChannel.id;
      this.logger.info(`Created creator channel: ${creatorChannelId}`);
    }

    // Sync category permissions with role policy (denied roles get
    // ViewChannel+Connect denied on the category).
    await this.syncCategoryPermissions(guild);

    if (!panelChannelId) {
      const panelChannel = await guild.channels.create({
        name: "💬-управление-комнатами",
        type: 0,
        parent: categoryId,
      });
      panelChannelId = panelChannel.id;
      this.logger.info(`Created panel channel: ${panelChannelId}`);
    }

    return {
      categoryId,
      creatorChannelId,
      panelChannelId,
      createdCategory,
      createdCreator,
      createdPanel,
    };
  }

  /**
   * Syncs the rooms category with the current role policy.
   * Denied roles from the `createRoom` policy get ViewChannel+Connect denied.
   * Called after role policy changes and on initial setup.
   */
  async syncCategoryPermissions(guild: Guild): Promise<void> {
    const config = await this.guildService.getById(guild.id as GuildId);
    if (!config?.categoryId) return;

    const raw = await guild.channels.fetch(config.categoryId).catch(() => null);
    if (raw?.type !== 4) return;
    const category = raw;

    const rp = svc().rolePolicy;
    const cfg = rp.getConfig(guild.id as GuildId);
    const policy = cfg.policies.createRoom;
    const groups = cfg.groups;

    // Expand denied groups into concrete role IDs
    const deniedRoleIds = [
      ...policy.denyRoles,
      ...policy.denyGroups.flatMap((g) => groups[g] ?? []),
    ];

    // Apply ViewChannel+Connect deny for each denied role
    for (const roleId of deniedRoleIds) {
      await category.permissionOverwrites
        .edit(roleId, { ViewChannel: false, Connect: false })
        .catch((e: unknown) =>
          this.logger.warn(`Failed to deny role ${roleId} on category`, e),
        );
    }

    // Remove stale overwrites: roles that were previously denied but no longer are
    const currentOverwrites = [...category.permissionOverwrites.cache.values()];
    for (const ow of currentOverwrites) {
      if (
        ow.type === 0 && // Role overwrite
        ow.id !== guild.id && // Not @everyone
        ow.id !== guild.members.me?.id && // Not the bot
        ow.deny.has("ViewChannel") &&
        ow.deny.has("Connect") &&
        !deniedRoleIds.includes(ow.id)
      ) {
        await category.permissionOverwrites
          .delete(ow.id)
          .catch(() => undefined);
      }
    }

    this.logger.info(
      `Synced category permissions: ${deniedRoleIds.length} denied roles`,
    );
  }

  async refreshPanel(guild: Guild): Promise<void> {
    try {
      const config = await this.guildService.getById(guild.id as GuildId);
      if (config?.panelChannelId) {
        await this.publishPanel(guild, config);
      }
    } catch (error) {
      this.logger.warn("Failed to refresh panel", error);
    }
  }

  /**
   * Makes sure the control-panel channel (💬-управление-комнатами)
   * exists and the panel message is published. Used when the user
   * switches the control mode to chat/both.
   */
  async syncControlPanelChannel(guild: Guild): Promise<void> {
    const config = await this.guildService.getById(guild.id as GuildId);
    if (!config) return;

    const ensured = await this.ensureChannels(guild, config);
    config.categoryId = ensured.categoryId;
    config.creatorChannelId = ensured.creatorChannelId;
    config.panelChannelId = ensured.panelChannelId;

    await this.guildService.update(guild.id as GuildId, {
      categoryId: config.categoryId,
      creatorChannelId: config.creatorChannelId,
      panelChannelId: config.panelChannelId,
    });

    await this.publishPanel(guild, config);
  }

  /**
   * Deletes the control-panel channel entirely (Управление → «Только
   * канал»): rooms are then managed only via the in-voice menu.
   */
  async removePanelChannel(guild: Guild): Promise<void> {
    const config = await this.guildService.getById(guild.id as GuildId);
    if (!config?.panelChannelId) return;

    const channel = await guild.channels
      .fetch(config.panelChannelId)
      .catch(() => null);

    if (channel) {
      await channel
        .delete()
        .catch((e) => this.logger.warn("Failed to delete panel channel", e));
      this.logger.info(`Deleted panel channel ${config.panelChannelId}`);
    }

    await this.guildService.update(guild.id as GuildId, {
      panelChannelId: null,
      panelMessageId: null,
    });
  }

  async publishPanel(guild: Guild, config: GuildConfig): Promise<void> {
    if (!config.panelChannelId) {
      throw new Error("Panel channel ID is not set in config");
    }

    const panelChannel = (await guild.channels.fetch(
      config.panelChannelId,
    )) as TextChannel | null;

    if (!panelChannel?.isTextBased()) {
      throw new Error("Panel channel is not a text channel");
    }

    // Refresh custom emoji availability
    const guildEmojis = await guild.emojis.fetch();
    this.emojiLoader.refreshAvailableEmoji(
      guildEmojis.map((e) => ({ id: e.id, name: e.name })),
    );

    if (config.panelMessageId) {
      try {
        const existingMessage = await panelChannel.messages.fetch(
          config.panelMessageId,
        );
        await this.editPanelMessage(existingMessage, config, guild.id);
        return;
      } catch {
        this.logger.info(
          `Panel message ${config.panelMessageId} not found, creating a new one`,
        );
      }
    }

    const newMessage = await this.createPanelMessage(
      panelChannel,
      config,
      guild.id,
    );
    await this.guildService.update(guild.id as GuildId, {
      panelMessageId: newMessage.id,
    });

    // Lazy emoji pipeline: upload missing colored emojis in background,
    // then refresh the panel once so buttons pick up the new emoji ids.
    void this.guildEmojis
      .ensureForConfig(config.iconColors)
      .then((uploaded) => (uploaded > 0 ? this.refreshPanel(guild) : undefined))
      .catch((e) => this.logger.warn("emoji ensure failed", e));
  }

  private async createPanelMessage(
    channel: TextChannel,
    config: GuildConfig,
    guildId: string,
  ): Promise<Message> {
    const payload = await this.buildPanelPayload(config, guildId);
    const components = this.createPanelComponents(config);
    const attachments = this.bannerService.resolveBannerAttachments(config);

    const message = await channel.send({
      ...(payload.embed ? { embeds: [payload.embed] } : {}),
      components,
      files: [
        ...attachments.map((a) => ({
          attachment: a.attachment,
          name: a.name,
        })),
        ...payload.files,
      ],
    });

    this.logger.info(`Created panel message: ${message.id}`);
    return message;
  }

  private async editPanelMessage(
    message: Message,
    config: GuildConfig,
    guildId: string,
  ): Promise<void> {
    const payload = await this.buildPanelPayload(config, guildId);
    const components = this.createPanelComponents(config);
    const attachments = this.bannerService.resolveBannerAttachments(config);

    await message.edit({
      ...(payload.embed ? { embeds: [payload.embed] } : { embeds: [] }),
      components,
      files: [
        ...attachments.map((a) => ({
          attachment: a.attachment,
          name: a.name,
        })),
        ...payload.files,
      ],
    });

    this.logger.info(`Edited panel message: ${message.id}`);
  }

  /**
   * Builds the panel payload according to the guild's template:
   * - minimal template without text overrides → pure image, no embed;
   * - otherwise → embed with template/custom title and description
   *   plus the banner (user banner > template image > default gif).
   */
  private async buildPanelPayload(
    config: GuildConfig,
    guildId: string,
  ): Promise<{
    embed: EmbedBuilder | null;
    files: Array<{ attachment: Buffer; name: string }>;
  }> {
    const rooms = await this.roomService.getByGuildId(
      guildId as import("@room-manager/shared").GuildId,
    );
    const activeCount = rooms.filter((r) => r.state === "active").length;

    // Resolve the template in the guild's language.
    const locale = svc().locale.get(config.guildId);
    const tpl = this.templates.get(config.template ?? "default", locale);
    const minimal = this.templates.isMinimal(config.template ?? "default");

    // Custom panel text (Дизайн → Текст панели) overrides the template.
    const custom = this.panelText.get(config.guildId);
    const title = custom.title || tpl.title || "";
    const description = custom.description || tpl.description || "";
    const hasText = Boolean(title || description);

    // Pure image mode: minimal layout, no text, no footer — just the picture.
    if (minimal && !hasText) {
      return { embed: null, files: await this.collectBannerFiles(config, tpl) };
    }

    const footerData: import("discord.js").EmbedFooterData = {
      text: format(tOf(config.guildId as GuildId).panel.footerActive, {
        count: activeCount,
      }),
    };
    const avatar = this.client.user?.displayAvatarURL();
    if (avatar) {
      footerData.iconURL = avatar;
    }

    const embed = new EmbedBuilder().setColor(
      minimal ? 0x2b2d31 : config.accentColor,
    );

    // discord.js rejects empty strings — set only when non-empty.
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);

    if (!minimal) embed.setFooter(footerData);

    const { files, imageAttachmentName, imageUrl } = await this.resolveBanner(
      config,
      tpl,
    );

    if (imageAttachmentName) {
      embed.setImage(`attachment://${imageAttachmentName}`);
    } else if (imageUrl) {
      embed.setImage(imageUrl);
    }

    if (tpl.showList) {
      const Lp = tOf(config.guildId as GuildId);
      const labels: Record<string, string> = {
        limit: Lp.panel.actLimit,
        lock: Lp.panel.actLock,
        unlock: Lp.panel.actUnlock,
        removeAccess: Lp.panel.actRevoke,
        addAccess: Lp.panel.actGrant,
        rename: Lp.panel.actRename,
        owner: Lp.panel.actOwner,
        kick: Lp.panel.actKick,
        mute: Lp.panel.actMute,
        unmute: Lp.panel.actUnmute,
      };
      const line = (action: string): string => {
        const color =
          config.iconColors[action as keyof typeof config.iconColors] ??
          "default";
        const app = this.guildEmojis.resolveAny(action, color);
        if (app) {
          return `<:${app.name}:${app.id}> — ${labels[action] ?? action}`;
        }

        const def = EMOJI_ACTIONS.find((a) => a.action === action);
        return `${def?.unicodeFallback ?? "?"} — ${labels[action] ?? action}`;
      };

      const row1 = [
        line("limit"),
        line("lock"),
        line("unlock"),
        line("removeAccess"),
        line("addAccess"),
      ].join("\n");

      const row2 = [
        line("rename"),
        line("owner"),
        line("kick"),
        line("mute"),
        line("unmute"),
      ].join("\n");

      embed.addFields(
        { name: "\u200b", value: row1, inline: true },
        { name: "\u200b", value: row2, inline: true },
      );
    }

    return { embed, files };
  }

  /**
   * Resolves the panel banner with priority:
   * user banner > template image (file or url) > default gif.
   */
  private async resolveBanner(
    config: GuildConfig,
    tpl: ReturnType<TemplateService["get"]>,
  ): Promise<{
    files: Array<{ attachment: Buffer; name: string }>;
    imageAttachmentName: string | null;
    imageUrl: string | null;
  }> {
    if (config.bannerUrl) {
      const bannerState = this.bannerService.getBannerState(config);
      if (bannerState.type === "uploaded") {
        // Uploaded banners ride along as attachments; resolveBannerAttachments
        // is merged by the caller, so only reference the name here.
        return {
          files: [],
          imageAttachmentName: config.bannerUrl,
          imageUrl: null,
        };
      }
      return {
        files: [],
        imageAttachmentName: null,
        imageUrl: bannerState.displayUrl,
      };
    }

    if (tpl.image?.file) {
      const filePath = join(process.cwd(), "assets", "panel", tpl.image.file);
      if (existsSync(filePath)) {
        const fname = pathBasename(filePath);
        return {
          files: [{ attachment: readFileSync(filePath), name: fname }],
          imageAttachmentName: fname,
          imageUrl: null,
        };
      }
    }

    if (tpl.image?.url) {
      return { files: [], imageAttachmentName: null, imageUrl: tpl.image.url };
    }

    const bannerState = this.bannerService.getBannerState(config);
    return {
      files: [],
      imageAttachmentName: null,
      imageUrl: bannerState.displayUrl,
    };
  }

  /**
   * Files to attach when the panel renders without an embed
   * (uploaded user banners are merged by the caller).
   * Remote banners (URL/default gif) are downloaded so the
   * pure-image panel still shows a picture.
   */
  private async collectBannerFiles(
    config: GuildConfig,
    tpl: ReturnType<TemplateService["get"]>,
  ): Promise<Array<{ attachment: Buffer; name: string }>> {
    const { files, imageAttachmentName, imageUrl } = await this.resolveBanner(
      config,
      tpl,
    );
    const out = [...files];

    if (out.length === 0 && !imageAttachmentName && imageUrl) {
      const ext =
        [".gif", ".png", ".jpg", ".jpeg", ".webp"].find((e) =>
          imageUrl.toLowerCase().includes(e),
        ) ?? ".png";
      try {
        const res = await fetch(imageUrl);
        if (res.ok) {
          out.push({
            attachment: Buffer.from(await res.arrayBuffer()),
            name: `banner${ext}`,
          });
        }
      } catch (e) {
        this.logger.warn("Failed to download remote panel banner", e);
      }
    }

    return out;
  }

  private createPanelComponents(
    config: GuildConfig,
  ): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [
      new ActionRowBuilder<ButtonBuilder>(),
      new ActionRowBuilder<ButtonBuilder>(),
    ];

    for (const btn of PANEL_BUTTONS) {
      const colorName =
        config.iconColors[btn.action as keyof typeof config.iconColors] ??
        "default";

      const button = new ButtonBuilder()
        .setCustomId(btn.customId)
        .setStyle(ButtonStyle.Secondary);

      // 1) Lazily uploaded application emoji (recolorable, hash-deduped)
      const guildEmoji = this.guildEmojis.get(
        btn.action as AppEmojiAction,
        colorName,
      );

      if (guildEmoji) {
        button.setEmoji({ id: guildEmoji.id });
      } else {
        const def = EMOJI_ACTIONS.find((a) => a.action === btn.action);
        button.setEmoji(def?.unicodeFallback ?? "❓");
      }
      const row = rows[btn.row];
      if (row) {
        row.addComponents(button);
      }
    }

    return rows;
  }
}
