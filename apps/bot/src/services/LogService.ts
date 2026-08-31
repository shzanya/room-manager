import type { GuildService } from "@room-manager/core";
import type { Logger } from "@room-manager/logger";
import type { GuildId } from "@room-manager/shared";
import type { Guild } from "discord.js";
import { actorAvatarUrl, v2Log } from "../discord/V2";

export interface LogEvent {
  type: string;
  userId?: string;
  actorId?: string;
  roomId?: string;
  details?: string[];
}

export class LogService {
  public constructor(
    private readonly guilds: GuildService,
    private readonly logger: Logger,
  ) {}

  async send(guild: Guild, guildId: GuildId, event: LogEvent): Promise<void> {
    try {
      const config = await this.guilds.getById(guildId);
      if (!config?.logChannelId) return;

      const logChannel = await guild.channels
        .fetch(config.logChannelId)
        .catch(() => null);

      if (!logChannel?.isTextBased()) return;

      const { title, subtitle } = this.format(event);
      const avatarUrl = event.actorId
        ? await actorAvatarUrl(guild, event.actorId)
        : null;

      const payload = v2Log({
        title,
        subtitle,
        details: event.details,
        avatarUrl,
      });

      await logChannel.send({
        ...payload,
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      this.logger.warn("Failed to send log event", error);
    }
  }

  private format(event: LogEvent): { title: string; subtitle: string; details?: string[] } {
    const actor = event.actorId ? `<@${event.actorId}>` : "";
    const target = event.userId ? `<@${event.userId}>` : "";

    switch (event.type) {
      case "created":
        return {
          title: "Комната создана",
          subtitle: actor,
          details: event.details,
        };
      case "deleted":
        return {
          title: "Комната удалена",
          subtitle: "",
          details: event.details,
        };
      case "join":
        return {
          title: "Участник зашёл",
          subtitle: target,
          details: [],
        };
      case "leave":
        return {
          title: "Участник вышел",
          subtitle: target,
          details: [],
        };
      case "lock":
        return {
          title: "Комната закрыта",
          subtitle: actor,
          details: [],
        };
      case "unlock":
        return {
          title: "Комната открыта",
          subtitle: actor,
          details: [],
        };
      case "kick":
        return {
          title: "Участник кикнут",
          subtitle: `${actor} выгнал ${target}`,
          details: [],
        };
      case "mute":
        return {
          title: "Мут",
          subtitle: `${actor} замутил ${target}`,
          details: [],
        };
      case "unmute":
        return {
          title: "Размут",
          subtitle: `${actor} размутил ${target}`,
          details: [],
        };
      case "limit":
        return {
          title: "Лимит изменён",
          subtitle: actor,
          details: event.details,
        };
      case "rename":
        return {
          title: "Комната переименована",
          subtitle: `${actor} изменил название`,
          details: event.details,
        };
      case "transfer":
        return {
          title: "Права переданы",
          subtitle: `${actor} передал права ${target}`,
          details: [],
        };
      case "soundboard":
        return {
          title: "Soundboard",
          subtitle: actor,
          details: event.details,
        };
      case "activities":
        return {
          title: "Активности",
          subtitle: actor,
          details: event.details,
        };
      case "whitelist":
        return {
          title: "Белый список",
          subtitle: `${actor} ${event.details?.[0] ?? ""} ${target}`.trim(),
          details: event.details?.slice(1),
        };
      case "logs":
        return {
          title: "Логи",
          subtitle: actor,
          details: event.details,
        };
      default:
        return {
          title: event.type,
          subtitle: actor,
          details: event.details,
        };
    }
  }
}
