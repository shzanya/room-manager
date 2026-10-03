import type { GuildConfig } from "@room-manager/contracts";
import type { GuildRepository } from "@room-manager/database";
import type { GuildId } from "@room-manager/shared";

export class GuildService {
  public constructor(private readonly guilds: GuildRepository) {}

  async getById(guildId: GuildId): Promise<GuildConfig | null> {
    return this.guilds.findById(guildId);
  }

  async create(config: GuildConfig): Promise<GuildConfig> {
    const existing = await this.guilds.findById(config.guildId);

    if (existing) {
      return existing;
    }

    const guild = await this.guilds.create(config);

    if (!guild) {
      throw new Error(`Failed to create guild: ${config.guildId}`);
    }

    return guild;
  }

  async update(guildId: GuildId, changes: Partial<GuildConfig>): Promise<GuildConfig | null> {
    return this.guilds.update(guildId, changes);
  }

  async delete(guildId: GuildId): Promise<boolean> {
    return this.guilds.delete(guildId);
  }
}
