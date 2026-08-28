import { GatewayIntentBits } from "discord.js";
import { Client } from "discordx";

export function createDiscordClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
    silent: false,
  });
}
