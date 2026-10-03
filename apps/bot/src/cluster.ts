import { hostname } from "node:os";
import { loadEnv } from "@room-manager/config";

export function detectClusterName(): string {
  try {
    const env = loadEnv();
    if (env.CLUSTER_NAME) return env.CLUSTER_NAME;
  } catch {}

  return hostname();
}
