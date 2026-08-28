import { Database } from "bun:sqlite";

const db = new Database("data/room-manager.db", { readonly: true });

interface NameRow {
  name: string;
}

interface ColRow {
  name: string;
}

interface MigrationRow {
  hash: string;
  created_at: number;
}

const tables = db
  .query<NameRow, []>(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  )
  .all();
console.log("TABLES:", tables.map((r) => r.name).join(", "));

for (const t of ["guilds", "rooms"]) {
  const cols = db.query<ColRow, []>(`PRAGMA table_info(${t})`).all();
  console.log(`${t.toUpperCase()} COLS:`, cols.map((c) => c.name).join(", "));
}

try {
  const applied = db
    .query<MigrationRow, []>(
      "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at",
    )
    .all();
  console.log("APPLIED MIGRATIONS:", applied.length);
} catch {
  console.log("APPLIED MIGRATIONS: none (__drizzle_migrations missing)");
}
