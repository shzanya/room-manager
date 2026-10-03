import { ChannelType, type Guild, type VoiceChannel } from "discord.js";

export class RoomChannelService {
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
      await voice.lockPermissions().catch(() => undefined);
    }

    return voice;
  }

  async delete(channel: VoiceChannel): Promise<void> {
    await channel.delete();
  }
}
