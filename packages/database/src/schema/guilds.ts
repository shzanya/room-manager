import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const guilds = sqliteTable("guilds", {
  id: text("id").primaryKey(),

  guildId: text("guild_id").notNull().unique(),

  creatorChannelId: text("creator_channel_id"),
  categoryId: text("category_id"),
  panelChannelId: text("panel_channel_id"),
  panelMessageId: text("panel_message_id"),

  defaultUserLimit: integer("default_user_limit").notNull().default(0),
  deleteDelaySeconds: integer("delete_delay_seconds").notNull().default(5),
  creationCooldownSeconds: integer("creation_cooldown_seconds")
    .notNull()
    .default(0),
  accentColor: integer("accent_color").notNull().default(0x2b2d31),

  bannerUrl: text("banner_url"),

  iconPack: text("icon_pack").notNull().default("niako"),
  iconColors: text("icon_colors").notNull().default("{}"),

  template: text("template").notNull().default("default"),

  enabled: integer("enabled", {
    mode: "boolean",
  })
    .notNull()
    .default(true),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp_ms",
  }).notNull(),
});
