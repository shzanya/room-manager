import { jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

import { guilds } from "./guilds";

export const guildSettings = pgTable("guild_settings", {
  guildId: varchar("guild_id", { length: 20 })
    .primaryKey()
    .references(() => guilds.guildId, { onDelete: "cascade" }),

  rolePolicy: jsonb("role_policy").$type<Record<string, unknown>>().default({}),

  controlSettings: jsonb("control_settings").$type<Record<string, unknown>>().default({}),

  panelText: jsonb("panel_text").$type<Record<string, unknown>>().default({}),

  locale: varchar("locale", { length: 10 }).default("ru"),

  emojiCache: jsonb("emoji_cache").$type<Record<string, string>>().default({}),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
