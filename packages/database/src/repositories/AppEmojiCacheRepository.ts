import { eq } from "drizzle-orm";
import { db } from "../client";
import { appEmojiCache } from "../schema";

export interface EmojiCacheEntry {
  id: string;
  name: string;
  hash: string;
}

export class AppEmojiCacheRepository {
  async getAll(): Promise<Map<string, EmojiCacheEntry>> {
    const rows = await db.select().from(appEmojiCache);
    const map = new Map<string, EmojiCacheEntry>();
    for (const row of rows) {
      map.set(row.name, row.data as EmojiCacheEntry);
    }
    return map;
  }

  async set(name: string, entry: EmojiCacheEntry): Promise<void> {
    await db
      .insert(appEmojiCache)
      .values({ name, data: entry })
      .onConflictDoUpdate({
        target: appEmojiCache.name,
        set: { data: entry },
      });
  }

  async delete(name: string): Promise<void> {
    await db.delete(appEmojiCache).where(eq(appEmojiCache.name, name));
  }
}
