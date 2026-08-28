import type { Logger } from "@room-manager/logger";
import type {
  ButtonInteraction,
  RoleSelectMenuInteraction,
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

  // ── Roles & policies ───────────────────────────────────────────────

  @SelectMenuComponent({ id: "setup:roles:action" })
  async onRolesAction(interaction: StringSelectMenuInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleRolesAction(interaction),
      "roles action",
    );
  }

  @ButtonComponent({ id: "setup:roles:home" })
  async onRolesHome(interaction: ButtonInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleRolesHome(interaction),
      "roles home",
    );
  }

  @SelectMenuComponent({ id: "setup:roles:mute-role" })
  async onRolesMuteRole(interaction: RoleSelectMenuInteraction): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleRolesMuteRole(interaction),
      "roles mute role",
    );
  }

  @SelectMenuComponent({ id: /^setup:roles:allow-groups:.+$/ })
  async onRolesAllowGroups(
    interaction: StringSelectMenuInteraction,
  ): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleRolesAllowGroups(interaction),
      "roles allow groups",
    );
  }

  @SelectMenuComponent({ id: /^setup:roles:deny-groups:.+$/ })
  async onRolesDenyGroups(
    interaction: StringSelectMenuInteraction,
  ): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleRolesDenyGroups(interaction),
      "roles deny groups",
    );
  }

  @SelectMenuComponent({ id: /^setup:roles:allow-roles:.+$/ })
  async onRolesAllowRoles(
    interaction: RoleSelectMenuInteraction,
  ): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleRolesAllowRoles(interaction),
      "roles allow roles",
    );
  }

  @SelectMenuComponent({ id: /^setup:roles:deny-roles:.+$/ })
  async onRolesDenyRoles(
    interaction: RoleSelectMenuInteraction,
  ): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleRolesDenyRoles(interaction),
      "roles deny roles",
    );
  }

  @SelectMenuComponent({ id: "setup:roles:admin-roles" })
  async onRolesAdminRoles(
    interaction: RoleSelectMenuInteraction,
  ): Promise<void> {
    await this.safe(
      () => this.iconSettings.handleRolesAdminRoles(interaction),
      "roles admin roles",
    );
  }
}
