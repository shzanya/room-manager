import { loadEnv } from "@room-manager/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const env = loadEnv();

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  ...(env.DATABASE_SSL && {
    ssl: {
      rejectUnauthorized: false,
    },
  }),
});

export const db = drizzle(pool, { schema });

export { pool };

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
