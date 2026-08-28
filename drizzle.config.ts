import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/database/src/schema/index.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/room-manager.db",
  },
  strict: true,
  verbose: true,
});
