import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { guilds } from "./guilds";

export const roomStateEnum = pgEnum("room_state", [
  "active",
  "cooldown",
  "deleting",
]);

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey(),

  guildId: varchar("guild_id", { length: 20 })
    .notNull()
    .references(() => guilds.guildId, { onDelete: "cascade" }),

  channelId: varchar("channel_id", { length: 20 }).notNull().unique(),
  ownerId: varchar("owner_id", { length: 20 }).notNull(),

  name: varchar("name", { length: 100 }).notNull(),
  userLimit: integer("user_limit").notNull().default(0),

  state: roomStateEnum("state").notNull().default("active"),

  locked: boolean("locked").notNull().default(false),
  hidden: boolean("hidden").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
