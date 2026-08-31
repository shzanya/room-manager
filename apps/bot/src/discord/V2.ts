import type {
  ActionRowBuilder,
  MessageActionRowComponentBuilder,
} from "discord.js";
import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";

/** IS_COMPONENTS_V2 message flag. */
export const V2_FLAG = 32768;
/** Ephemeral message flag. */
export const EPHEMERAL_FLAG = 64;

export const FLAGS_V2_EPHEMERAL = V2_FLAG | EPHEMERAL_FLAG;

/** Payload accepted by channel.send / interaction replies. */
export interface V2Payload {
  flags: number;
  components: [ContainerBuilder];
  /** Mentions render as tags but NEVER ping anyone. */
  allowedMentions: { parse: [] };
}

export interface V2ActionOptions {
  title: string;
  /** What happened, addressed to the actor ("Вы изменили лимит..."). */
  text: string;
  /** Actor id — rendered as a live mention <@id>. */
  actorId?: string | null;
  /** Fallback display name when actorId is unavailable (no ping). */
  actorName?: string;
  /** What exactly changed — rendered as "> ..." blockquote lines. */
  details?: string[];
  avatarUrl?: string | null;
  accentColor?: number | null;
  /** Extra component rows (selects) appended under the text. */
  rows?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
  ephemeral?: boolean;
}

/**
 * The single unified action container used for EVERY bot answer:
 *
 *   # <Title>
 *   <@actor>, <text>
 *   > <what changed>
 *
 * with the actor's avatar as a section thumbnail (right side).
 */
export function v2Action(opts: V2ActionOptions): V2Payload {
  const actor = opts.actorId
    ? `<@${opts.actorId}>`
    : (opts.actorName ?? "Пользователь");

  const lines = [`# ${opts.title}`, `${actor}, ${opts.text}`];
  for (const d of opts.details ?? []) {
    lines.push(`> ${d}`);
  }

  const section = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join("\n")),
  );

  if (opts.avatarUrl) {
    section.setThumbnailAccessory(
      new ThumbnailBuilder().setURL(opts.avatarUrl),
    );
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

/**
 * Convenience: resolves the actor's avatar automatically.
 * The actor is mentioned via <@id>.
 */
export async function v2ActionFor(
  guild: import("discord.js").Guild | null,
  actorId: string,
  title: string,
  text: string,
  details?: string[],
  opts?: { ephemeral?: boolean; avatarUrl?: string | null },
): Promise<V2Payload> {
  const avatarUrl =
    opts?.avatarUrl !== undefined
      ? opts.avatarUrl
      : await actorAvatarUrl(guild, actorId);
  return v2Action({
    title,
    actorId,
    text,
    ...(details ? { details } : {}),
    avatarUrl,
    ephemeral: opts?.ephemeral ?? true,
  });
}

/** Unified error container (red accent, titled, no emoji). */
export function v2Error(title: string, text?: string): V2Payload {
  const lines = [`# ${title}`];
  if (text) lines.push(text);

  const container = new ContainerBuilder()
    .setAccentColor(0xed4245)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join("\n")),
    );

  return {
    flags: FLAGS_V2_EPHEMERAL,
    components: [container],
    allowedMentions: { parse: [] },
  };
}

/** Avatar URL for thumbnails (falls back to null). */
export async function actorAvatarUrl(
  guild: import("discord.js").Guild | null,
  userId: string,
): Promise<string | null> {
  if (!guild) return null;
  try {
    const m =
      guild.members.cache.get(userId) ??
      (await guild.members.fetch(userId).catch(() => null));
    return m?.displayAvatarURL({ extension: "png", size: 128 }) ?? null;
  } catch {
    return null;
  }
}

/**
 * Tribunal-style log container — no accent color, avatar thumbnail,
 * header + subtitle + blockquote details. Used for log channel messages.
 */
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
    section.setThumbnailAccessory(
      new ThumbnailBuilder().setURL(opts.avatarUrl),
    );
  }

  const container = new ContainerBuilder().addSectionComponents(section);

  return {
    flags: V2_FLAG,
    components: [container],
    allowedMentions: { parse: [] },
  };
}
