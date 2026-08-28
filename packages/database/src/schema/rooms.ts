import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { guilds } from "./guilds";

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  guildId: text("guild_id")
    .notNull()
    .references(() => guilds.id, {
      onDelete: "cascade",
    }),
  channelId: text("channel_id").notNull().unique(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  userLimit: integer("user_limit").notNull().default(0),
  state: text("state", {
    enum: ["active", "cooldown", "deleting"],
  })
    .notNull()
    .default("active"),
  locked: integer("locked", { mode: "boolean" }).notNull().default(false),
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),
  updatedAt: integer("updated_at", {
    mode: "timestamp_ms",
  }).notNull(),
  lastActivityAt: integer("last_activity_at", {
    mode: "timestamp_ms",
  }).notNull(),
});
