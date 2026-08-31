import pg from "pg";

const p = new pg.Pool({
  connectionString:
    "postgresql://neondb_owner:npg_PduWXrO7vo1D@ep-square-butterfly-agl459up.c-2.eu-central-1.aws.neon.tech/ROOM-MANAGER?sslmode=require",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

try {
  const r = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
  );
  console.log(
    "Tables:",
    r.rows.map((x: any) => x.table_name),
  );

  const m = await p.query(
    "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at",
  );
  console.log("Migrations:", m.rowCount);
} catch (e: any) {
  console.error("ERR:", e.message);
} finally {
  await p.end();
}
