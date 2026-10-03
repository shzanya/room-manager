import type { Logger } from "@room-manager/logger";
import { type Client, Events } from "discord.js";
import { Discord, On } from "discordx";
import type { RoomCleanupService } from "../RoomCleanupService";
import { svc } from "../services/registry";

@Discord()
export class ReadyEvent {
  private readonly logger: Logger = svc().logger;
  private readonly client: Client = svc().client;
  private readonly roomCleanupService: RoomCleanupService = svc().roomCleanup;

  @On({ event: Events.ClientReady })
  async onReady(): Promise<void> {
    this.logger.info(`Bot started as ${this.client.user?.tag ?? "unknown"}`);

    await this.roomCleanupService.restore().catch((error) => {
      this.logger.error("Failed to restore room cleanup state", error);
    });

    setInterval(() => {
      for (const [, guild] of this.client.guilds.cache) {
        svc()
          .setupService.refreshPanel(guild)
          .catch(() => undefined);
      }
    }, 60_000);
  }
}
