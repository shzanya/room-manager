import { jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

import { guilds } from "./guilds";

/**
 * Stores all per-guild bot settings as JSONB blobs.
 * One row per guild — replaces role-policy.json, control-settings.json,
 * panel-text.json, locales.json.
 *
 * Using JSONB (not JSON) for indexing capability and efficient updates.
 */
export const guildSettings = pgTable("guild_settings", {
  guildId: varchar("guild_id", { length: 20 })
    .primaryKey()
    .references(() => guilds.guildId, { onDelete: "cascade" }),

  /** Role policy config (groups, policies, muteRoleId, adminRoles) */
  rolePolicy: jsonb("role_policy").$type<Record<string, unknown>>().default({}),

  /** Control settings (mode, instantDelete, publicCategory) */
  controlSettings: jsonb("control_settings")
    .$type<Record<string, unknown>>()
    .default({}),

  /** Panel text overrides (title, description) */
  panelText: jsonb("panel_text").$type<Record<string, unknown>>().default({}),

  /** Locale (ru/en) */
  locale: varchar("locale", { length: 10 }).default("ru"),

  /** Application emoji cache (hash → emojiId) */
  emojiCache: jsonb("emoji_cache").$type<Record<string, string>>().default({}),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
