import type { GuildService, RoomLifecycleService } from "@room-manager/core";
import type { Logger } from "@room-manager/logger";
import type { ChannelId, GuildId, RoomId } from "@room-manager/shared";
import type { Client } from "discord.js";
import type { ControlSettingsService } from "./services/ControlSettingsService";

export interface RoomCleanupServiceDeps {
  client: Client;
  guilds: GuildService;
  rooms: RoomLifecycleService;
  controlSettings: ControlSettingsService;
  logger: Logger;
}

export class RoomCleanupService {
  private readonly timers = new Map<RoomId, ReturnType<typeof setTimeout>>();
  private readonly deps: RoomCleanupServiceDeps;
  private readonly logger: Logger;

  public constructor(deps: RoomCleanupServiceDeps) {
    this.deps = deps;
    this.logger = deps.logger;
  }

  public async restore(): Promise<void> {
    this.logger.info("RoomCleanupService: ready (setTimeout-based)");
  }

  public async schedule(
    roomId: RoomId,
    guildId: GuildId,
    channelId: ChannelId,
    deleteDelaySeconds: number,
    instantDelete: boolean,
  ): Promise<void> {
    this.cancel(roomId);

    const delay = instantDelete ? 0 : Math.max(0, deleteDelaySeconds * 1000);

    this.logger.info(
      `Scheduled deletion for room ${roomId} in ${deleteDelaySeconds}s (instant: ${instantDelete})`,
    );

    const deps = this.deps;
    const timer = setTimeout(async () => {
      this.timers.delete(roomId);
      try {
        await this.cleanup(roomId, guildId, channelId, deps);
      } catch (error: unknown) {
        this.logger.error(`Failed to cleanup room ${roomId}`, error);
      }
    }, delay);

    this.timers.set(roomId, timer);
  }

  public cancel(roomId: RoomId): void {
    const timer = this.timers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(roomId);
      this.logger.info(`Cancelled deletion for room ${roomId}`);
    }
  }

  public dispose(): void {
    for (const [, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.logger.info("RoomCleanupService disposed");
  }

  private async cleanup(
    roomId: RoomId,
    guildId: GuildId,
    channelId: ChannelId,
    deps: RoomCleanupServiceDeps,
  ): Promise<void> {
    const room = await deps.rooms.getById(roomId);

    if (!room) return;
    if (room.channelId !== channelId) return;
    if (room.guildId !== guildId) return;
    if (room.state !== "cooldown") return;

    const guild = await deps.client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId).catch(() => null);

    if (!channel) {
      await deps.rooms.destroy(roomId);
      this.logger.info(`Removed stale room ${roomId} from database`);
      return;
    }

    if (!channel.isVoiceBased()) {
      await deps.rooms.destroy(roomId);
      this.logger.warn(`Removed room ${roomId}: channel is no longer voice-based`);
      return;
    }

    if (channel.members.size > 0) {
      await deps.rooms.activate(roomId);
      this.logger.info(`Room ${roomId} became active again before deletion`);
      return;
    }

    await deps.rooms.startDeletion(roomId);

    try {
      await channel.delete();
    } catch (error: unknown) {
      await deps.rooms.startCooldown(roomId);
      throw error;
    }

    await deps.rooms.destroy(roomId);
    this.logger.info(`Deleted room ${roomId}`);
  }
}
