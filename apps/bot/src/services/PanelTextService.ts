import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "@room-manager/logger";
import type { GuildId } from "@room-manager/shared";

export interface PanelText {
  /** Custom panel title (empty string resets to template). */
  title: string | null;
  /** Custom panel description (empty string resets to template). */
  description: string | null;
}

type StoreFile = Record<string, PanelText>;

/**
 * Per-guild panel text overrides (title/description), stored in
 * data/panel-text.json — same pattern as the emoji cache.
 * Keeps templates intact: an override simply replaces the template's text.
 */
export class PanelTextService {
  private store: StoreFile = {};
  private readonly storeFile: string;

  constructor(private readonly logger: Logger) {
    const dataDir = join(process.cwd(), "..", "..", "data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    this.storeFile = join(dataDir, "panel-text.json");
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.storeFile)) {
        this.store = JSON.parse(readFileSync(this.storeFile, "utf8"));
      }
    } catch {
      this.store = {};
    }
  }

  private save(): void {
    try {
      writeFileSync(this.storeFile, JSON.stringify(this.store));
    } catch (e) {
      this.logger.warn("Failed to save panel text store", e);
    }
  }

  get(guildId: GuildId): PanelText {
    return this.store[guildId] ?? { title: null, description: null };
  }

  set(
    guildId: GuildId,
    patch: Partial<Pick<PanelText, "title" | "description">>,
  ): void {
    const current = this.get(guildId);
    this.store[guildId] = { ...current, ...patch };
    this.save();
  }

  reset(guildId: GuildId): void {
    delete this.store[guildId];
    this.save();
  }

  /** Whether any override exists for the guild. */
  hasOverride(guildId: GuildId): boolean {
    const t = this.store[guildId];
    return Boolean(t && (t.title || t.description));
  }
}
