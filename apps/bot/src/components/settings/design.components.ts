import type { Logger } from "@room-manager/logger";
import type { GuildId } from "@room-manager/shared";
import {
  ActionRowBuilder,
  type Attachment,
  type ButtonInteraction,
  GuildMember,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { ButtonComponent, Discord, ModalComponent } from "discordx";
import { actorAvatarUrl, v2Action, v2ActionFor, v2Error } from "../../discord/V2";
import { format, tOf } from "../../i18n";
import type { BannerService } from "../../services/BannerService";
import type { IconSettingsService } from "../../services/IconSettingsService";
import { svc } from "../../services/registry";

function hasManageGuild(interaction: ButtonInteraction): boolean {
  const member = interaction.member;
  return member instanceof GuildMember && member.permissions.has("ManageGuild");
}

@Discord()
export class DesignComponents {
  private readonly logger: Logger = svc().logger;
  private readonly iconSettings: IconSettingsService = svc().iconSettings;
  private readonly bannerService: BannerService = svc().bannerService;

  @ButtonComponent({ id: "setup:banner:url" })
  async onBannerUrl(interaction: ButtonInteraction): Promise<void> {
    try {
      const L = tOf(interaction.guild?.id);
      if (!hasManageGuild(interaction)) {
        await interaction.reply({
          ...v2Error(L.settings.designTitle, L.settings.textNoPerms),
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId("setup:banner:url:modal")
        .setTitle(L.settings.urlModalTitle)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("setup:banner:url:input")
              .setLabel(L.settings.urlInputLabel)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("https://cdn.discordapp.com/...")
              .setRequired(true),
          ),
        );

      await interaction.showModal(modal);
    } catch (error) {
      this.logger.error("Failed to show banner URL modal", error);
      await interaction.reply({
        ...v2Error(
          tOf(interaction.guild?.id).settings.designTitle,
          tOf(interaction.guild?.id).common.error,
        ),
      });
    }
  }

  @ModalComponent({ id: "setup:banner:url:modal" })
  async onBannerUrlModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const L = tOf(interaction.guild?.id);

      if (interaction.isFromMessage()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.permissions.has("ManageGuild")) {
        await interaction.editReply({
          ...v2Error(L.settings.designTitle, L.settings.textNoPerms),
        });
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({
          ...v2Error(L.settings.designTitle, L.common.guildFail),
        });
        return;
      }

      const url = interaction.fields.getTextInputValue("setup:banner:url:input");

      const validation = this.bannerService.validateUrl(url);
      if (!validation.valid) {
        await interaction.editReply({
          ...v2Error(L.settings.urlModalTitle, validation.error ?? "Invalid URL."),
        });
        return;
      }

      await this.bannerService.setCustomUrl(guild.id as GuildId, url);
      await svc().setupService.refreshPanel(guild);

      await this.iconSettings.renderDesignInto(interaction, guild, L.settings.flashUrlSet);
    } catch (error) {
      this.logger.error("Failed to set banner URL", error);
      const L = tOf(interaction.guild?.id);
      await interaction.editReply({
        ...v2Error(L.settings.urlModalTitle, L.common.error),
      });
    }
  }

  @ButtonComponent({ id: "setup:banner:reset" })
  async onBannerReset(interaction: ButtonInteraction): Promise<void> {
    try {
      await interaction.deferUpdate();

      const L = tOf(interaction.guild?.id);
      if (!hasManageGuild(interaction)) {
        await interaction.editReply({
          ...v2Error(L.settings.designTitle, L.settings.textNoPerms),
        });
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({
          ...v2Error(L.settings.designTitle, L.common.guildFail),
        });
        return;
      }

      await this.bannerService.resetToDefault(guild.id as GuildId);
      await svc().setupService.refreshPanel(guild);

      await this.iconSettings.renderDesignInto(interaction, guild, L.settings.flashReset);
    } catch (error) {
      this.logger.error("Failed to reset banner", error);
      await interaction.editReply({
        ...v2Error(
          tOf(interaction.guild?.id).settings.designTitle,
          tOf(interaction.guild?.id).common.error,
        ),
      });
    }
  }

  @ButtonComponent({ id: "setup:design:text" })
  async onDesignText(interaction: ButtonInteraction): Promise<void> {
    try {
      const L = tOf(interaction.guild?.id);
      if (!hasManageGuild(interaction)) {
        await interaction.reply({
          ...v2Error(L.settings.btnPanelText, L.settings.textNoPerms),
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId("setup:design:text:modal")
        .setTitle(L.settings.textModalTitle)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("setup:design:text:title")
              .setLabel(L.settings.textTitleLabel)
              .setStyle(TextInputStyle.Short)
              .setMaxLength(256)
              .setRequired(false)
              .setPlaceholder(L.settings.textTitlePlaceholder),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("setup:design:text:description")
              .setLabel(L.settings.textDescLabel)
              .setStyle(TextInputStyle.Paragraph)
              .setMaxLength(2000)
              .setRequired(false)
              .setPlaceholder(L.settings.textDescPlaceholder),
          ),
        );

      await interaction.showModal(modal);
    } catch (error) {
      this.logger.error("Failed to show panel text modal", error);
      await interaction.reply({
        ...v2Error(
          tOf(interaction.guild?.id).settings.btnPanelText,
          tOf(interaction.guild?.id).common.error,
        ),
      });
    }
  }

  @ModalComponent({ id: "setup:design:text:modal" })
  async onDesignTextModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const L = tOf(interaction.guild?.id);
      if (interaction.isFromMessage()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const member = interaction.member;
      if (!(member instanceof GuildMember) || !member.permissions.has("ManageGuild")) {
        await interaction.editReply({
          ...v2Error(
            tOf(interaction.guild?.id).settings.btnPanelText,
            tOf(interaction.guild?.id).settings.textNoPerms,
          ),
        });
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({
          ...v2Error(L.settings.btnPanelText, L.common.guildOnly),
        });
        return;
      }

      const title = interaction.fields.getTextInputValue("setup:design:text:title").trim();
      const description = interaction.fields
        .getTextInputValue("setup:design:text:description")
        .trim();

      if (!title && !description) {
        await interaction.editReply({
          ...v2Error(
            tOf(interaction.guild?.id).settings.btnPanelText,
            tOf(interaction.guild?.id).settings.textNeedField,
          ),
        });
        return;
      }

      await svc().panelText.set(guild.id as GuildId, {
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
      });
      await svc().setupService.refreshPanel(guild);

      await this.iconSettings.renderDesignInto(
        interaction,
        guild,
        tOf(guild.id).settings.flashTextChanged,
      );
    } catch (error) {
      this.logger.error("Failed to set panel text", error);
      await interaction.editReply({
        ...v2Error(
          tOf(interaction.guild?.id).settings.btnPanelText,
          tOf(interaction.guild?.id).common.error,
        ),
      });
    }
  }

  @ButtonComponent({ id: "setup:design:text:reset" })
  async onDesignTextReset(interaction: ButtonInteraction): Promise<void> {
    try {
      await interaction.deferUpdate();
      const L = tOf(interaction.guild?.id);

      if (!hasManageGuild(interaction)) {
        await interaction.editReply({
          ...v2Error(
            tOf(interaction.guild?.id).settings.btnPanelText,
            tOf(interaction.guild?.id).settings.textNoPerms,
          ),
        });
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({
          ...v2Error(L.settings.btnPanelText, L.common.guildOnly),
        });
        return;
      }

      await svc().panelText.reset(guild.id as GuildId);
      await svc().setupService.refreshPanel(guild);

      await this.iconSettings.renderDesignInto(
        interaction,
        guild,
        tOf(guild.id).settings.flashTextReset,
      );
    } catch (error) {
      this.logger.error("Failed to reset panel text", error);
      await interaction.editReply({
        ...v2Error(
          tOf(interaction.guild?.id).settings.btnPanelText,
          tOf(interaction.guild?.id).common.error,
        ),
      });
    }
  }

  @ButtonComponent({ id: "setup:design:upload" })
  async onDesignUpload(interaction: ButtonInteraction): Promise<void> {
    try {
      const L = tOf(interaction.guild?.id);
      const fail = (text: string) => v2Error(L.upload.bannerFileTitle, text);

      if (!hasManageGuild(interaction)) {
        await interaction.reply({ ...fail(L.settings.textNoPerms) });
        return;
      }

      const channel = interaction.channel;
      if (!channel?.isTextBased()) {
        await interaction.reply({ ...fail(L.common.guildOnly) });
        return;
      }

      await interaction.reply({
        ...v2Action({
          title: L.upload.bannerFileTitle,
          actorId: interaction.user.id,
          text: L.upload.bannerFileText,
          details: [L.upload.uploadFormats, L.upload.uploadWait],
          avatarUrl: await actorAvatarUrl(interaction.guild ?? null, interaction.user.id),
        }),
      });

      const attachment = await collectImageAttachment(interaction);
      if (!attachment) {
        await interaction.followUp({ ...fail(L.common.timeout) });
        return;
      }

      const guild = interaction.guild;
      if (!guild) return;

      const validation = await svc().bannerService.validateAttachment(attachment);
      if (!validation.valid) {
        await interaction.followUp({
          ...fail(validation.error ?? L.upload.badImage),
        });
        return;
      }

      await svc().bannerService.saveUploadedBanner(guild.id as GuildId, attachment);
      await svc().setupService.refreshPanel(guild);

      const confirm = await v2ActionFor(
        guild,
        interaction.user.id,
        L.upload.bannerFileTitle,
        L.upload.uploadedText,
        [format(L.upload.uploadedFile, { name: attachment.name }), L.upload.uploadedNote],
      );
      confirm.components[0].addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(attachment.url)),
      );
      await interaction.followUp(confirm);
    } catch (error) {
      this.logger.error("Failed to upload banner via button", error);
    }
  }
}

async function collectImageAttachment(
  interaction: ButtonInteraction | ModalSubmitInteraction,
): Promise<Attachment | null> {
  const channel = interaction.channel;
  if (!channel || channel.partial || !("awaitMessages" in channel)) {
    return null;
  }
  const chan = channel as unknown as import("discord.js").TextChannel;

  const messages = await chan
    .awaitMessages({
      filter: (m: import("discord.js").Message) =>
        m.author.id === interaction.user.id && m.attachments.size > 0,
      max: 1,
      time: 120_000,
    })
    .catch(() => null);

  const msg = messages?.first();
  if (!msg) return null;

  const attachment = msg.attachments.first() ?? null;

  await msg.delete().catch(() => undefined);

  return attachment;
}
