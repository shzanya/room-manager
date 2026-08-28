import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "@room-manager/logger";
import type { GuildId } from "@room-manager/shared";

/** Where the room control panel lives. */
export type ControlMode = "both" | "voice" | "chat";

export interface ControlSettings {
  mode: ControlMode;
  instantDelete: boolean;
  publicCategory: boolean;
}

type StoreFile = Record<string, Partial<ControlSettings>>;

const DEFAULTS: ControlSettings = {
  mode: "both",
  instantDelete: false,
  publicCategory: false,
};

/**
 * Per-guild room-control preferences stored in data/control-settings.json
 * (same pattern as the emoji cache / panel text store):
 * - where the control panel lives (voice channel, room chat, or both)
 * - instant room deletion without the cooldown delay.
 */
export class ControlSettingsService {
  private store: StoreFile = {};
  private readonly storeFile: string;

  constructor(private readonly logger: Logger) {
    const dataDir = join(process.cwd(), "..", "..", "data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    this.storeFile = join(dataDir, "control-settings.json");
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
      this.logger.warn("Failed to save control settings store", e);
    }
  }

  get(guildId: GuildId): ControlSettings {
    return { ...DEFAULTS, ...this.store[guildId] };
  }

  set(guildId: GuildId, patch: Partial<ControlSettings>): void {
    this.store[guildId] = { ...this.get(guildId), ...patch };
    this.save();
  }
}
