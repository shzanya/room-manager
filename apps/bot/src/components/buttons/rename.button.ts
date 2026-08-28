import type { Logger } from "@room-manager/logger";
import type { ButtonInteraction } from "discord.js";
import { ActionRowBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { ButtonComponent, Discord } from "discordx";
import { v2Error } from "../../discord/V2";
import { tOf } from "../../i18n";
import { svc } from "../../services/registry";

@Discord()
export class RenameButton {
  private readonly logger: Logger = svc().logger;

  @ButtonComponent({ id: "room:rename" })
  async onButton(interaction: ButtonInteraction): Promise<void> {
    try {
      const L = tOf(interaction.guild?.id);
      await interaction.showModal({
        customId: "room:rename:modal",
        title: L.rename.modalTitle,
        components: [
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("room:rename:input")
              .setLabel(L.rename.modalLabel)
              .setStyle(TextInputStyle.Short)
              .setMaxLength(100)
              .setRequired(true),
          ),
        ],
      });
    } catch (error) {
      this.logger.error("Failed to open rename modal", error);
      const L = tOf(interaction.guild?.id);
      await interaction.reply({
        ...v2Error(L.rename.title, L.common.error),
      });
    }
  }
}
