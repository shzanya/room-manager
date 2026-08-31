import type { GuildService, RoomLifecycleService } from "@room-manager/core";
import type { Logger } from "@room-manager/logger";
import type { ChannelId, GuildId, UserId } from "@room-manager/shared";
import {
  ActionRowBuilder,
  ContainerBuilder,
  type Guild,
  type GuildMember,
  PermissionFlagsBits,
  SectionBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type VoiceChannel,
  type VoiceState,
} from "discord.js";
import { VC_SELECT_OPTIONS, VC_TO_ICON_ACTION } from "./discord/vcActions";
import { format, tOf } from "./i18n";
import type { RoomChannelService } from "./RoomChannelService";
import type { RoomCleanupService } from "./RoomCleanupService";
import type { RoomCreationPolicy } from "./RoomCreationPolicy";
import type { AppEmojiService } from "./services/AppEmojiService";
import type { MutesRegistry } from "./services/MutesRegistry";
import { svc } from "./services/registry";

/** Permission bits per Discord API overwrite hierarchy:
 *  UseSoundboard = 1n<<42n, UseExternalSounds = 1n<<45n,
 *  UseEmbeddedActivities = 1n<<39n. */
const BIT_SOUNDBOARD_USE = PermissionFlagsBits.UseSoundboard;
const BIT_SOUNDBOARD_EXTERNAL = PermissionFlagsBits.UseExternalSounds;
const BIT_ACTIVITIES = PermissionFlagsBits.UseEmbeddedActivities;

function hasEveryoneDeny(channel: VoiceChannel, bit: bigint): boolean {
  const everyone = channel.guild.roles.everyone;
  const cur = channel.permissionOverwrites.cache.get(everyone.id);
  if (!cur) return false;
  return cur.deny.has(bit);
}

function isSoundboardDenied(channel: VoiceChannel): boolean {
  return (
    hasEveryoneDeny(channel, BIT_SOUNDBOARD_USE) ||
    hasEveryoneDeny(channel, BIT_SOUNDBOARD_EXTERNAL)
  );
}

export class VoiceStateHandler {
  private readonly logger: Logger;

  /** Icon colors of the last-seen config, used for select menu emojis. */
  private currentIconColors: Record<string, string> = {};

  /** Debounce timers for panel refresh per guild. */
  private readonly panelRefreshTimers = new Map<GuildId, ReturnType<typeof setTimeout>>();

  private get appEmojis(): AppEmojiService {
    return svc().appEmojis;
  }

  public constructor(
    private readonly guilds: GuildService,
    private readonly rooms: RoomLifecycleService,
    private readonly channels: RoomChannelService,
    private readonly cleanup: RoomCleanupService,
    private readonly creationPolicy: RoomCreationPolicy,
    logger: Logger,
  ) {
    this.logger = logger;
  }

  /** Debounced panel refresh — coalesces rapid state changes per guild. */
  private refreshPanel(guildId: GuildId): void {
    const existing = this.panelRefreshTimers.get(guildId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.panelRefreshTimers.delete(guildId);
      const guild = svc().client.guilds.cache.get(guildId);
      if (guild) {
        svc().setupService.refreshPanel(guild).catch(() => undefined);
      }
    }, 2000);
    this.panelRefreshTimers.set(guildId, timer);
  }

  public async handle(
    oldState: VoiceState,
    newState: VoiceState,
  ): Promise<void> {
    if (oldState.channelId === newState.channelId) {
      return;
    }

    if (newState.channelId) {
      await this.handleJoin(newState);
    }

    if (oldState.channelId) {
      await this.handleLeave(oldState);
    }
  }

  private async handleJoin(state: VoiceState): Promise<void> {
    const guild = state.guild;
    const channelId = state.channelId;

    if (!guild || !channelId) {
      return;
    }

    const existingRoom = await this.rooms.getByChannelId(
      channelId as ChannelId,
    );

    if (existingRoom) {
      await this.handleManagedRoomJoin(existingRoom.id, existingRoom.state);

      if (existingRoom.state === "active" && state.member) {
        await svc().logService.send(guild, guild.id as GuildId, {
          type: "join",
          userId: state.member.id,
        });
      }

      this.refreshPanel(guild.id as GuildId);

      return;
    }

    const config = await this.guilds.getById(guild.id as GuildId);

    if (!config?.enabled || !config.creatorChannelId) {
      return;
    }

    if (channelId !== config.creatorChannelId) {
      return;
    }

    const member = state.member;

    if (!member) {
      return;
    }

    // Owner rejoined the hub: send them back to their previous room
    // (active or cooldown) instead of creating yet another room.
    // This check MUST run before role policy — owners always rejoin.
    const owned = await this.rooms.getLatestOwned(
      guild.id as GuildId,
      member.id as UserId,
    );

    if (owned) {
      const channel = await guild.channels
        .fetch(owned.channelId)
        .catch(() => null);

      if (channel?.isVoiceBased()) {
        if (owned.state === "cooldown") {
          await this.cleanup.cancel(owned.id);
          await this.rooms.activate(owned.id);
          this.refreshPanel(guild.id as GuildId);
        }

        try {
          await member.voice.setChannel(channel);
          this.logger.info(
            `Returned owner ${member.user.tag} to room ${owned.id}`,
          );
        } catch (error) {
          this.logger.warn(`Failed to return owner to room ${owned.id}`, error);
        }
        return;
      }
    }

    if (!(await this.creationPolicy.canCreate(guild.id as GuildId))) {
      this.logger.info(
        `Room creation ignored for guild ${guild.id}: creation cooldown active`,
      );
      return;
    }

    await this.creationPolicy.startCooldown(
      guild.id as GuildId,
      config.creationCooldownSeconds,
    );

    await this.createRoom(
      guild.id as GuildId,
      member,
      config.categoryId,
      config.defaultUserLimit,
    );
  }

  private async handleManagedRoomJoin(
    roomId: import("@room-manager/shared").RoomId,
    state: "active" | "cooldown" | "deleting",
  ): Promise<void> {
    switch (state) {
      case "cooldown": {
        await this.cleanup.cancel(roomId);

        await this.rooms.activate(roomId);

        this.logger.info(`Room ${roomId} restored from cooldown`);

        return;
      }

      case "active": {
        return;
      }

      case "deleting": {
        this.logger.warn(
          `Ignoring join for room ${roomId}: deletion already started`,
        );
        return;
      }

      default: {
        return;
      }
    }
  }

  private async handleLeave(state: VoiceState): Promise<void> {
    const channelId = state.channelId;

    if (!channelId) {
      return;
    }

    const room = await this.rooms.getByChannelId(channelId as ChannelId);

    if (room?.state !== "active") {
      return;
    }

    const channel = state.channel;

    if (!channel) {
      return;
    }

    if (channel.members.size > 0) {
      return;
    }

    const guild = state.guild;

    if (!guild) {
      return;
    }

    await this.rooms.startCooldown(room.id);

    await svc().logService.send(guild, guild.id as GuildId, {
      type: "leave",
      userId: state.id,
    });

    const guildConfig = await this.guilds.getById(guild.id as GuildId);
    const controlSettings = svc().controlSettings.get(guild.id as GuildId);
    const deleteDelay = guildConfig?.deleteDelaySeconds ?? 5;
    const instant = controlSettings?.instantDelete ?? false;

    try {
      await this.cleanup.schedule(
        room.id,
        guild.id as GuildId,
        room.channelId as ChannelId,
        deleteDelay,
        instant,
      );
    } catch (error) {
      this.logger.error("Failed to schedule room cleanup", error);
    }

    this.logger.info(`Room ${room.id} entered cooldown`);

    this.refreshPanel(guild.id as GuildId);
  }

  private async createRoom(
    guildId: GuildId,
    member: GuildMember,
    categoryId: string | null,
    userLimit: number,
  ): Promise<void> {
    // Room name uses the server nickname, not the raw username.
    const name = format(tOf(guildId).roomName.template, {
      name: member.displayName,
    });

    const control = svc().controlSettings.get(guildId);

    const voice = await this.channels.create(
      member.guild,
      name,
      categoryId,
      userLimit,
    );

    // Owner gets full control of their room (category denies @everyone).
    await voice.permissionOverwrites
      .edit(member.id, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
        UseSoundboard: true,
        UseExternalSounds: true,
        UseEmbeddedActivities: true,
        UseVAD: true,
        MuteMembers: true,
        DeafenMembers: true,
        MoveMembers: true,
        PrioritySpeaker: true,
      })
      .catch(() => undefined);

    let roomId: import("@room-manager/shared").RoomId | undefined;

    try {
      const room = await this.rooms.createForOwner(
        guildId,
        voice.id as ChannelId,
        member.id as UserId,
        name,
        userLimit,
      );

      roomId = room.id;

      try {
        await member.voice.setChannel(voice);
      } catch (error) {
        await this.rooms.destroy(room.id).catch(() => undefined);
        await this.channels.delete(voice).catch(() => undefined);
        throw error;
      }

      this.logger.info(`Created room ${room.id} for ${member.user.tag}`);

      await svc().logService.send(member.guild, guildId, {
        type: "created",
        actorId: member.id,
        details: [room.name],
      });

      this.refreshPanel(guildId);
    } catch (error) {
      if (!roomId) {
        await this.channels.delete(voice).catch(() => undefined);
      }
      throw error;
    }

    // In-voice select menu is posted unless the mode is chat-only.
    // The owner is pinged ONCE — only on this fresh panel — so they
    // notice that room management exists.
    if (control.mode !== "chat") {
      await this.sendVoiceControlPanel(voice, member, true);
    }
  }

  /**
   * Applies a new control mode. The button panel (💬-управление-комнатами)
   * and the in-voice select menu exist exactly where the mode allows:
   * - voice → in-voice menu only; the panel channel is DELETED;
   * - chat  → panel channel with buttons only; in-voice menus removed;
   * - both  → both surfaces.
   */
  public async applyControlMode(
    guild: Guild,
    mode: "both" | "voice" | "chat",
  ): Promise<void> {
    // 1) In-voice menus for live rooms.
    const rooms = await svc().roomService.getByGuildId(
      guild.id as import("@room-manager/shared").GuildId,
    );
    const active = rooms.filter((r) => r.state === "active");

    for (const room of active) {
      const ch = await guild.channels.fetch(room.channelId).catch(() => null);
      if (!ch?.isVoiceBased() || ch.type === 13) continue; // skip stages
      const voice = ch as VoiceChannel;

      if (mode === "chat") {
        await this.deleteVoiceControlMessages(voice);
        continue;
      }

      // Repost cleanly — never leave a stale/duplicated menu behind.
      await this.deleteVoiceControlMessages(voice);

      const owner = await guild.members.fetch(room.ownerId).catch(() => null);
      if (!owner) continue;

      await this.sendVoiceControlPanel(voice, owner);
    }

    // 2) Panel channel (💬-управление-комнатами).
    if (mode === "voice") {
      await svc().setupService.removePanelChannel(guild);
    } else {
      await svc().setupService.syncControlPanelChannel(guild);
    }
  }

  /** Deletes the bot's old control-panel messages from a voice channel. */
  private async deleteVoiceControlMessages(voice: VoiceChannel): Promise<void> {
    try {
      const msgs = await voice.messages.fetch({ limit: 50 });
      for (const [, m] of msgs) {
        if (m.author.id !== voice.client.user?.id) continue;
        // Panels are Components-V2 containers — search the raw payload.
        if (JSON.stringify(m.components).includes("room:vc:manage")) {
          await m.delete().catch(() => undefined);
        }
      }
    } catch (error) {
      this.logger.warn("Failed to clean voice control messages", error);
    }
  }

  /**
   * Posts a Components V2 control message into the room's voice channel:
   * header with avatar thumbnail + one select menu for all room actions.
   */
  private async sendVoiceControlPanel(
    voiceChannel: VoiceChannel,
    member: GuildMember,
    ping = false,
  ): Promise<void> {
    const channel = voiceChannel;
    try {
      // Cache icon colors so select options use the guild's emoji variants.
      const cfg = await this.guilds.getById(
        member.guild.id as import("@room-manager/shared").GuildId,
      );
      if (cfg) {
        this.currentIconColors = { ...cfg.iconColors };
      }

      const L = tOf(member.guild.id);

      const text = new TextDisplayBuilder().setContent(
        [
          `# ${L.controlPanel.title}`,
          format(L.controlPanel.hint, { mention: `<@${member.id}>` }),
        ].join("\n"),
      );

      const section = new SectionBuilder()
        .addTextDisplayComponents(text)
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(
            member.displayAvatarURL({ extension: "png", size: 128 }),
          ),
        );

      const container = new ContainerBuilder().addSectionComponents(section);

      const optionLabels: Record<string, string> = {
        rename: L.controlPanel.optRename,
        limit: L.controlPanel.optLimit,
        lock: L.controlPanel.optLock,
        unlock: L.controlPanel.optUnlock,
        wl: L.controlPanel.optWl,
        owner: L.controlPanel.optOwner,
        kick: L.controlPanel.optKick,
        mutes: L.controlPanel.optMutes,
      };

      const options = VC_SELECT_OPTIONS.map((o) => {
        const iconAction = VC_TO_ICON_ACTION[o.value] ?? o.value;
        const color = this.currentIconColors?.[iconAction] ?? "default";
        const app = this.appEmojis.resolveAny(iconAction, color);

        const option = new StringSelectMenuOptionBuilder()
          .setLabel(optionLabels[o.value] ?? o.label)
          .setValue(o.value);
        if (app) {
          option.setEmoji({ id: app.id });
        } else {
          option.setEmoji(o.emoji);
        }

        // Soundpad/Activities show the ACTION that selecting performs.
        if (o.value === "soundpad") {
          option.setLabel(
            isSoundboardDenied(voiceChannel)
              ? L.soundpad.allowLabel
              : L.soundpad.denyLabel,
          );
        }
        if (o.value === "activities") {
          const deniedA = hasEveryoneDeny(voiceChannel, BIT_ACTIVITIES);
          option.setLabel(
            deniedA ? L.activities.allowLabel : L.activities.denyLabel,
          );
        }
        return option;
      });

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("room:vc:manage")
          .setPlaceholder(L.controlPanel.placeholder)
          .addOptions(options),
      );

      container.addActionRowComponents(row);

      await channel.send({
        flags: 32768,
        components: [container],
        allowedMentions: ping ? { users: [member.id] } : { parse: [] },
      });
    } catch (error) {
      this.logger.warn("Failed to send voice control panel", error);
    }
  }
}
