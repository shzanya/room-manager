import { loadEnv } from "@room-manager/config";
import { hostname } from "node:os";

export function detectClusterName(): string {
  try {
    const env = loadEnv();
    if (env.CLUSTER_NAME) return env.CLUSTER_NAME;
  } catch {
    // ignore
  }

  return hostname();
}
