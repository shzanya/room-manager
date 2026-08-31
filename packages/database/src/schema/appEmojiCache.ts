import { jsonb, pgTable, varchar } from "drizzle-orm/pg-core";

export const appEmojiCache = pgTable("app_emoji_cache", {
  name: varchar("name", { length: 100 }).primaryKey(),
  data: jsonb("data").$type<{ id: string; name: string; hash: string }>().notNull(),
});
