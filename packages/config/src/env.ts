import { envSchema } from "./schema";

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${result.error.message}`);
  }

  return result.data;
}
