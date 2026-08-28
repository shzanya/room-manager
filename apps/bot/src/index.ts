import "reflect-metadata";

import { dirname, importx } from "@discordx/importer";
import { loadEnv } from "@room-manager/config";
import {
  GuildService,
  RoomLifecycleService,
  RoomService,
} from "@room-manager/core";
import { GuildRepository, RoomRepository } from "@room-manager/database";
import { createLogger } from "@room-manager/logger";
import { Events, GatewayIntentBits } from "discord.js";
import { Client } from "discordx";
import { RoomChannelService } from "./RoomChannelService";
import { RoomCleanupService } from "./RoomCleanupService";
import { RoomCreationPolicy } from "./RoomCreationPolicy";
import { AppEmojiService } from "./services/AppEmojiService";
import { BannerService } from "./services/BannerService";
import { ControlSettingsService } from "./services/ControlSettingsService";
import { EmojiUploader } from "./services/EmojiUploader";
import { IconSettingsService } from "./services/IconSettingsService";
import { LocaleService } from "./services/LocaleService";
import { PanelTextService } from "./services/PanelTextService";
import { RolePolicyService } from "./services/RolePolicyService";
import { initServices } from "./services/registry";
import { SetupService } from "./services/SetupService";
import { VoiceStateHandler } from "./VoiceStateHandler";

const env = loadEnv();

const logger = createLogger({
  level: env.LOG_LEVEL,
  prefix: "bot",
});

const guildRepository = new GuildRepository();
const roomRepository = new RoomRepository();

const guildService = new GuildService(guildRepository);
const roomService = new RoomService(roomRepository);
const roomLifecycleService = new RoomLifecycleService(roomService);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    // Required to read attachments/content of user messages (banner upload).
    // Must ALSO be enabled in the Dev Portal → Bot → Privileged Intents.
    GatewayIntentBits.MessageContent,
  ],
  // Mentions render as tags but never ping anyone, bot-wide.
  allowedMentions: { parse: [] },
  silent: false,
});

const roomChannelService = new RoomChannelService();

const bannerService = new BannerService(logger, guildService);

const panelTextService = new PanelTextService(logger);
const controlSettingsService = new ControlSettingsService(logger);
const rolePolicyService = new RolePolicyService(logger);
const localeService = new LocaleService(logger);

const emojiUploader = new EmojiUploader(logger);
const appEmojiService = new AppEmojiService(logger, emojiUploader, client);

const roomCleanupService = new RoomCleanupService(
  client,
  guildService,
  roomLifecycleService,
  controlSettingsService,
);

const roomCreationPolicy = new RoomCreationPolicy();

const setupService = new SetupService(
  logger,
  guildService,
  roomService,
  client,
  bannerService,
  appEmojiService,
  panelTextService,
);

const iconSettingsService = new IconSettingsService(
  logger,
  guildService,
  setupService,
  bannerService,
  panelTextService,
  appEmojiService,
);

const voiceStateHandler = new VoiceStateHandler(
  guildService,
  roomLifecycleService,
  roomChannelService,
  roomCleanupService,
  roomCreationPolicy,
);

// Bun does not support emitDecoratorMetadata, so tsyringe cannot resolve
// constructor dependencies of @Discord() handler classes. Handlers pull
// their dependencies from this registry instead (zero-arg constructors).
initServices({
  logger,
  client,
  guildRepository,
  roomRepository,
  guildService,
  roomService,
  bannerService,
  panelText: panelTextService,
  controlSettings: controlSettingsService,
  rolePolicy: rolePolicyService,
  locale: localeService,
  setupService,
  iconSettings: iconSettingsService,
  emojiUploader,
  appEmojis: appEmojiService,
  roomCleanup: roomCleanupService,
  voiceStateHandler,
});

(async () => {
  await importx(
    `${dirname(import.meta.url)}/{events,commands,components}/**/*.ts`,
  );

  await client.login(env.DISCORD_TOKEN);

  // Required by discordx: without this wire, interactions (slash/buttons/
  // selects/modals) are received but never dispatched to their handlers.
  client.on(Events.InteractionCreate, (interaction) => {
    void Promise.resolve(client.executeInteraction(interaction)).catch(
      (error: unknown) => {
        logger.error("Failed to execute interaction", error);
      },
    );
  });

  await client.initApplicationCommands();

  // Background: upload original niako icons as application emojis so the
  // panel has real custom emojis without any manual action.
  void appEmojiService
    .syncDefaults()
    .then((n) => logger.info(`Emoji sync done, uploaded ${n}`))
    .catch((e) => logger.warn("emoji sync failed", e));
})();

let shuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) {
    logger.warn(`Shutdown already in progress, ignoring ${signal}`);
    return;
  }

  shuttingDown = true;

  logger.info(`Received ${signal}, shutting down...`);

  try {
    roomCreationPolicy.dispose();
    roomCleanupService.dispose();
    client.destroy();

    logger.info("Bot shutdown complete");
  } catch (error) {
    logger.error("Failed during bot shutdown", error);
    process.exitCode = 1;
  }
};

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

// A single failed interaction must never kill the whole bot.
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", error);
});
