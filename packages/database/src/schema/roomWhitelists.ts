import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { rooms } from "./rooms";

export const roomWhitelists = pgTable("room_whitelists", {
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),

  userId: varchar("user_id", { length: 20 }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
