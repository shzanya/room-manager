import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { ICON_COLOR_HEX, type IconColors } from "@room-manager/contracts";
import type { Logger } from "@room-manager/logger";
import type { Client } from "discord.js";
import type { EmojiUploader } from "./EmojiUploader";

export const EMOJI_KEYS = [
  "limit",
  "lock",
  "unlock",
  "removeAccess",
  "addAccess",
  "rename",
  "owner",
  "kick",
  "mute",
  "unmute",
  "soundpad",
  "activities",
] as const;

export type EmojiKey = (typeof EMOJI_KEYS)[number];

/** Base PNG (legacy flat folder / custom pack) per action. */
const SOURCE_FILE: Record<EmojiKey, string> = {
  limit: "limit",
  lock: "lock",
  unlock: "lock",
  rename: "rename",
  owner: "owner",
  kick: "kick",
  mute: "mute",
  unmute: "mute",
  removeAccess: "access",
  addAccess: "access",
  soundpad: "sounpad",
  activities: "activati",
};

interface CacheEntry {
  id: string;
  name?: string;
  hash: string;
}

type CacheFile = Record<string, CacheEntry>;

function colorSlug(color: string): string {
  return color.startsWith("#")
    ? `H${color.slice(1, 3)}${color.slice(4, 6)}`.toUpperCase()
    : color.toUpperCase();
}

function rgbOfColor(color: string): [number, number, number] | null {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ];
  }
  const hex = ICON_COLOR_HEX[color];
  if (!hex) return null;
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/**
 * Application-level emoji pipeline (Room Manager edition).
 *
 * - Emojis are uploaded to the APPLICATION (usable in every guild).
 * - Names: RM_<ACTION>_<COLOR> (e.g. RM_LIMIT_RED).
 * - Content-addressed: MD5(buffer + color) — identical pixels never
 *   re-upload, restart-safe via data/emoji-cache.json.
 * - Lazy: nothing is generated at boot; panels trigger ensure*() and
 *   refresh once uploads land.
 */
export class AppEmojiService {
  private cache: CacheFile = {};
  private readonly cacheFile: string;
  private readonly legacyEmojisDir: string;
  private readonly inflight = new Map<string, Promise<CacheEntry | null>>();
  private emojiCacheFetched = false;

  constructor(
    private readonly logger: Logger,
    private readonly uploader: EmojiUploader,
    private readonly client: Client,
  ) {
    const dataDir = join(process.cwd(), "..", "..", "data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    this.cacheFile = join(dataDir, "emoji-cache.json");
    this.legacyEmojisDir = join(process.cwd(), "assets", "emojis");
    this.loadCache();
  }

  /**
   * Discord does not populate application.emojis.cache automatically —
   * fetch it once before any existence checks.
   */
  private async ensureDiscordCacheFetched(): Promise<void> {
    if (this.emojiCacheFetched) return;
    await this.client.application?.emojis.fetch();
    this.emojiCacheFetched = true;
  }

  private loadCache(): void {
    try {
      if (existsSync(this.cacheFile)) {
        this.cache = JSON.parse(
          readFileSync(this.cacheFile, "utf8"),
        ) as CacheFile;
      }
    } catch {
      this.cache = {};
    }
  }

  private saveCache(): void {
    try {
      writeFileSync(this.cacheFile, JSON.stringify(this.cache));
    } catch (e) {
      this.logger.warn("Failed to save emoji cache", e);
    }
  }

  /** Synchronous lookup used when building panel buttons. */
  get(action: EmojiKey, color: string): (CacheEntry & { name: string }) | null {
    const key = this.nameOf(action, color);
    const entry = this.cache[key];
    if (!entry) return null;
    // Older cache entries may lack the name — it equals the key.
    return { ...entry, name: entry.name ?? key };
  }

  /**
   * Resolve an action+color into a component-usable emoji.
   * Returns uploaded application emoji when available, else null
   * (caller falls back to unicode).
   */
  resolve(
    action: EmojiKey,
    color: string,
  ): { id: string; name: string } | null {
    const entry = this.get(action, color);
    if (!entry) return null;
    return { id: entry.id, name: entry.name };
  }

  /** Same as resolve but for arbitrary string keys (embed/select reuse). */
  resolveAny(
    action: string,
    color: string,
  ): { id: string; name: string } | null {
    return this.resolve(action as EmojiKey, color);
  }

  private nameOf(action: EmojiKey, color: string): string {
    return `rm_${action}_${colorSlug(color)}`.toLowerCase();
  }

  /**
   * Every folder inside assets/emojis/packs/ is a REAL icon pack.
   * Drop a new folder there and it is picked up automatically
   * (see docs/emojis.md).
   */
  private packDirs(): string[] {
    const packsDir = join(process.cwd(), "assets", "emojis", "packs");
    try {
      if (!existsSync(packsDir)) return [];
      return readdirSync(packsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => join(packsDir, d.name));
    } catch {
      return [];
    }
  }

  private sourceBuffer(action: EmojiKey): Buffer | null {
    // Base names: key itself + mapped legacy name
    // (e.g. soundpad -> "sounpad.png" in the niako pack).
    const bases = [action, SOURCE_FILE[action]].filter(
      (v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i,
    );

    const dirs = [...this.packDirs(), this.legacyEmojisDir];

    for (const dir of dirs) {
      for (const base of bases) {
        for (const ext of [".webp", ".png"]) {
          const p = join(dir, `${base}${ext}`);
          if (existsSync(p)) {
            return readFileSync(p);
          }
        }
      }
    }

    return null;
  }

  /** Discord emojis accept png/jpeg/gif — normalize webp/anything to png. */
  private async normalizeToPng(source: Buffer): Promise<Buffer> {
    const image = await loadImage(source);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    return canvas.toBuffer("image/png");
  }

  async ensureOne(action: EmojiKey, color: string): Promise<CacheEntry | null> {
    await this.ensureDiscordCacheFetched();

    const name = this.nameOf(action, color);

    const cached = this.cache[name];
    if (cached && this.client.application?.emojis.cache.has(cached.id)) {
      return cached;
    }

    const inflight = this.inflight.get(name);
    if (inflight) return inflight;

    const task = this.uploadOne(name, action, color);
    this.inflight.set(name, task);
    try {
      return await task;
    } finally {
      this.inflight.delete(name);
    }
  }

  private async uploadOne(
    name: string,
    action: EmojiKey,
    color: string,
  ): Promise<CacheEntry | null> {
    const app = this.client.application;
    if (!app) return null;

    const source = this.sourceBuffer(action);
    if (!source) {
      this.logger.warn(`No source icon found for action "${action}"`);
      return null;
    }

    let buffer = await this.normalizeToPng(source);
    const rgb = rgbOfColor(color);
    if (rgb) {
      buffer = await this.uploader.tintBuffer(buffer, rgb[0], rgb[1], rgb[2]);
    }

    // Content address: source bytes + target color ⇒ stable hash.
    const hash = createHash("md5")
      .update(source)
      .update(color.toLowerCase())
      .digest("hex");

    const cached = this.cache[name];
    if (cached && cached.hash === hash && app.emojis.cache.has(cached.id)) {
      return cached;
    }

    // Same content under a different name → adopt instead of duplicating.
    for (const [otherName, entry] of Object.entries(this.cache)) {
      if (entry.hash === hash && otherName !== name) {
        this.cache[name] = entry;
        this.saveCache();
        return entry;
      }
    }

    try {
      // Delete stale emoji with same name but different content.
      const stale = app.emojis.cache.find((e) => e.name === name);
      if (stale) await stale.delete().catch(() => undefined);

      const created = await app.emojis.create({ attachment: buffer, name });
      const entry: CacheEntry = { id: created.id, name, hash };
      this.cache[name] = entry;
      this.saveCache();
      this.logger.info(`Uploaded application emoji ${name} (${created.id})`);
      return entry;
    } catch (error) {
      this.logger.warn(`Failed to upload application emoji ${name}`, error);
      return null;
    }
  }

  /**
   * Boot-time background sync: uploads original icons for all 10 actions
   * so buttons have real custom emojis without any manual action.
   */
  async syncDefaults(): Promise<number> {
    const defaults = Object.fromEntries(EMOJI_KEYS.map((k) => [k, "default"]));
    return this.ensureForConfig(defaults);
  }

  /**
   * Ensures all 10 action emojis for the given icon-color map.
   * Returns how many were newly uploaded.
   */
  async ensureForConfig(
    iconColors: IconColors | Record<string, string>,
    onProgress?: (done: number, total: number) => void | Promise<void>,
  ): Promise<number> {
    const colors = iconColors as Record<string, string>;
    const total = EMOJI_KEYS.length;
    let done = 0;
    const before = Object.keys(this.cache).length;

    for (const action of EMOJI_KEYS) {
      const color = colors[action] ?? "default";
      try {
        await this.ensureOne(action, color);
      } catch (e) {
        this.logger.warn(`emoji ensure failed for ${action}`, e);
      }
      done++;
      if (onProgress) await onProgress(done, total);
    }

    return Object.keys(this.cache).length - before;
  }
}
