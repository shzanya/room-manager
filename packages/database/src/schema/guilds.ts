import { boolean, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const guilds = pgTable("guilds", {
  id: uuid("id").primaryKey().defaultRandom(),

  guildId: varchar("guild_id", { length: 20 }).notNull().unique(),

  creatorChannelId: varchar("creator_channel_id", { length: 20 }),
  categoryId: varchar("category_id", { length: 20 }),
  panelChannelId: varchar("panel_channel_id", { length: 20 }),
  panelMessageId: varchar("panel_message_id", { length: 20 }),
  logChannelId: varchar("log_channel_id", { length: 20 }),

  defaultUserLimit: integer("default_user_limit").notNull().default(0),
  deleteDelaySeconds: integer("delete_delay_seconds").notNull().default(5),
  creationCooldownSeconds: integer("creation_cooldown_seconds").notNull().default(0),
  accentColor: integer("accent_color").notNull().default(0x2b2d31),

  bannerUrl: text("banner_url"),

  iconPack: varchar("icon_pack", { length: 50 }).notNull().default("niako"),
  iconColors: text("icon_colors").notNull().default("{}"),

  template: varchar("template", { length: 50 }).notNull().default("default"),

  enabled: boolean("enabled").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
