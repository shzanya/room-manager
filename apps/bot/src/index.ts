import "reflect-metadata";

import { dirname, importx } from "@discordx/importer";
import { loadEnv } from "@room-manager/config";
import { GuildService, RoomLifecycleService, RoomService } from "@room-manager/core";
import {
  AppEmojiCacheRepository,
  closeDatabase,
  GuildCooldownRepository,
  GuildRepository,
  GuildSettingsRepository,
  RoomMuteRepository,
  RoomRepository,
  RoomWhitelistRepository,
} from "@room-manager/database";
import {
  createStructuredLogger,
  discordLatency,
  startHealthServer,
} from "@room-manager/observability";
import { Events, GatewayIntentBits } from "discord.js";
import { Client } from "discordx";
import { sql } from "drizzle-orm";
import { RoomChannelService } from "./RoomChannelService";
import { RoomCleanupService } from "./RoomCleanupService";
import { createRoomCreationPolicy } from "./RoomCreationPolicy";
import { AppEmojiService } from "./services/AppEmojiService";
import { BannerService } from "./services/BannerService";
import { ControlSettingsService } from "./services/ControlSettingsService";
import { EmojiUploader } from "./services/EmojiUploader";
import { IconSettingsService } from "./services/IconSettingsService";
import { LocaleService } from "./services/LocaleService";
import { LogService } from "./services/LogService";
import { createMutesRegistry } from "./services/MutesRegistry";
import { PanelTextService } from "./services/PanelTextService";
import { initServices } from "./services/registry";
import { SetupService } from "./services/SetupService";
import { createWhitelistRegistry } from "./services/WhitelistRegistry";
import { VoiceStateHandler } from "./VoiceStateHandler";

declare global {
  var __getShardStats:
    | (() => {
        commandCount: number;
        totalCommandMs: number;
        lastCommandMs: number;
        uptime: number;
      })
    | undefined;
}

const env = loadEnv();
const isShard = process.env.SHARDING_MANAGER === "true";
const logger = createStructuredLogger();

const guildRepository = new GuildRepository();
const roomRepository = new RoomRepository();
const guildSettingsRepository = new GuildSettingsRepository();
const appEmojiCacheRepository = new AppEmojiCacheRepository();
const roomMuteRepository = new RoomMuteRepository();
const roomWhitelistRepository = new RoomWhitelistRepository();
const guildCooldownRepository = new GuildCooldownRepository();

const guildService = new GuildService(guildRepository);
const roomService = new RoomService(roomRepository);
const roomLifecycleService = new RoomLifecycleService(roomService);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  allowedMentions: { parse: [] },
  silent: false,
});

const roomChannelService = new RoomChannelService();
const bannerService = new BannerService(logger, guildService);
const panelTextService = new PanelTextService(guildSettingsRepository);
const controlSettingsService = new ControlSettingsService(guildSettingsRepository);
const localeService = new LocaleService(guildSettingsRepository);

const emojiUploader = new EmojiUploader(logger);
const appEmojiService = new AppEmojiService(logger, emojiUploader, client, appEmojiCacheRepository);

const roomCleanupService = new RoomCleanupService({
  client,
  guilds: guildService,
  rooms: roomLifecycleService,
  controlSettings: controlSettingsService,
  logger,
});

const creationPolicy = createRoomCreationPolicy(guildCooldownRepository);
const mutes = createMutesRegistry(roomMuteRepository);
const whitelists = createWhitelistRegistry(roomWhitelistRepository);
const logService = new LogService(guildService, logger);

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
  creationPolicy,
  logger,
);

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
  locale: localeService,
  setupService,
  iconSettings: iconSettingsService,
  emojiUploader,
  appEmojis: appEmojiService,
  roomCleanup: roomCleanupService,
  voiceStateHandler,
  mutes,
  whitelists,
  creationPolicy,
  logService,
});

async function preloadGuildSettings(): Promise<void> {
  const rows = await guildSettingsRepository.getAll();
  for (const row of rows) {
    const gid = row.guildId as import("@room-manager/shared").GuildId;
    controlSettingsService.hydrate(gid, row.controlSettings);
    panelTextService.hydrate(gid, row.panelText);
    localeService.hydrate(gid, row.locale);
  }
  logger.info(`Preloaded settings for ${rows.length} guilds`);
}

let commandCount = 0;
let totalCommandMs = 0;
let lastCommandMs = 0;

export function getShardStats() {
  return {
    commandCount,
    totalCommandMs,
    lastCommandMs,
    uptime: process.uptime(),
  };
}

globalThis.__getShardStats = getShardStats;

let healthServer: import("node:http").Server | null = null;

if (!isShard) {
  healthServer = startHealthServer({
    port: env.METRICS_PORT,
    logger,
    checks: {
      database: async () => {
        try {
          const { db } = await import("@room-manager/database");
          await db.execute(sql`SELECT 1`);
          return true;
        } catch {
          return false;
        }
      },
    },
  });
}

(async () => {
  if (isShard) {
    logger.info(`Starting as shard (PID: ${process.pid}, SHARD_ID: ${process.env.SHARD ?? "0"})`);
  }

  await importx(`${dirname(import.meta.url)}/{events,commands,components}/**/*.ts`);

  await client.login(env.DISCORD_TOKEN);
  await preloadGuildSettings();

  client.on(Events.InteractionCreate, (interaction) => {
    const start = performance.now();
    void Promise.resolve(client.executeInteraction(interaction))
      .then(() => {
        const elapsed = performance.now() - start;
        commandCount++;
        totalCommandMs += elapsed;
        lastCommandMs = elapsed;
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, "Failed to execute interaction");
      });
  });

  await client.initApplicationCommands();

  void appEmojiService
    .syncDefaults()
    .then((n) => logger.info({ count: n }, "Emoji sync done"))
    .catch((e) => logger.warn({ err: e }, "emoji sync failed"));

  setInterval(() => {
    discordLatency.set(client.ws.ping);
  }, 30_000);
})();

let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    logger.warn({ signal }, "Shutdown already in progress, ignoring");
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, "Shutting down...");

  try {
    roomCleanupService.dispose();
    client.destroy();
    healthServer?.close();
    await closeDatabase();

    logger.info("Bot shutdown complete");
  } catch (error) {
    logger.error({ err: error }, "Error during shutdown");
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
