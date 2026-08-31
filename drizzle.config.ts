import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/database/src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/room_manager",
  },
  strict: true,
  verbose: true,
  migrations: {
    schema: "public",
  },
});
