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

export class ControlSettingsService {
  private cache = new Map<string, ControlSettings>();

  constructor(private readonly settingsRepo: GuildSettingsRepository) {}

  async preloadAll(): Promise<void> {}

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

  hydrate(guildId: GuildId, raw: Record<string, unknown>): void {
    this.cache.set(guildId, { ...DEFAULTS, ...raw } as ControlSettings);
  }
}
