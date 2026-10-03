import type { GuildId } from "@room-manager/shared";
import { eq } from "drizzle-orm";

import { db } from "../client";
import { guildSettings } from "../schema";

export interface GuildSettingsRow {
  guildId: string;
  rolePolicy: Record<string, unknown>;
  controlSettings: Record<string, unknown>;
  panelText: Record<string, unknown>;
  locale: string;
  emojiCache: Record<string, string>;
}

export class GuildSettingsRepository {
  async get(guildId: GuildId): Promise<GuildSettingsRow | null> {
    const result = await db
      .select()
      .from(guildSettings)
      .where(eq(guildSettings.guildId, guildId))
      .limit(1);

    const row = result[0];
    if (!row) return null;

    return {
      guildId: row.guildId,
      rolePolicy: (row.rolePolicy as Record<string, unknown>) ?? {},
      controlSettings: (row.controlSettings as Record<string, unknown>) ?? {},
      panelText: (row.panelText as Record<string, unknown>) ?? {},
      locale: row.locale ?? "ru",
      emojiCache: (row.emojiCache as Record<string, string>) ?? {},
    };
  }

  async upsert(guildId: GuildId, data: Partial<GuildSettingsRow>): Promise<void> {
    const existing = await this.get(guildId);

    if (existing) {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (data.rolePolicy !== undefined) updateData.rolePolicy = data.rolePolicy;
      if (data.controlSettings !== undefined) updateData.controlSettings = data.controlSettings;
      if (data.panelText !== undefined) updateData.panelText = data.panelText;
      if (data.locale !== undefined) updateData.locale = data.locale;
      if (data.emojiCache !== undefined) updateData.emojiCache = data.emojiCache;

      await db.update(guildSettings).set(updateData).where(eq(guildSettings.guildId, guildId));
    } else {
      await db.insert(guildSettings).values({
        guildId,
        rolePolicy: data.rolePolicy ?? {},
        controlSettings: data.controlSettings ?? {},
        panelText: data.panelText ?? {},
        locale: data.locale ?? "ru",
        emojiCache: data.emojiCache ?? {},
      });
    }
  }

  async updatePartial(
    guildId: GuildId,
    patch: Partial<
      Pick<
        GuildSettingsRow,
        "rolePolicy" | "controlSettings" | "panelText" | "locale" | "emojiCache"
      >
    >,
  ): Promise<void> {
    const existing = await this.get(guildId);

    if (existing) {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.rolePolicy !== undefined) updateData.rolePolicy = patch.rolePolicy;
      if (patch.controlSettings !== undefined) updateData.controlSettings = patch.controlSettings;
      if (patch.panelText !== undefined) updateData.panelText = patch.panelText;
      if (patch.locale !== undefined) updateData.locale = patch.locale;
      if (patch.emojiCache !== undefined) updateData.emojiCache = patch.emojiCache;

      await db.update(guildSettings).set(updateData).where(eq(guildSettings.guildId, guildId));
    } else {
      await db.insert(guildSettings).values({
        guildId,
        rolePolicy: patch.rolePolicy ?? {},
        controlSettings: patch.controlSettings ?? {},
        panelText: patch.panelText ?? {},
        locale: patch.locale ?? "ru",
        emojiCache: patch.emojiCache ?? {},
      });
    }
  }

  async delete(guildId: GuildId): Promise<void> {
    await db.delete(guildSettings).where(eq(guildSettings.guildId, guildId));
  }

  async getAll(): Promise<GuildSettingsRow[]> {
    const rows = await db.select().from(guildSettings);
    return rows.map((row) => ({
      guildId: row.guildId,
      rolePolicy: (row.rolePolicy as Record<string, unknown>) ?? {},
      controlSettings: (row.controlSettings as Record<string, unknown>) ?? {},
      panelText: (row.panelText as Record<string, unknown>) ?? {},
      locale: row.locale ?? "ru",
      emojiCache: (row.emojiCache as Record<string, string>) ?? {},
    }));
  }
}
