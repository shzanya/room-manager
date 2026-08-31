import type { RoomService } from "@room-manager/core";
import type { RoomRepository } from "@room-manager/database";
import type { Logger } from "@room-manager/logger";
import type { ChannelId, GuildId, UserId } from "@room-manager/shared";
import {
  ActionRowBuilder,
  type ContainerBuilder,
  type Guild,
  GuildMember,
  PermissionFlagsBits,
  TextDisplayBuilder,
  UserSelectMenuBuilder,
} from "discord.js";
import { ButtonComponent, Discord, SelectMenuComponent } from "discordx";
import {
  actorAvatarUrl,
  v2Action,
  v2ActionFor,
  v2Error,
} from "../../discord/V2";
import { USER_ACTIONS } from "../../discord/vcActions";
import { format, tOf } from "../../i18n";
import { svc } from "../../services/registry";
import type { SetupService } from "../../services/SetupService";

/** Guild-scoped dictionary for the room these components belong to. */
function L0(guild: Guild | null | undefined) {
  return tOf(guild?.id);
}

function userRow(customId: string, placeholder: string) {
  return new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setMinValues(1)
      .setMaxValues(1),
  );
}

export async function buildMutesView(
  guild: Guild,
  invokerId: string,
  roomId: string,
  mode: "both" | "mute" | "unmute" = "both",
  notice?: string,
): Promise<{ flags: number; components: [ContainerBuilder] }> {
  const L = L0(guild);
  const muted = await svc().mutes.list(roomId as import("@room-manager/shared").RoomId);
  const mutedList = muted.map((id) => `<@${id}>`).join(", ");

  // Tribunal-style header with the actor's avatar.
  const payload = v2Action({
    title: L.mutes.title,
    actorId: invokerId,
    text: L.mutes.prompt,
    avatarUrl: await actorAvatarUrl(guild, invokerId),
  });

  const container = payload.components[0];

  if (mode === "both" || mode === "mute")
    container.addActionRowComponents(
      userRow("room:mutes:mute", L.mutes.addPlaceholder),
    );
  if (mode === "both" || mode === "unmute")
    container.addActionRowComponents(
      userRow("room:mutes:unmute", L.mutes.removePlaceholder),
    );

  if (notice) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`> ${notice}`),
    );
  }

  // Current state listed BELOW the controls.
  if (mutedList) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${L.mutes.mutedList}** ${mutedList}`,
      ),
    );
  }

  return { flags: payload.flags, components: [container] };
}

export async function buildWhitelistView(
  guild: Guild,
  invokerId: string,
  roomId: string,
  mode: "both" | "add" | "remove" = "both",
  notice?: string,
): Promise<{ flags: number; components: [ContainerBuilder] }> {
  const L = L0(guild);
  const allowed = await svc().whitelists.list(roomId as import("@room-manager/shared").RoomId);
  const allowedText = allowed.map((id) => `<@${id}>`).join(", ");

  // Tribunal-style header with the actor's avatar.
  const payload = v2Action({
    title: L.access.title,
    actorId: invokerId,
    text: L.access.prompt,
    avatarUrl: await actorAvatarUrl(guild, invokerId),
  });

  const container = payload.components[0];

  if (mode === "both" || mode === "add")
    container.addActionRowComponents(
      userRow("room:wl:add", L.access.addPlaceholder),
    );
  if (mode === "both" || mode === "remove")
    container.addActionRowComponents(
      userRow("room:wl:remove", L.access.removePlaceholder),
    );

  if (notice) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`> ${notice}`),
    );
  }

  // Current whitelist listed BELOW the controls.
  if (allowedText) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${L.access.listLabel}** ${allowedText}`,
      ),
    );
  }

  return { flags: payload.flags, components: [container] };
}

// Permission flags per Discord API (UseSoundboard = 1n << 42n,
// UseExternalSounds = 1n << 45n, UseEmbeddedActivities = 1n << 39n).
const BIT_SOUNDBOARD = PermissionFlagsBits.UseSoundboard;
const BIT_SOUNDBOARD_EXTERNAL = PermissionFlagsBits.UseExternalSounds;
const BIT_ACTIVITIES = PermissionFlagsBits.UseEmbeddedActivities;

/**
 * discord.js accepts PascalCase keys with `false` (explicit deny) and
 * `null` (remove overwrite) — no manual bitfield juggling needed.
 */
async function setSoundboardDenied(
  channel: import("discord.js").VoiceBasedChannel,
  denied: boolean,
): Promise<void> {
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    UseSoundboard: denied ? false : null,
    UseExternalSounds: denied ? false : null,
  });
}

async function setActivitiesDenied(
  channel: import("discord.js").VoiceBasedChannel,
  denied: boolean,
): Promise<void> {
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    UseEmbeddedActivities: denied ? false : null,
  });
}

/** Whether @everyone is denied the given permission bit in the room. */
export function hasRoomBit(
  channel: import("discord.js").VoiceBasedChannel,
  bit: bigint,
): boolean {
  const everyone = channel.guild.roles.everyone;
  const cur = channel.permissionOverwrites.cache.get(everyone.id);
  return cur ? cur.deny.has(bit) : false;
}

/** The bot must be allowed to edit overwrites on this channel. */
function botCanEditOverwrites(
  channel: import("discord.js").VoiceBasedChannel,
): boolean {
  const me = channel.guild.members.me;
  return Boolean(
    me?.permissionsIn(channel).has(PermissionFlagsBits.ManageRoles),
  );
}

@Discord()
export class VoiceControlSelects {
  private readonly logger: Logger = svc().logger;
  private readonly roomRepository: RoomRepository = svc().roomRepository;
  private readonly roomService: RoomService = svc().roomService;
  private readonly setupService: SetupService = svc().setupService;

  @SelectMenuComponent({ id: "room:vc:manage" })
  async onManage(
    interaction: import("discord.js").StringSelectMenuInteraction,
  ): Promise<void> {
    const action = interaction.values[0];
    if (!action) return;

    if (action === "rename" || action === "limit") {
      const Lm = L0(interaction.guild);
      await interaction.showModal({
        customId:
          action === "rename" ? "room:rename:modal" : "room:limit:modal",
        title: action === "rename" ? Lm.rename.modalTitle : Lm.limit.modalTitle,
        components: [
          {
            type: 1,
            components: [
              action === "rename"
                ? {
                    type: 4,
                    customId: "room:rename:input",
                    label: Lm.rename.modalLabel,
                    style: 1,
                    maxLength: 100,
                    required: true,
                  }
                : {
                    type: 4,
                    customId: "room:limit:input",
                    label: Lm.limit.modalLabel,
                    style: 1,
                    maxLength: 2,
                    required: true,
                  },
            ],
          },
        ],
      });
      return;
    }

    try {
      await interaction.deferUpdate();

      if (!interaction.channelId || !interaction.guild) return;

      const member = interaction.member;
      if (!(member instanceof GuildMember)) return;

      const room = await this.roomRepository.findByChannelId(
        interaction.channelId as ChannelId,
      );
      if (!room || room.ownerId !== interaction.user.id) return;

      const guild = interaction.guild;
      const channel = await guild.channels.fetch(interaction.channelId);
      if (!channel?.isVoiceBased()) return;

      if (action === "lock" || action === "unlock") {
        const locked = action === "lock";
        if (locked === room.locked) return;

        const L = L0(guild);
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          Connect: locked ? false : null,
        });
        await this.roomRepository.update(room.id, { locked });

        await svc().logService.send(guild, guild.id as GuildId, {
          type: locked ? "lock" : "unlock",
          actorId: interaction.user.id,
        });

        // Unified ephemeral feedback (was silent before).
        await interaction.followUp({
          ...(await v2ActionFor(
            guild,
            interaction.user.id,
            L.access.title,
            locked ? L.lock.closedText : L.lock.openedText,
            [locked ? L.lock.deniedDetail : L.lock.allowedDetail],
          )),
        });
        await this.setupService.refreshPanel(guild);
        return;
      }

      if (action === "soundpad") {
        const denied =
          hasRoomBit(channel, BIT_SOUNDBOARD) ||
          hasRoomBit(channel, BIT_SOUNDBOARD_EXTERNAL);
        const nowDenied = !denied;
        const L = L0(guild);

        if (!botCanEditOverwrites(channel)) {
          await interaction.followUp({
            ...v2Error(L.soundpad.label, L.common.botMissingPerms),
          });
          return;
        }

        await setSoundboardDenied(channel, nowDenied);
        this.logger.info(
          `soundboard overwrite: allow=${channel.permissionOverwrites.cache.get(guild.roles.everyone.id)?.allow.bitfield} deny=${channel.permissionOverwrites.cache.get(guild.roles.everyone.id)?.deny.bitfield}`,
        );

        await svc().logService.send(guild, guild.id as GuildId, {
          type: "soundboard",
          actorId: interaction.user.id,
          details: [
            nowDenied
              ? L0(guild).soundpad.disabledWord
              : L0(guild).soundpad.enabledWord,
          ],
        });
        await interaction.followUp({
          ...(await v2ActionFor(
            guild,
            interaction.user.id,
            L.soundpad.label,
            format(L.soundpad.doneText, {
              action: nowDenied
                ? L.soundpad.disabledWord
                : L.soundpad.enabledWord,
            }),
            [
              format(L.soundpad.status, {
                status: nowDenied ? L.soundpad.off : L.soundpad.on,
              }),
            ],
          )),
        });
        return;
      }

      if (action === "activities") {
        const deniedA = hasRoomBit(channel, BIT_ACTIVITIES);
        const nowDeniedA = !deniedA;
        const L = L0(guild);

        if (!botCanEditOverwrites(channel)) {
          await interaction.followUp({
            ...v2Error(L.activities.label, L.common.botMissingPerms),
          });
          return;
        }

        await setActivitiesDenied(channel, nowDeniedA);

        await svc().logService.send(guild, guild.id as GuildId, {
          type: "activities",
          actorId: interaction.user.id,
          details: [
            nowDeniedA
              ? L0(guild).activities.disabledWord
              : L0(guild).activities.enabledWord,
          ],
        });
        await interaction.followUp({
          ...(await v2ActionFor(
            guild,
            interaction.user.id,
            L.activities.label,
            format(L.activities.doneText, {
              action: nowDeniedA
                ? L.activities.disabledWord
                : L.activities.enabledWord,
            }),
            [
              format(L.activities.status, {
                status: nowDeniedA ? L.activities.off : L.activities.on,
              }),
            ],
          )),
        });
        return;
      }

      if (action === "mutes") {
        await interaction.followUp(
          await buildMutesView(guild, interaction.user.id, room.id),
        );
        return;
      }

      if (action === "wl") {
        // Hydrate whitelist from existing channel overwrites.
        const allowed = [...channel.permissionOverwrites.cache.values()]
          .filter(
            (o) => o.type === 1 && o.allow.has(PermissionFlagsBits.Connect),
          )
          .map((o) => o.id);
        for (const id of allowed) await svc().whitelists.add(room.id as import("@room-manager/shared").RoomId, id as import("@room-manager/shared").UserId);

        await interaction.followUp(
          await buildWhitelistView(guild, interaction.user.id, room.id),
        );
        return;
      }

      if (USER_ACTIONS.has(action) || action === "owner") {
        const isOwner = action === "owner";
        const L = L0(guild);
        await interaction.followUp({
          ...v2Action({
            title: isOwner ? L.transfer.title : L.kick.title,
            actorId: interaction.user.id,
            text: isOwner ? L.transfer.promptText : L.kick.promptText,
            avatarUrl: await actorAvatarUrl(guild, interaction.user.id),
            rows: [
              userRow(
                `room:vc:user:${action}`,
                isOwner ? L.transfer.placeholder : L.kick.placeholder,
              ),
            ],
          }),
        });
      }
    } catch (error) {
      this.logger.error("voice control manage failed", error);
    }
  }

  @SelectMenuComponent({ id: /^room:vc:user:/ })
  async onUserPick(
    interaction: import("discord.js").StringSelectMenuInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const action = interaction.customId.slice("room:vc:user:".length);
      const targetUserId = interaction.values[0];
      if (!targetUserId || !interaction.guild || !interaction.channelId) return;

      const member = interaction.member;
      if (!(member instanceof GuildMember)) return;

      const room = await this.roomRepository.findByChannelId(
        interaction.channelId as ChannelId,
      );
      if (!room || room.ownerId !== interaction.user.id) return;

      const guild = interaction.guild;
      const L = L0(guild);
      const voiceChannel = await guild.channels.fetch(room.channelId);
      if (!voiceChannel?.isVoiceBased()) return;

      // Thumbnail = target avatar (person the action is about).
      const targetAvatar =
        (
          await guild.members.fetch(targetUserId).catch(() => null)
        )?.displayAvatarURL({ extension: "png", size: 128 }) ?? null;

      switch (action) {
        case "accessAdd": {
          await voiceChannel.permissionOverwrites.edit(targetUserId, {
            ViewChannel: true,
            Connect: true,
          });
          await svc().whitelists.add(room.id as import("@room-manager/shared").RoomId, targetUserId as import("@room-manager/shared").UserId);

          await svc().logService.send(guild, guild.id as GuildId, {
            type: "whitelist",
            actorId: interaction.user.id,
            userId: targetUserId,
            details: ["добавил"],
          });

          await interaction.editReply({
            ...(await v2ActionFor(
              guild,
              interaction.user.id,
              L.access.title,
              L.access.grantedText,
              [format(L.common.userLabel, { user: `<@${targetUserId}>` })],
              { avatarUrl: targetAvatar },
            )),
          });
          break;
        }
        case "accessRemove": {
          await voiceChannel.permissionOverwrites.edit(targetUserId, {
            ViewChannel: null,
            Connect: null,
          });
          await svc().whitelists.remove(room.id as import("@room-manager/shared").RoomId, targetUserId as import("@room-manager/shared").UserId);

          await svc().logService.send(guild, guild.id as GuildId, {
            type: "whitelist",
            actorId: interaction.user.id,
            userId: targetUserId,
            details: ["убрал"],
          });

          // If target is sitting in this room — kick them out.
          const inside = voiceChannel.members.get(targetUserId);
          if (inside)
            await inside.voice.setChannel(null).catch(() => undefined);

          await interaction.editReply({
            ...(await v2ActionFor(
              guild,
              interaction.user.id,
              L.access.title,
              L.access.revokedText,
              [format(L.common.userLabel, { user: `<@${targetUserId}>` })],
              { avatarUrl: targetAvatar },
            )),
          });
          break;
        }
        case "kick": {
          const m = voiceChannel.members.get(targetUserId);
          if (!m) {
            await interaction.editReply({
              ...v2Error(L.kick.title, L.kick.targetNotInRoom),
            });
            return;
          }
          await m.voice.setChannel(null);

          await svc().logService.send(guild, guild.id as GuildId, {
            type: "kick",
            actorId: interaction.user.id,
            userId: targetUserId,
          });

          await interaction.editReply({
            ...(await v2ActionFor(
              guild,
              interaction.user.id,
              L.kick.title,
              L.kick.doneText,
              [format(L.common.memberLabel, { user: `<@${targetUserId}>` })],
              { avatarUrl: targetAvatar },
            )),
          });
          break;
        }
        case "owner": {
          const m = voiceChannel.members.get(targetUserId);
          if (!m) {
            await interaction.editReply({
              ...v2Error(L.transfer.title, L.access.targetNotInRoom),
            });
            return;
          }

          await this.roomService.update(room.id, {
            ownerId: targetUserId as UserId,
          });

          await svc().logService.send(guild, guild.id as GuildId, {
            type: "transfer",
            actorId: interaction.user.id,
            userId: targetUserId,
          });

          await interaction.editReply({
            ...v2Action({
              title: L.transfer.title,
              actorId: interaction.user.id,
              text: L.transfer.doneText,
              details: [
                format(L.transfer.newOwner, { user: `<@${targetUserId}>` }),
              ],
              avatarUrl: targetAvatar,
            }),
          });
          await this.setupService.refreshPanel(guild);
          break;
        }
        default:
          return;
      }
    } catch (error) {
      this.logger.error("voice user pick failed", error);
    }
  }

  @SelectMenuComponent({ id: "room:mutes:mute" })
  async onMutePick(
    interaction: import("discord.js").UserSelectMenuInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const targetUserId = interaction.values[0];
      if (!targetUserId || !interaction.guild || !interaction.channelId) return;

      // Anti-self / anti-bot guard
      if (targetUserId === interaction.user.id) {
        await interaction.editReply({
          ...v2Error(
            L0(interaction.guild).mutes.title,
            L0(interaction.guild).common.invalidTarget,
          ),
        });
        return;
      }
      const targetMember = await interaction.guild.members
        .fetch(targetUserId)
        .catch(() => null);
      if (targetMember?.user.bot) {
        await interaction.editReply({
          ...v2Error(
            L0(interaction.guild).mutes.title,
            L0(interaction.guild).common.invalidTarget,
          ),
        });
        return;
      }

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) return;

      const room = await this.roomRepository.findByChannelId(
        member.voice.channelId as ChannelId,
      );
      if (!room || room.ownerId !== interaction.user.id) return;

      const voiceChannel = await interaction.guild.channels.fetch(
        room.channelId,
      );
      if (!voiceChannel?.isVoiceBased()) return;

      await voiceChannel.permissionOverwrites.edit(targetUserId, {
        Speak: false,
      });
      await svc().mutes.add(room.id as import("@room-manager/shared").RoomId, targetUserId as import("@room-manager/shared").UserId);

      await svc().logService.send(
        interaction.guild,
        interaction.guild.id as GuildId,
        {
          type: "mute",
          actorId: interaction.user.id,
          userId: targetUserId,
        },
      );

      await interaction.editReply(
        await buildMutesView(
          interaction.guild,
          interaction.user.id,
          room.id,
          "both",
          format(L0(interaction.guild).mutes.muteNotice, {
            user: `<@${targetUserId}>`,
          }),
        ),
      );
    } catch (error) {
      this.logger.error("mute pick failed", error);
    }
  }

  @SelectMenuComponent({ id: "room:mutes:unmute" })
  async onUnmutePick(
    interaction: import("discord.js").StringSelectMenuInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const targetUserId = interaction.values[0];
      if (!targetUserId || targetUserId === "__noop__") return;
      if (!interaction.guild || !interaction.channelId) return;

      // Anti-self guard (unmute can target self)
      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) return;

      const room = await this.roomRepository.findByChannelId(
        member.voice.channelId as ChannelId,
      );
      if (!room || room.ownerId !== interaction.user.id) return;

      await interaction.guild.members.fetch(targetUserId).catch(() => null);

      const ch = await interaction.guild.channels
        .fetch(room.channelId)
        .catch(() => null);
      if (ch?.isVoiceBased()) {
        await ch.permissionOverwrites.edit(targetUserId, { Speak: null });
      }
      await svc().mutes.remove(room.id as import("@room-manager/shared").RoomId, targetUserId as import("@room-manager/shared").UserId);

      await svc().logService.send(
        interaction.guild,
        interaction.guild.id as GuildId,
        {
          type: "unmute",
          actorId: interaction.user.id,
          userId: targetUserId,
        },
      );

      await interaction.editReply(
        await buildMutesView(
          interaction.guild,
          interaction.user.id,
          room.id,
          "both",
          format(L0(interaction.guild).mutes.unmuteNotice, {
            user: `<@${targetUserId}>`,
          }),
        ),
      );
    } catch (error) {
      this.logger.error("unmute pick failed", error);
    }
  }

  @ButtonComponent({ id: "room:mutes:view" })
  async onMutesBack(
    interaction: import("discord.js").ButtonInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const member = interaction.member;
      if (
        !(member instanceof GuildMember) ||
        !member.voice.channelId ||
        !interaction.guild
      )
        return;

      const room = await this.roomRepository.findByChannelId(
        member.voice.channelId as ChannelId,
      );
      if (!room) return;

      await interaction.editReply(
        await buildMutesView(interaction.guild, interaction.user.id, room.id),
      );
    } catch (error) {
      this.logger.error("mutes back failed", error);
    }
  }

  @ButtonComponent({ id: "room:wl:view" })
  async onWlBack(
    interaction: import("discord.js").ButtonInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const member = interaction.member;
      if (
        !(member instanceof GuildMember) ||
        !member.voice.channelId ||
        !interaction.guild
      )
        return;

      const room = await this.roomRepository.findByChannelId(
        member.voice.channelId as ChannelId,
      );
      if (!room) return;

      await interaction.editReply(
        await buildWhitelistView(
          interaction.guild,
          interaction.user.id,
          room.id,
        ),
      );
    } catch (error) {
      this.logger.error("wl back failed", error);
    }
  }

  @SelectMenuComponent({ id: "room:wl:add" })
  async onWlAdd(
    interaction: import("discord.js").UserSelectMenuInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const targetUserId = interaction.values[0];
      if (!targetUserId || !interaction.guild || !interaction.channelId) return;

      // Anti-self / anti-bot guard
      if (targetUserId === interaction.user.id) {
        await interaction.editReply({
          ...v2Error(
            L0(interaction.guild).access.title,
            L0(interaction.guild).common.invalidTarget,
          ),
        });
        return;
      }
      const targetMember = await interaction.guild.members
        .fetch(targetUserId)
        .catch(() => null);
      if (targetMember?.user.bot) {
        await interaction.editReply({
          ...v2Error(
            L0(interaction.guild).access.title,
            L0(interaction.guild).common.invalidTarget,
          ),
        });
        return;
      }

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) return;

      const room = await this.roomRepository.findByChannelId(
        member.voice.channelId as ChannelId,
      );
      if (!room || room.ownerId !== interaction.user.id) return;

      const channel = await interaction.guild.channels.fetch(room.channelId);
      if (!channel?.isVoiceBased()) return;

      await channel.permissionOverwrites.edit(targetUserId, {
        ViewChannel: true,
        Connect: true,
      });
      await svc().whitelists.add(room.id as import("@room-manager/shared").RoomId, targetUserId as import("@room-manager/shared").UserId);

      await interaction.editReply(
        await buildWhitelistView(
          interaction.guild,
          interaction.user.id,
          room.id,
          "both",
          format(L0(interaction.guild).access.grantNotice, {
            user: `<@${targetUserId}>`,
          }),
        ),
      );
    } catch (error) {
      this.logger.error("whitelist add failed", error);
    }
  }

  @SelectMenuComponent({ id: "room:wl:remove" })
  async onWlRemove(
    interaction: import("discord.js").StringSelectMenuInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();

      const targetUserId = interaction.values[0];
      if (!targetUserId || targetUserId === "__noop__") return;
      if (!interaction.guild || !interaction.channelId) return;

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.voice.channelId) return;

      const room = await this.roomRepository.findByChannelId(
        member.voice.channelId as ChannelId,
      );
      if (!room || room.ownerId !== interaction.user.id) return;

      const channel = await interaction.guild.channels.fetch(room.channelId);
      if (!channel?.isVoiceBased()) return;

      await channel.permissionOverwrites.edit(targetUserId, {
        ViewChannel: null,
        Connect: null,
      });
      await svc().whitelists.remove(room.id as import("@room-manager/shared").RoomId, targetUserId as import("@room-manager/shared").UserId);

      // If target is sitting in this room — kick them out.
      const inside = channel.members.get(targetUserId);
      if (inside) await inside.voice.setChannel(null).catch(() => undefined);

      await interaction.editReply(
        await buildWhitelistView(
          interaction.guild,
          interaction.user.id,
          room.id,
          "both",
          format(L0(interaction.guild).access.revokeNotice, {
            user: `<@${targetUserId}>`,
          }),
        ),
      );
    } catch (error) {
      this.logger.error("whitelist remove failed", error);
    }
  }
}
