import type { GuildConfig } from "@room-manager/contracts";
import type { GuildId } from "@room-manager/shared";

import { eq } from "drizzle-orm";

import { db } from "../client";
import { mapGuildConfig, serializeIconColors } from "../mappers/GuildMapper";
import { guilds } from "../schema";

export class GuildRepository {
  async findById(guildId: GuildId): Promise<GuildConfig | null> {
    const result = await db
      .select()
      .from(guilds)
      .where(eq(guilds.guildId, guildId))
      .limit(1);

    const guild = result[0];

    return guild ? mapGuildConfig(guild) : null;
  }

  async create(config: GuildConfig): Promise<GuildConfig | null> {
    const [guild] = await db
      .insert(guilds)
      .values({
        guildId: config.guildId,
        creatorChannelId: config.creatorChannelId,
        categoryId: config.categoryId,
        panelChannelId: config.panelChannelId,
        panelMessageId: config.panelMessageId,
        logChannelId: config.logChannelId,
        defaultUserLimit: config.defaultUserLimit,
        deleteDelaySeconds: config.deleteDelaySeconds,
        creationCooldownSeconds: config.creationCooldownSeconds,
        accentColor: config.accentColor,
        enabled: config.enabled,
        iconPack: config.iconPack ?? "niako",
        iconColors: serializeIconColors(config.iconColors),
        template: config.template ?? "default",
      })
      .returning();

    return guild ? mapGuildConfig(guild) : null;
  }

  async update(
    guildId: GuildId,
    config: Partial<GuildConfig>,
  ): Promise<GuildConfig | null> {
    const updateData: Record<string, unknown> = {
      ...config,
      updatedAt: new Date(),
    };

    if (config.iconColors !== undefined) {
      updateData.iconColors = serializeIconColors(config.iconColors);
    }

    const [guild] = await db
      .update(guilds)
      .set(updateData)
      .where(eq(guilds.guildId, guildId))
      .returning();

    return guild ? mapGuildConfig(guild) : null;
  }

  async delete(guildId: GuildId): Promise<boolean> {
    const result = await db
      .delete(guilds)
      .where(eq(guilds.guildId, guildId))
      .returning({
        guildId: guilds.guildId,
      });

    return result.length > 0;
  }
}
