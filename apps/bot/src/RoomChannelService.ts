import { ChannelType, type Guild, type VoiceChannel } from "discord.js";

export class RoomChannelService {
  /**
   * Creates the room's voice channel under the category and syncs it with
   * the category's overwrites (private: @everyone denied, bot allowed).
   * Syncing once here means every room inherits the privacy model without
   * re-setting @everyone denies per room.
   */
  async create(
    guild: Guild,
    name: string,
    categoryId: string | null,
    userLimit: number,
  ): Promise<VoiceChannel> {
    const voice = categoryId
      ? await guild.channels.create({
          name,
          type: ChannelType.GuildVoice,
          parent: categoryId,
          userLimit,
        })
      : await guild.channels.create({
          name,
          type: ChannelType.GuildVoice,
          userLimit,
        });

    if (categoryId) {
      // Copy the category overwrites into the room (synced state).
      await voice.lockPermissions().catch(() => undefined);
    }

    return voice;
  }

  async delete(channel: VoiceChannel): Promise<void> {
    await channel.delete();
  }
}
