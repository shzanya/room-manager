import type { Logger } from "@room-manager/logger";
import type { ButtonInteraction } from "discord.js";
import { ActionRowBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { ButtonComponent, Discord } from "discordx";
import { v2Error } from "../../discord/V2";
import { tOf } from "../../i18n";
import { svc } from "../../services/registry";

@Discord()
export class LimitButton {
  private readonly logger: Logger = svc().logger;

  @ButtonComponent({ id: "room:limit" })
  async onButton(interaction: ButtonInteraction): Promise<void> {
    try {
      const L = tOf(interaction.guild?.id);
      await interaction.showModal({
        customId: "room:limit:modal",
        title: L.limit.modalTitle,
        components: [
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("room:limit:input")
              .setLabel(L.limit.modalLabel)
              .setStyle(TextInputStyle.Short)
              .setMaxLength(2)
              .setRequired(true),
          ),
        ],
      });
    } catch (error) {
      this.logger.error("Failed to open limit modal", error);
      const L = tOf(interaction.guild?.id);
      await interaction.reply({
        ...v2Error(L.limit.title, L.common.error),
      });
    }
  }
}
