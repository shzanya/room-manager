import type { GuildService, RoomService } from "@room-manager/core";
import type { GuildRepository, RoomRepository } from "@room-manager/database";
import type { Logger } from "@room-manager/logger";
import type { Client } from "discord.js";
import type { RoomCleanupService } from "../RoomCleanupService";
import type { VoiceStateHandler } from "../VoiceStateHandler";
import type { AppEmojiService } from "./AppEmojiService";
import type { BannerService } from "./BannerService";
import type { ControlSettingsService } from "./ControlSettingsService";
import type { EmojiUploader } from "./EmojiUploader";
import type { IconSettingsService } from "./IconSettingsService";
import type { LocaleService } from "./LocaleService";
import type { PanelTextService } from "./PanelTextService";
import type { RolePolicyService } from "./RolePolicyService";
import type { SetupService } from "./SetupService";

export interface BotServices {
  logger: Logger;
  client: Client;
  guildRepository: GuildRepository;
  roomRepository: RoomRepository;
  guildService: GuildService;
  roomService: RoomService;
  bannerService: BannerService;
  panelText: PanelTextService;
  controlSettings: ControlSettingsService;
  locale: LocaleService;
  setupService: SetupService;
  iconSettings: IconSettingsService;
  emojiUploader: EmojiUploader;
  appEmojis: AppEmojiService;
  roomCleanup: RoomCleanupService;
  voiceStateHandler: VoiceStateHandler;
  rolePolicy: RolePolicyService;
}

let services: BotServices | null = null;

export function initServices(value: BotServices): void {
  services = value;
}

export function svc(): BotServices {
  if (!services) {
    throw new Error("Bot services are not initialized");
  }
  return services;
}
