import { Discord, On } from "discordx";

@Discord()
export class InteractionErrorEvent {
  @On({ event: "interactionCreate" })
  async onError([_interaction]: [import("discord.js").Interaction]): Promise<void> {}
}
