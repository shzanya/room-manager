import { createLogger } from "@room-manager/logger";
import type { GuildId } from "@room-manager/shared";

export class RoomCreationPolicy {
  private readonly logger = createLogger({
    prefix: "creation-policy",
    level: "info",
  });

  private readonly cooldowns = new Map<
    GuildId,
    ReturnType<typeof setTimeout>
  >();

  public canCreate(guildId: GuildId): boolean {
    return !this.cooldowns.has(guildId);
  }

  public startCooldown(guildId: GuildId, durationSeconds: number): void {
    this.cancel(guildId);

    const delay = Math.max(0, durationSeconds * 1000);

    if (delay === 0) {
      return;
    }

    const timer = setTimeout(() => {
      this.cooldowns.delete(guildId);

      this.logger.info(`Room creation cooldown expired for guild ${guildId}`);
    }, delay);

    this.cooldowns.set(guildId, timer);

    this.logger.info(
      `Room creation cooldown started for guild ${guildId} (${durationSeconds}s)`,
    );
  }

  public cancel(guildId: GuildId): void {
    const timer = this.cooldowns.get(guildId);

    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.cooldowns.delete(guildId);
  }

  public dispose(): void {
    for (const timer of this.cooldowns.values()) {
      clearTimeout(timer);
    }

    const count = this.cooldowns.size;

    this.cooldowns.clear();

    this.logger.info(`Disposed ${count} room creation cooldown(s)`);
  }
}
