import type { GuildSettingsRepository } from "@room-manager/database";
import type { GuildId } from "@room-manager/shared";

export interface PanelText {
  title: string | null;
  description: string | null;
}

const EMPTY: PanelText = { title: null, description: null };

export class PanelTextService {
  private cache = new Map<string, PanelText>();

  constructor(private readonly settingsRepo: GuildSettingsRepository) {}

  get(guildId: GuildId): PanelText {
    return this.cache.get(guildId) ?? { ...EMPTY };
  }

  async set(
    guildId: GuildId,
    patch: Partial<Pick<PanelText, "title" | "description">>,
  ): Promise<void> {
    const current = this.get(guildId);
    const merged = { ...current, ...patch };
    this.cache.set(guildId, merged);
    await this.settingsRepo.updatePartial(guildId, {
      panelText: merged as unknown as Record<string, unknown>,
    });
  }

  async reset(guildId: GuildId): Promise<void> {
    this.cache.delete(guildId);
    await this.settingsRepo.updatePartial(guildId, {
      panelText: { title: null, description: null },
    });
  }

  hasOverride(guildId: GuildId): boolean {
    const t = this.cache.get(guildId);
    return Boolean(t && (t.title || t.description));
  }

  hydrate(guildId: GuildId, raw: Record<string, unknown>): void {
    this.cache.set(guildId, {
      title: (raw.title as string | null) ?? null,
      description: (raw.description as string | null) ?? null,
    });
  }
}
