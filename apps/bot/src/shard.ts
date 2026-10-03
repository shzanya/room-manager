import { loadEnv } from "@room-manager/config";
import { ShardingManager } from "discord.js";
import { detectClusterName } from "./cluster";

const env = loadEnv();

const CLUSTER_NAME = detectClusterName();
const TOTAL_SHARDS = Number(process.env.TOTAL_SHARDS) || 3;

const isNode = process.execPath.includes("node");

const manager = new ShardingManager("./src/index.ts", {
  token: env.DISCORD_TOKEN,
  totalShards: TOTAL_SHARDS,
  respawn: true,
  ...(isNode ? { execArgv: ["--import", "tsx"] } : {}),
});

manager.on("shardCreate", (shard) => {
  console.log(`[Cluster: ${CLUSTER_NAME}] Launched shard ${shard.id + 1}/${TOTAL_SHARDS}`);

  shard.on("ready", () => {
    console.log(`[Cluster: ${CLUSTER_NAME}] Shard ${shard.id + 1} is ready`);
  });

  shard.on("death", (proc) => {
    const pid = (proc as { pid?: number } | null)?.pid ?? "unknown";
    console.error(`[Cluster: ${CLUSTER_NAME}] Shard ${shard.id + 1} died (PID: ${pid})`);
  });

  shard.on("error", (error) => {
    console.error(`[Cluster: ${CLUSTER_NAME}] Shard ${shard.id + 1} error:`, error);
  });
});

console.log(`[Cluster: ${CLUSTER_NAME}] Starting ${TOTAL_SHARDS} shard(s)...`);

manager
  .spawn()
  .then(() => {
    console.log(`[Cluster: ${CLUSTER_NAME}] All ${TOTAL_SHARDS} shard(s) launched`);
  })
  .catch((error) => {
    console.error(`[Cluster: ${CLUSTER_NAME}] Failed to spawn shards:`, error);
    process.exit(1);
  });
