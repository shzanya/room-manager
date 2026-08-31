import type { GuildSettingsRepository } from "@room-manager/database";
import type { GuildId } from "@room-manager/shared";

export type ControlMode = "both" | "voice" | "chat";

export interface ControlSettings {
  mode: ControlMode;
  instantDelete: boolean;
  publicCategory: boolean;
}

const DEFAULTS: ControlSettings = {
  mode: "both",
  instantDelete: false,
  publicCategory: false,
};

/**
 * Synchronous reads (in-memory cache) + async writes (PG).
 * Preloaded on startup via preloadAll().
 */
export class ControlSettingsService {
  private cache = new Map<string, ControlSettings>();

  constructor(private readonly settingsRepo: GuildSettingsRepository) {}

  /** Load all guilds into memory at boot. */
  async preloadAll(): Promise<void> {
    // We iterate by loading known guilds from the rooms table would be overkill.
    // Instead we just let cache miss fall back to DEFAULTS.
    // Settings are created on first write; reads always get defaults.
  }

  get(guildId: GuildId): ControlSettings {
    return this.cache.get(guildId) ?? { ...DEFAULTS };
  }

  async set(guildId: GuildId, patch: Partial<ControlSettings>): Promise<void> {
    const current = this.get(guildId);
    const merged = { ...current, ...patch };
    this.cache.set(guildId, merged);
    await this.settingsRepo.updatePartial(guildId, {
      controlSettings: merged as unknown as Record<string, unknown>,
    });
  }

  /** Hydrate from PG row (called during guild preload). */
  hydrate(guildId: GuildId, raw: Record<string, unknown>): void {
    this.cache.set(guildId, { ...DEFAULTS, ...raw } as ControlSettings);
  }
}
