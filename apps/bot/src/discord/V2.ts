import type { ActionRowBuilder, MessageActionRowComponentBuilder } from "discord.js";
import { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder } from "discord.js";

export const V2_FLAG = 32768;

export const EPHEMERAL_FLAG = 64;

export const FLAGS_V2_EPHEMERAL = V2_FLAG | EPHEMERAL_FLAG;

export interface V2Payload {
  flags: number;
  components: [ContainerBuilder];

  allowedMentions: { parse: [] };
}

export interface V2ActionOptions {
  title: string;

  text: string;

  actorId?: string | null;

  actorName?: string;

  details?: string[];
  avatarUrl?: string | null;
  accentColor?: number | null;

  rows?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
  ephemeral?: boolean;
}

export function v2Action(opts: V2ActionOptions): V2Payload {
  const actor = opts.actorId ? `<@${opts.actorId}>` : (opts.actorName ?? "Пользователь");

  const lines = [`# ${opts.title}`, `${actor}, ${opts.text}`];
  for (const d of opts.details ?? []) {
    lines.push(`> ${d}`);
  }

  const section = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join("\n")),
  );

  if (opts.avatarUrl) {
    section.setThumbnailAccessory(new ThumbnailBuilder().setURL(opts.avatarUrl));
  }

  let container = new ContainerBuilder();
  if (opts.accentColor != null) {
    container = container.setAccentColor(opts.accentColor);
  }
  container.addSectionComponents(section);

  if (opts.rows && opts.rows.length > 0) {
    container.addActionRowComponents(...opts.rows);
  }

  return {
    flags: opts.ephemeral === false ? V2_FLAG : FLAGS_V2_EPHEMERAL,
    components: [container],
    allowedMentions: { parse: [] },
  };
}

export async function v2ActionFor(
  guild: import("discord.js").Guild | null,
  actorId: string,
  title: string,
  text: string,
  details?: string[],
  opts?: { ephemeral?: boolean; avatarUrl?: string | null },
): Promise<V2Payload> {
  const avatarUrl =
    opts?.avatarUrl !== undefined ? opts.avatarUrl : await actorAvatarUrl(guild, actorId);
  return v2Action({
    title,
    actorId,
    text,
    ...(details ? { details } : {}),
    avatarUrl,
    ephemeral: opts?.ephemeral ?? true,
  });
}

export function v2Error(title: string, text?: string): V2Payload {
  const lines = [`# ${title}`];
  if (text) lines.push(text);

  const container = new ContainerBuilder()
    .setAccentColor(0xed4245)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));

  return {
    flags: FLAGS_V2_EPHEMERAL,
    components: [container],
    allowedMentions: { parse: [] },
  };
}

export async function actorAvatarUrl(
  guild: import("discord.js").Guild | null,
  userId: string,
): Promise<string | null> {
  if (!guild) return null;
  try {
    const m =
      guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null));
    return m?.displayAvatarURL({ extension: "png", size: 128 }) ?? null;
  } catch {
    return null;
  }
}

export function v2Log(opts: {
  title: string;
  subtitle: string;
  details?: string[];
  avatarUrl?: string | null;
}): { flags: number; components: [ContainerBuilder]; allowedMentions: { parse: [] } } {
  const lines = [`# ${opts.title}`, opts.subtitle];
  for (const d of opts.details ?? []) {
    lines.push(`> ${d}`);
  }

  const section = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join("\n")),
  );

  if (opts.avatarUrl) {
    section.setThumbnailAccessory(new ThumbnailBuilder().setURL(opts.avatarUrl));
  }

  const container = new ContainerBuilder().addSectionComponents(section);

  return {
    flags: V2_FLAG,
    components: [container],
    allowedMentions: { parse: [] },
  };
}
