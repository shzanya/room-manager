/** The 10 room actions available in the in-voice management select menu. */
export interface VCOption {
  value: string;
  emoji: string;
  label: string;
  /** Canonical icon action key used by AppEmojiService. */
  iconAction?: string;
}

export const VC_SELECT_OPTIONS: VCOption[] = [
  {
    value: "rename",
    emoji: "✏️",
    label: "Изменить название",
    iconAction: "rename",
  },
  { value: "limit", emoji: "👥", label: "Изменить лимит", iconAction: "limit" },
  { value: "lock", emoji: "🔒", label: "Закрыть комнату", iconAction: "lock" },
  {
    value: "unlock",
    emoji: "🔓",
    label: "Открыть комнату",
    iconAction: "unlock",
  },
  { value: "wl", emoji: "👤", label: "Вайтлист", iconAction: "removeAccess" },
  {
    value: "owner",
    emoji: "👑",
    label: "Передать владельца",
    iconAction: "owner",
  },
  {
    value: "kick",
    emoji: "🚪",
    label: "Выгнать из комнаты",
    iconAction: "kick",
  },
  {
    value: "mutes",
    emoji: "🔇",
    label: "Управление мутами",
    iconAction: "mute",
  },
  // Labels are rewritten at send time to reflect the current state
  // ("Саундпад: разрешён / запрещён") by VoiceStateHandler.
  {
    value: "soundpad",
    emoji: "🔊",
    label: "Саундпад",
    iconAction: "soundpad",
  },
  {
    value: "activities",
    emoji: "🎮",
    label: "Активности",
    iconAction: "activities",
  },
];

export const USER_ACTIONS = new Set(["kick"]);

/** Map vc-action values to the canonical icon action keys used everywhere. */
export const VC_TO_ICON_ACTION: Record<string, string> = {
  rename: "rename",
  limit: "limit",
  lock: "lock",
  unlock: "unlock",
  wl: "removeAccess",
  owner: "owner",
  kick: "kick",
  mutes: "mute",
  soundpad: "soundpad",
  activities: "activities",
};
