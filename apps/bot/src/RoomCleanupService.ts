import type { GuildService, RoomLifecycleService } from "@room-manager/core";
import type { Logger } from "@room-manager/logger";
import { createLogger } from "@room-manager/logger";
import type { ChannelId, GuildId, RoomId } from "@room-manager/shared";
import type { Client } from "discord.js";
import type { ControlSettingsService } from "./services/ControlSettingsService";

export class RoomCleanupService {
  private readonly logger: Logger = createLogger({
    prefix: "cleanup",
    level: "info",
  });

  private readonly timers = new Map<RoomId, ReturnType<typeof setTimeout>>();

  public constructor(
    private readonly client: Client,
    private readonly guilds: GuildService,
    private readonly rooms: RoomLifecycleService,
    private readonly controlSettings?: ControlSettingsService,
  ) {}

  public async restore(): Promise<void> {
    const rooms = await this.rooms.getByState("cooldown");

    if (rooms.length === 0) {
      this.logger.info("No rooms require cleanup restoration");
      return;
    }

    this.logger.info(`Restoring cleanup for ${rooms.length} room(s)`);

    for (const room of rooms) {
      try {
        const guild = await this.client.guilds.fetch(room.guildId);

        const channel = await guild.channels
          .fetch(room.channelId)
          .catch(() => null);

        if (!channel) {
          await this.rooms.destroy(room.id);

          this.logger.info(
            `Removed stale room ${room.id}: channel no longer exists`,
          );

          continue;
        }

        if (!channel.isVoiceBased()) {
          await this.rooms.destroy(room.id);

          this.logger.warn(
            `Removed room ${room.id}: channel is no longer voice-based`,
          );

          continue;
        }

        if (channel.members.size > 0) {
          await this.rooms.activate(room.id);

          this.logger.info(`Restored room ${room.id} as active`);

          continue;
        }

        await this.schedule(room.id, room.guildId, room.channelId);
      } catch (error: unknown) {
        this.logger.error(`Failed to restore room ${room.id}`, error);
      }
    }
  }

  public async schedule(
    roomId: RoomId,
    guildId: GuildId,
    channelId: ChannelId,
  ): Promise<void> {
    this.cancel(roomId);

    const room = await this.rooms.getById(roomId);

    if (!room) {
      this.logger.warn(`Cannot schedule cleanup: room ${roomId} was not found`);
      return;
    }

    if (room.state !== "cooldown") {
      this.logger.debug(
        `Skipping cleanup for room ${roomId}: state is ${room.state}`,
      );
      return;
    }

    const config = await this.guilds.getById(guildId);

    if (!config) {
      this.logger.warn(
        `Cannot schedule cleanup: guild ${guildId} is not configured`,
      );
      return;
    }

    // Управление → «Мгновенное удаление» bypasses the cooldown entirely.
    const instant = this.controlSettings?.get(guildId).instantDelete ?? false;
    const delaySeconds = instant ? 0 : config.deleteDelaySeconds;

    const delay = Math.max(0, delaySeconds * 1000);

    this.logger.info(
      `Scheduled deletion for room ${roomId} in ${delaySeconds}s`,
    );

    const timer = setTimeout(() => {
      this.timers.delete(roomId);

      void this.cleanup(roomId, guildId, channelId);
    }, delay);

    this.timers.set(roomId, timer);
  }

  public cancel(roomId: RoomId): void {
    const timer = this.timers.get(roomId);

    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.timers.delete(roomId);

    this.logger.info(`Cancelled deletion for room ${roomId}`);
  }

  public dispose(): void {
    const count = this.timers.size;

    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.timers.clear();

    this.logger.info(`Disposed ${count} room cleanup timer(s)`);
  }

  private async cleanup(
    roomId: RoomId,
    guildId: GuildId,
    channelId: ChannelId,
  ): Promise<void> {
    try {
      const room = await this.rooms.getById(roomId);

      if (!room) {
        return;
      }

      if (room.channelId !== channelId) {
        this.logger.warn(
          `Skipping cleanup for room ${roomId}: channel changed`,
        );
        return;
      }

      if (room.guildId !== guildId) {
        this.logger.warn(`Skipping cleanup for room ${roomId}: guild changed`);
        return;
      }

      if (room.state !== "cooldown") {
        return;
      }

      const guild = await this.client.guilds.fetch(guildId);

      const channel = await guild.channels.fetch(channelId).catch(() => null);

      if (!channel) {
        await this.rooms.destroy(roomId);

        this.logger.info(`Removed stale room ${roomId} from database`);

        return;
      }

      if (!channel.isVoiceBased()) {
        await this.rooms.destroy(roomId);

        this.logger.warn(
          `Removed room ${roomId}: channel is no longer voice-based`,
        );

        return;
      }

      if (channel.members.size > 0) {
        await this.rooms.activate(roomId);

        this.logger.info(`Room ${roomId} became active again before deletion`);

        return;
      }

      await this.rooms.startDeletion(roomId);

      try {
        await channel.delete();
      } catch (error: unknown) {
        await this.rooms.startCooldown(roomId);
        throw error;
      }

      await this.rooms.destroy(roomId);

      this.logger.info(`Deleted room ${roomId}`);
    } catch (error: unknown) {
      this.logger.error(`Failed to cleanup room ${roomId}`, error);
    }
  }
}
