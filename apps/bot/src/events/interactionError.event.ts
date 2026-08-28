import { Discord, On } from "discordx";

@Discord()
export class InteractionErrorEvent {
  @On({ event: "interactionCreate" })
  async onError([_interaction]: [
    import("discord.js").Interaction,
  ]): Promise<void> {
    // Intentionally disabled: every component/modal/slash handler owns its
    // own try/catch with deferReply/editReply. A global interactionCreate
    // handler races with discordx component dispatch.
  }
}
