import type { Logger } from "@room-manager/logger";
import { Events, type VoiceState } from "discord.js";
import { Discord, On } from "discordx";
import { svc } from "../services/registry";
import type { VoiceStateHandler } from "../VoiceStateHandler";

@Discord()
export class VoiceStateUpdateEvent {
  private readonly logger: Logger = svc().logger;
  private readonly voiceStateHandler: VoiceStateHandler = svc().voiceStateHandler;

  @On({ event: Events.VoiceStateUpdate })
  async onVoiceStateUpdate([oldState, newState]: [VoiceState, VoiceState]): Promise<void> {
    try {
      await this.voiceStateHandler.handle(oldState, newState);
    } catch (error) {
      this.logger.error("Failed to handle voice state update", error);
    }
  }
}
