import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),

  DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().default("redis://localhost:6379"),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  METRICS_PORT: z.coerce.number().int().positive().default(9090),

  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  CLUSTER_NAME: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
