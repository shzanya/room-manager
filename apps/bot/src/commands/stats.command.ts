import { readFileSync } from "node:fs";
import { cpus, freemem, totalmem } from "node:os";
import { resolve } from "node:path";
import { memoryUsage } from "node:process";
import {
  ContainerBuilder,
  PermissionFlagsBits,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from "discord.js";
import { Discord, Slash } from "discordx";
import { detectClusterName } from "../cluster";
import { tOf } from "../i18n";
import { getShardStats } from "../index";
import { svc } from "../services/registry";

const CLUSTER_NAME = detectClusterName();
const V2_FLAG = 32768;
const EPHEMERAL_FLAG = 64;

function getBotVersion(): string {
  try {
    const pkgPath = resolve(import.meta.dir, "../../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function getSystemInfo() {
  const mem = memoryUsage();
  const botRam = mem.rss;
  const sysTotal = totalmem();
  const sysFree = freemem();
  const sysUsed = sysTotal - sysFree;
  const ramPercent = Math.round((sysUsed / sysTotal) * 100);

  const cpu = cpus();
  const cpuModel = cpu[0]?.model ?? "Unknown";
  const cpuCores = cpu.length;

  return {
    botRam: formatBytes(botRam),
    sysUsed: formatBytes(sysUsed),
    sysTotal: formatBytes(sysTotal),
    sysFree: formatBytes(sysFree),
    ramPercent,
    cpuModel: cpuModel.replace(/\s+/g, " ").trim(),
    cpuCores,
  };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

@Discord()
export class StatsCommand {
  @Slash({
    name: "stats",
    description: "Bot statistics: cluster, shards, performance, system",
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  async stats(interaction: import("discord.js").ChatInputCommandInteraction): Promise<void> {
    const L = tOf(interaction.guild?.id);
    const { client } = svc();

    const isSharded = client.shard !== null;
    const currentShardId = isSharded && client.shard ? (client.shard.ids[0] ?? 0) + 1 : 1;

    let totalGuilds = 0;
    let totalUsers = 0;
    let shardData: Array<{
      id: number;
      guilds: number;
      users: number;
      latency: number;
      uptime: number;
      avgCmdMs: number;
    }> = [];

    if (isSharded && client.shard) {
      const shardResults = await client.shard.broadcastEval((c) => {
        const stats = globalThis.__getShardStats?.() ?? {
          commandCount: 0,
          totalCommandMs: 0,
        };
        return {
          guilds: c.guilds.cache.size,
          users: c.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0),
          latency: c.ws.ping,
          uptime: process.uptime(),
          avgCmdMs: stats.commandCount > 0 ? stats.totalCommandMs / stats.commandCount : 0,
        };
      });

      shardData = shardResults.map((r, i) => ({
        id: i + 1,
        guilds: r.guilds,
        users: r.users,
        latency: r.latency,
        uptime: r.uptime,
        avgCmdMs: r.avgCmdMs,
      }));

      totalGuilds = shardData.reduce((s, d) => s + d.guilds, 0);
      totalUsers = shardData.reduce((s, d) => s + d.users, 0);
    } else {
      const stats = getShardStats();
      const guilds = client.guilds.cache.size;
      const users = client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0);

      totalGuilds = guilds;
      totalUsers = users;
      shardData = [
        {
          id: 1,
          guilds,
          users,
          latency: client.ws.ping,
          uptime: stats.uptime,
          avgCmdMs: stats.commandCount > 0 ? stats.totalCommandMs / stats.commandCount : 0,
        },
      ];
    }

    const totalShards = shardData.length;
    const shardIds = shardData.map((d) => d.id);
    const avgLatency = shardData.reduce((s, d) => s + d.latency, 0) / totalShards;
    const avgCmdMs = shardData.reduce((s, d) => s + d.avgCmdMs, 0) / totalShards;
    const uptimeStr = formatUptime(shardData.reduce((s, d) => s + d.uptime, 0) / totalShards);

    const sys = getSystemInfo();

    const shardRows = shardData
      .map((d) => {
        const b = d.id === currentShardId ? "**" : "";
        const ping = d.latency < 0 ? "—" : `${d.latency}`;
        return `${b}Осколок ${d.id}${b} — ${b}${d.guilds}${b} серверов · ${b}${d.users}${b} юзеров · ${b}${ping}мс${b}`;
      })
      .join("\n");

    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Статистика бота`))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `> **Кластер:** ${CLUSTER_NAME} (${1}/${1})`,
            `> **Осколки:** [ ${shardIds.map((id) => (id === currentShardId ? `**${id}**` : id)).join(", ")} ]`,
          ].join("\n"),
        ),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `・Задержка: **${Math.round(avgLatency)}ms**`,
            `・Обработка команд: **${Math.round(avgCmdMs)}ms**`,
            `・Аптайм: **${uptimeStr}**`,
          ].join("\n"),
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `**Серверов:** ${totalGuilds.toLocaleString()}　　**Пользователей:** ${totalUsers.toLocaleString()}`,
            `**Версия:** ${getBotVersion()}　　**Осколки:** ${totalShards}/${totalShards}`,
          ].join("\n"),
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `**Система**`,
            `・RAM бота: ${sys.botRam}`,
            `・RAM сервера: ${sys.sysUsed} / ${sys.sysTotal} (${sys.ramPercent}%) · свободно: ${sys.sysFree}`,
            `・CPU: ${sys.cpuModel} (${sys.cpuCores} cores)`,
          ].join("\n"),
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [`**Осколки**`, shardRows || L.stats.noData].join("\n"),
        ),
      );

    await interaction.reply({
      flags: V2_FLAG | EPHEMERAL_FLAG,
      components: [container],
      allowedMentions: { parse: [] },
    });
  }
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}д`);
  if (h > 0) parts.push(`${h}ч`);
  if (m > 0) parts.push(`${m}м`);
  parts.push(`${s}с`);
  return parts.join(" ");
}
