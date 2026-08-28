import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "@room-manager/logger";
import type { GuildId } from "@room-manager/shared";
import type { Locale } from "../i18n";

type StoreFile = Record<string, Locale>;

/** Per-guild UI language, stored in data/locales.json. */
export class LocaleService {
  private store: StoreFile = {};
  private readonly storeFile: string;

  constructor(private readonly logger: Logger) {
    const dataDir = join(process.cwd(), "..", "..", "data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    this.storeFile = join(dataDir, "locales.json");
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
      this.logger.warn("Failed to save locale store", e);
    }
  }

  get(guildId: GuildId): Locale {
    const value = this.store[guildId];
    return value === "en" ? "en" : "ru";
  }

  set(guildId: GuildId, locale: Locale): void {
    this.store[guildId] = locale;
    this.save();
  }
}
