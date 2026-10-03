import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { ICON_COLOR_HEX, type IconColors } from "@room-manager/contracts";
import type { AppEmojiCacheRepository } from "@room-manager/database";
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

export class AppEmojiService {
  private cache = new Map<string, CacheEntry>();
  private readonly legacyEmojisDir: string;
  private readonly inflight = new Map<string, Promise<CacheEntry | null>>();
  private emojiCacheFetched = false;

  constructor(
    private readonly logger: Logger,
    private readonly uploader: EmojiUploader,
    private readonly client: Client,
    private readonly emojiRepo: AppEmojiCacheRepository,
  ) {
    const local = join(process.cwd(), "assets", "emojis");
    this.legacyEmojisDir = existsSync(local)
      ? local
      : join(process.cwd(), "apps", "bot", "assets", "emojis");
  }

  private async loadCache(): Promise<void> {
    try {
      const loaded = await this.emojiRepo.getAll();
      for (const [key, value] of loaded) {
        this.cache.set(key, value);
      }
    } catch {
      this.cache.clear();
    }
  }

  private async saveEntry(name: string, entry: CacheEntry): Promise<void> {
    this.cache.set(name, entry);
    try {
      await this.emojiRepo.set(name, { id: entry.id, name: entry.name ?? name, hash: entry.hash });
    } catch (e) {
      this.logger.warn(`Failed to save emoji cache entry to PG: ${name}`, e);
    }
  }

  private async ensureDiscordCacheFetched(): Promise<void> {
    if (this.emojiCacheFetched) return;
    await this.client.application?.emojis.fetch();
    this.emojiCacheFetched = true;
  }

  private async ensureCacheLoaded(): Promise<void> {
    if (this.cache.size > 0) return;
    await this.loadCache();
  }

  get(action: EmojiKey, color: string): (CacheEntry & { name: string }) | null {
    const key = this.nameOf(action, color);
    const entry = this.cache.get(key);
    if (!entry) return null;
    return { ...entry, name: entry.name ?? key };
  }

  resolve(action: EmojiKey, color: string): { id: string; name: string } | null {
    const entry = this.get(action, color);
    if (!entry) return null;
    return { id: entry.id, name: entry.name };
  }

  resolveAny(action: string, color: string): { id: string; name: string } | null {
    return this.resolve(action as EmojiKey, color);
  }

  private nameOf(action: EmojiKey, color: string): string {
    return `rm_${action}_${colorSlug(color)}`.toLowerCase();
  }

  private packDirs(): string[] {
    const packsDir = join(this.legacyEmojisDir, "packs");
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
    const bases = [action, SOURCE_FILE[action]].filter(
      (v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i,
    );
    const dirs = [...this.packDirs(), this.legacyEmojisDir];
    for (const dir of dirs) {
      for (const base of bases) {
        for (const ext of [".webp", ".png"]) {
          const p = join(dir, `${base}${ext}`);
          if (existsSync(p)) return readFileSync(p);
        }
      }
    }
    return null;
  }

  private async normalizeToPng(source: Buffer): Promise<Buffer> {
    const image = await loadImage(source);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    return canvas.toBuffer("image/png");
  }

  async ensureOne(action: EmojiKey, color: string): Promise<CacheEntry | null> {
    await this.ensureDiscordCacheFetched();
    await this.ensureCacheLoaded();

    const name = this.nameOf(action, color);
    const cached = this.cache.get(name);
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

    const hash = createHash("md5").update(source).update(color.toLowerCase()).digest("hex");

    const cached = this.cache.get(name);
    if (cached && cached.hash === hash && app.emojis.cache.has(cached.id)) {
      return cached;
    }

    for (const [otherName, entry] of this.cache) {
      if (entry.hash === hash && otherName !== name) {
        await this.saveEntry(name, entry);
        return entry;
      }
    }

    try {
      const stale = app.emojis.cache.find((e) => e.name === name);
      if (stale) await stale.delete().catch(() => undefined);

      const created = await app.emojis.create({ attachment: buffer, name });
      const entry: CacheEntry = { id: created.id, name, hash };
      await this.saveEntry(name, entry);
      this.logger.info(`Uploaded application emoji ${name} (${created.id})`);
      return entry;
    } catch (error) {
      this.logger.warn(`Failed to upload application emoji ${name}`, error);
      return null;
    }
  }

  async syncDefaults(): Promise<number> {
    const defaults = Object.fromEntries(EMOJI_KEYS.map((k) => [k, "default"]));
    return this.ensureForConfig(defaults);
  }

  async ensureForConfig(
    iconColors: IconColors | Record<string, string>,
    onProgress?: (done: number, total: number) => void | Promise<void>,
  ): Promise<number> {
    const colors = iconColors as Record<string, string>;
    const total = EMOJI_KEYS.length;
    let done = 0;
    const before = this.cache.size;

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

    return this.cache.size - before;
  }
}
