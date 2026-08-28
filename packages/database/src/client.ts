import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import { loadEnv } from "@room-manager/config";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

const env = loadEnv();

const databasePath = resolve(import.meta.dir, "../../../", env.DATABASE_URL);

const sqlite = new Database(databasePath);

export const db = drizzle(sqlite, {
  schema,
});

// Auto-apply pending Drizzle migrations on boot so the schema is always
// up to date (no manual `drizzle-kit migrate` step).
try {
  migrate(db, {
    migrationsFolder: resolve(import.meta.dir, "../../../drizzle"),
  });
} catch (error) {
  // Don't crash the bot (DB may be locked by another instance), but make
  // the failure loud so it's not a mystery later.
  console.error(
    "[database] auto-migration failed:",
    error instanceof Error ? error.message : error,
  );
}
