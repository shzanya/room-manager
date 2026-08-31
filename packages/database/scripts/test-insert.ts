import pg from "pg";

const p = new pg.Pool({
  connectionString:
    "postgresql://neondb_owner:npg_PduWXrO7vo1D@ep-square-butterfly-agl459up.c-2.eu-central-1.aws.neon.tech/ROOM-MANAGER?sslmode=require",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

try {
  await p.query(
    `INSERT INTO guilds (guild_id, creator_channel_id, category_id, panel_channel_id, default_user_limit, delete_delay_seconds, creation_cooldown_seconds, accent_color, enabled, icon_pack, icon_colors, template) VALUES ('123', '111', '222', '333', 0, 30, 5, 45219185, true, 'niako', '{}', 'default')`,
  );
  console.log("INSERT OK");
  await p.query("DELETE FROM guilds WHERE guild_id = $1", ["123"]);
  console.log("DELETE OK");
} catch (e: any) {
  console.error("ERR:", e.message);
} finally {
  await p.end();
}
