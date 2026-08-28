import type { GuildConfig, IconColors } from "@room-manager/contracts";
import { DEFAULT_ICON_COLORS } from "@room-manager/contracts";
import type { GuildId } from "@room-manager/shared";

import type { guilds } from "../schema";

type GuildRow = typeof guilds.$inferSelect;

function parseIconColors(raw: string | null): IconColors {
  if (!raw || raw === "{}") {
    return { ...DEFAULT_ICON_COLORS };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<IconColors>;
    return { ...DEFAULT_ICON_COLORS, ...parsed };
  } catch {
    return { ...DEFAULT_ICON_COLORS };
  }
}

export function mapGuildConfig(row: GuildRow): GuildConfig {
  return {
    guildId: row.guildId as GuildId,

    enabled: row.enabled,

    categoryId: row.categoryId,
    creatorChannelId: row.creatorChannelId,
    panelChannelId: row.panelChannelId,
    panelMessageId: row.panelMessageId,

    defaultUserLimit: row.defaultUserLimit,
    deleteDelaySeconds: row.deleteDelaySeconds,
    creationCooldownSeconds: row.creationCooldownSeconds,
    accentColor: row.accentColor,
    bannerUrl: row.bannerUrl,

    iconPack: (row.iconPack as GuildConfig["iconPack"]) ?? "niako",
    iconColors: parseIconColors(row.iconColors),
    template: row.template ?? "default",

    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export function serializeIconColors(colors: IconColors): string {
  return JSON.stringify(colors);
}
