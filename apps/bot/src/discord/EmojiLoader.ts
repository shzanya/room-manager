import { existsSync } from "node:fs";
import { join } from "node:path";
import type { IconPackName } from "@room-manager/contracts";
import type { APIPartialEmoji } from "discord.js";

export interface EmojiAction {
  action: string;
  customEmojiName: string;
  customEmojiId: string;
  unicodeFallback: string;
}

export const EMOJI_ACTIONS: EmojiAction[] = [
  {
    action: "limit",
    customEmojiName: "NK_RoomLimit",
    customEmojiId: "1476337864420888626",
    unicodeFallback: "\uD83D\uDC65",
  },
  {
    action: "lock",
    customEmojiName: "NK_RoomLock",
    customEmojiId: "1476337866467578017",
    unicodeFallback: "\uD83D\uDD12",
  },
  {
    action: "unlock",
    customEmojiName: "NK_RoomUnlock",
    customEmojiId: "1476337931378626634",
    unicodeFallback: "\uD83D\uDD13",
  },
  {
    action: "removeAccess",
    customEmojiName: "NK_RoomRemoveUser",
    customEmojiId: "1476337874881478821",
    unicodeFallback: "\uD83D\uDC64",
  },
  {
    action: "addAccess",
    customEmojiName: "NK_RoomAddUser",
    customEmojiId: "1476337833206878421",
    unicodeFallback: "\uD83D\uDC64",
  },
  {
    action: "rename",
    customEmojiName: "NK_RoomRename",
    customEmojiId: "1476337928903983239",
    unicodeFallback: "\u270F\uFE0F",
  },
  {
    action: "owner",
    customEmojiName: "NK_RoomCrown",
    customEmojiId: "1476337834645262346",
    unicodeFallback: "\uD83D\uDC51",
  },
  {
    action: "kick",
    customEmojiName: "NK_RoomKick",
    customEmojiId: "1476337839720501420",
    unicodeFallback: "\uD83D\uDEAA",
  },
  {
    action: "mute",
    customEmojiName: "NK_RoomMute",
    customEmojiId: "1476337870015823972",
    unicodeFallback: "\uD83D\uDD07",
  },
  {
    action: "unmute",
    customEmojiName: "NK_RoomUnmute",
    customEmojiId: "1476337933047955650",
    unicodeFallback: "\uD83D\uDD0A",
  },
];

export interface ResolvedEmoji {
  apiEmoji: APIPartialEmoji | null;

  unicode: string;

  display: string;
}

export class EmojiLoader {
  private readonly packsPath: string;
  private readonly customEmojiAvailable: Map<string, boolean> = new Map();

  constructor(assetsPath?: string) {
    const base = assetsPath ?? join(process.cwd(), "assets");
    this.packsPath = join(base, "emojis", "packs");
  }

  refreshAvailableEmoji(availableEmojis: Array<{ id: string; name: string }>): void {
    this.customEmojiAvailable.clear();
    for (const emoji of availableEmojis) {
      this.customEmojiAvailable.set(emoji.id, true);
    }
  }

  hasEmoji(emojiId: string): boolean {
    return this.customEmojiAvailable.has(emojiId);
  }

  resolve(action: string, pack: IconPackName, color: string): ResolvedEmoji {
    const def = EMOJI_ACTIONS.find((a) => a.action === action);
    if (!def) {
      return {
        apiEmoji: null,
        unicode: "❓",
        display: "❓",
      };
    }

    if (pack === "custom") {
      return this.resolveCustom(action, color, def);
    }

    return this.resolveBuiltin(def);
  }

  private resolveBuiltin(def: EmojiAction): ResolvedEmoji {
    const isAvailable = this.customEmojiAvailable.has(def.customEmojiId);

    if (isAvailable) {
      return {
        apiEmoji: {
          name: def.customEmojiName,
          id: def.customEmojiId,
          animated: false,
        },
        unicode: def.unicodeFallback,
        display: `<:${def.customEmojiName}:${def.customEmojiId}>`,
      };
    }

    return {
      apiEmoji: null,
      unicode: def.unicodeFallback,
      display: def.unicodeFallback,
    };
  }

  private resolveCustom(action: string, color: string, def: EmojiAction): ResolvedEmoji {
    const colorSlug = this.colorToSlug(color);
    const filePath = join(this.packsPath, "custom", action, `${colorSlug}.png`);

    if (existsSync(filePath)) {
      return {
        apiEmoji: null,
        unicode: def.unicodeFallback,
        display: def.unicodeFallback,
      } as ResolvedEmoji;
    }

    return this.resolveBuiltin(def);
  }

  private colorToSlug(color: string): string {
    if (color.startsWith("#")) {
      return `hex-${color.slice(1).toLowerCase()}`;
    }
    return color.toLowerCase();
  }

  getCustomEmojiPath(action: string, color: string): string | null {
    const colorSlug = this.colorToSlug(color);
    const filePath = join(this.packsPath, "custom", action, `${colorSlug}.png`);
    return existsSync(filePath) ? filePath : null;
  }

  getAvailablePacks(): IconPackName[] {
    const packs: IconPackName[] = ["classic", "minimal", "niako"];

    const customDir = join(this.packsPath, "custom");
    if (existsSync(customDir)) {
      packs.push("custom");
    }

    return packs;
  }
}
