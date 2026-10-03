import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

import { guilds } from "./guilds";

export const guildCooldowns = pgTable("guild_cooldowns", {
  guildId: varchar("guild_id", { length: 20 })
    .primaryKey()
    .references(() => guilds.guildId, { onDelete: "cascade" }),

  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
