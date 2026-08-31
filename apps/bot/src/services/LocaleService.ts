import type { GuildSettingsRepository } from "@room-manager/database";
import type { GuildId } from "@room-manager/shared";
import type { Locale } from "../i18n";

/**
 * Synchronous reads (in-memory cache) + async writes (PG).
 */
export class LocaleService {
  private cache = new Map<string, Locale>();

  constructor(private readonly settingsRepo: GuildSettingsRepository) {}

  get(guildId: GuildId): Locale {
    return this.cache.get(guildId) ?? "ru";
  }

  async set(guildId: GuildId, locale: Locale): Promise<void> {
    this.cache.set(guildId, locale);
    await this.settingsRepo.updatePartial(guildId, { locale });
  }

  hydrate(guildId: GuildId, raw: string | null | undefined): void {
    this.cache.set(guildId, raw === "en" ? "en" : "ru");
  }
}
