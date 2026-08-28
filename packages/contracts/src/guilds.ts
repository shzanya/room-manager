import type { GuildId } from "@room-manager/shared";

export type IconColorName =
  | "default"
  | "white"
  | "gray"
  | "black"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "purple"
  | "pink";

export type IconPackName = "classic" | "minimal" | "niako" | "custom";

export interface IconColors {
  limit: string;
  lock: string;
  unlock: string;
  removeAccess: string;
  addAccess: string;
  rename: string;
  owner: string;
  kick: string;
  mute: string;
  unmute: string;

  /** Room-scoped toggles (chat control). */
  soundpad: string;
  activities: string;
}

export const DEFAULT_ICON_COLORS: IconColors = {
  limit: "default",
  lock: "default",
  unlock: "default",
  removeAccess: "default",
  addAccess: "default",
  rename: "default",
  owner: "default",
  kick: "default",
  mute: "default",
  unmute: "default",
  soundpad: "default",
  activities: "default",
};

export const ICON_COLOR_PRESETS: Record<string, IconColors> = {
  default: { ...DEFAULT_ICON_COLORS },
  rainbow: {
    limit: "red",
    lock: "orange",
    unlock: "yellow",
    removeAccess: "green",
    addAccess: "cyan",
    rename: "blue",
    owner: "purple",
    kick: "pink",
    mute: "red",
    unmute: "green",
    soundpad: "green",
    activities: "green",
  },
  traffic: {
    limit: "yellow",
    lock: "red",
    unlock: "green",
    removeAccess: "red",
    addAccess: "green",
    rename: "yellow",
    owner: "green",
    kick: "red",
    mute: "red",
    unmute: "green",
    soundpad: "green",
    activities: "green",
  },
  discord: {
    limit: "blue",
    lock: "blue",
    unlock: "blue",
    removeAccess: "blue",
    addAccess: "blue",
    rename: "blue",
    owner: "blue",
    kick: "blue",
    mute: "blue",
    unmute: "blue",
    soundpad: "blue",
    activities: "blue",
  },
  monochrome: {
    limit: "white",
    lock: "white",
    unlock: "white",
    removeAccess: "white",
    addAccess: "white",
    rename: "white",
    owner: "white",
    kick: "white",
    mute: "white",
    unmute: "white",
    soundpad: "white",
    activities: "white",
  },
};

export const ICON_COLOR_HEX: Record<string, string> = {
  white: "#FFFFFF",
  gray: "#9CA3AF",
  black: "#111827",
  red: "#EF4444",
  orange: "#F97316",
  yellow: "#EAB308",
  green: "#22C55E",
  cyan: "#06B6D4",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  pink: "#EC4899",
};

export interface GuildConfig {
  guildId: GuildId;

  enabled: boolean;

  categoryId: string | null;
  creatorChannelId: string | null;
  panelChannelId: string | null;
  panelMessageId: string | null;

  defaultUserLimit: number;
  deleteDelaySeconds: number;
  creationCooldownSeconds: number;

  /** Accent color for embeds, used in the panel and other messages. */
  accentColor: number;

  /** Optional banner image URL for the panel embed. */
  bannerUrl: string | null;

  /** Icon pack name: classic, minimal, niako, or custom. */
  iconPack: IconPackName;

  /** Per-action icon color configuration. Keys are action names, values are color names or hex strings. */
  iconColors: IconColors;

  /** Panel template name (see apps/bot/assets/templates). */
  template: string;

  createdAt: Date;
  updatedAt: Date;
}
