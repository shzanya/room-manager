import type { GuildId } from "@room-manager/shared";
import { eq } from "drizzle-orm";

import { db } from "../client";
import { guildCooldowns } from "../schema";

export class GuildCooldownRepository {
  public async get(guildId: GuildId): Promise<Date | null> {
    const result = await db
      .select({ expiresAt: guildCooldowns.expiresAt })
      .from(guildCooldowns)
      .where(eq(guildCooldowns.guildId, guildId))
      .limit(1);

    return result[0]?.expiresAt ?? null;
  }

  public async set(guildId: GuildId, expiresAt: Date): Promise<void> {
    await db.insert(guildCooldowns).values({ guildId, expiresAt }).onConflictDoUpdate({
      target: guildCooldowns.guildId,
      set: { expiresAt },
    });
  }

  public async delete(guildId: GuildId): Promise<void> {
    await db.delete(guildCooldowns).where(eq(guildCooldowns.guildId, guildId));
  }

  public async deleteExpired(): Promise<void> {
    await db.delete(guildCooldowns).where(eq(guildCooldowns.expiresAt, new Date()));
  }
}
