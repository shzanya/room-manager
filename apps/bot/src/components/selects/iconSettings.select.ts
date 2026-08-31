import type { Logger } from "@room-manager/logger";
import type {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import { ButtonComponent, Discord, SelectMenuComponent } from "discordx";
import type { IconSettingsService } from "../../services/IconSettingsService";
import { svc } from "../../services/registry";

@Discord()
export class IconSettingsSelects {
  private readonly logger: Logger = svc().logger;
  private readonly iconSettings: IconSettingsService = svc().iconSettings;

  private async safe(run: () => Promise<void>, label: string): Promise<void> {
    try {
      await run();
    } catch (e) {
      this.logger.error(`settings ${label} handler failed`, e);
    }
  }

  @SelectMenuComponent({ id: "setup:set:section" })
  async onSection(interaction: StringSelectMenuInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleSection(interaction),
      "section",
    );
  }

  @ButtonComponent({ id: "setup:set:home" })
  async onHome(interaction: ButtonInteraction): Promise<void> {
    await this.safe(() => this.iconSettings.handleHome(interaction), "home");
  }

  @SelectMenuComponent({ id: "setup:tpl" })
  async onTemplate(interaction: StringSelectMenuInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleTemplate(interaction),
      "template",
    );
  }

  @SelectMenuComponent({ id: "setup:ctrl:mode" })
  async onControlMode(interaction: StringSelectMenuInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleControlMode(interaction),
      "control mode",
    );
  }

  @SelectMenuComponent({ id: "setup:lang" })
  async onLanguage(interaction: StringSelectMenuInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleLanguage(interaction),
      "language",
    );
  }

  @ButtonComponent({ id: "setup:ctrl:instant" })
  async onInstantDelete(interaction: ButtonInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleInstantDeleteToggle(interaction),
      "instant delete",
    );
  }

  @ButtonComponent({ id: "setup:ctrl:public" })
  async onPublicCategory(interaction: ButtonInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handlePublicCategoryToggle(interaction),
      "public category",
    );
  }

  @ButtonComponent({ id: "setup:ctrl:logs" })
  async onLogsToggle(interaction: ButtonInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleLogsToggle(interaction),
      "logs toggle",
    );
  }

  @SelectMenuComponent({ id: "setup:icons:pack" })
  async onPack(interaction: StringSelectMenuInteraction): Promise<void> {
    await this.safe(() => this.iconSettings.handlePack(interaction), "pack");
  }

  @SelectMenuComponent({ id: "setup:icons:preset" })
  async onPreset(interaction: StringSelectMenuInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handlePreset(interaction),
      "preset",
    );
  }

  @SelectMenuComponent({ id: "setup:icons:global" })
  async onGlobal(interaction: StringSelectMenuInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleGlobal(interaction),
      "global",
    );
  }

  // ── Channels ────────────────────────────────────────────────────────

  @SelectMenuComponent({ id: "setup:channels:category" })
  async onChannelsCategory(interaction: ChannelSelectMenuInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleChannelsCategory(interaction),
      "channels category",
    );
  }

  @SelectMenuComponent({ id: "setup:channels:creator" })
  async onChannelsCreator(interaction: ChannelSelectMenuInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleChannelsCreator(interaction),
      "channels creator",
    );
  }

  @SelectMenuComponent({ id: "setup:channels:log" })
  async onChannelsLog(interaction: ChannelSelectMenuInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleChannelsLog(interaction),
      "channels log",
    );
  }
}
