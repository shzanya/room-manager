import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { GuildService } from "@room-manager/core";
import type { Logger } from "@room-manager/logger";
import type { GuildId } from "@room-manager/shared";
import type { Attachment } from "discord.js";

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

/** Default panel banner used when guild bannerUrl is null. */
const DEFAULT_BANNER_URL = "https://i.imgur.com/AuKVxor.gif";

export interface BannerState {
  type: "default" | "custom_url" | "uploaded";
  displayUrl: string;
  bannerUrl: string | null;
}

export class BannerService {
  private readonly assetsPath: string;
  private readonly bannersPath: string;

  constructor(
    private readonly logger: Logger,
    private readonly guildService: GuildService,
  ) {
    this.assetsPath = join(process.cwd(), "assets", "panel");
    this.bannersPath = join(this.assetsPath, "banners");

    if (!existsSync(this.bannersPath)) {
      mkdirSync(this.bannersPath, { recursive: true });
    }
  }

  getDefaultBannerPath(): string {
    return join(this.assetsPath, "default-banner.png");
  }

  getDefaultBannerBuffer(): Buffer {
    return readFileSync(this.getDefaultBannerPath());
  }

  getBannerState(config: { bannerUrl: string | null }): BannerState {
    if (!config.bannerUrl) {
      return {
        type: "default",
        displayUrl: DEFAULT_BANNER_URL,
        bannerUrl: null,
      };
    }

    if (
      config.bannerUrl.startsWith("http://") ||
      config.bannerUrl.startsWith("https://")
    ) {
      return {
        type: "custom_url",
        displayUrl: config.bannerUrl,
        bannerUrl: config.bannerUrl,
      };
    }

    const localPath = join(this.bannersPath, config.bannerUrl);
    if (existsSync(localPath)) {
      return {
        type: "uploaded",
        displayUrl: `attachment://${config.bannerUrl}`,
        bannerUrl: config.bannerUrl,
      };
    }

    return {
      type: "default",
      displayUrl: DEFAULT_BANNER_URL,
      bannerUrl: null,
    };
  }

  async validateAttachment(
    attachment: Attachment,
  ): Promise<{ valid: boolean; error?: string }> {
    if (attachment.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `Файл слишком большой. Максимум: ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
      };
    }

    const contentType = attachment.contentType;
    if (contentType && !ALLOWED_MIME_TYPES.includes(contentType)) {
      return {
        valid: false,
        error: `Неподдерживаемый формат файла: ${contentType}. Допустимые: PNG, JPEG, WebP.`,
      };
    }

    const name = attachment.name.toLowerCase();
    const validExtensions = [".png", ".jpg", ".jpeg", ".webp"];
    const hasValidExtension = validExtensions.some((ext) => name.endsWith(ext));

    if (!hasValidExtension) {
      return {
        valid: false,
        error:
          "Неподдерживаемое расширение файла. Допустимые: .png, .jpg, .jpeg, .webp.",
      };
    }

    return { valid: true };
  }

  validateUrl(url: string): { valid: boolean; error?: string } {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { valid: false, error: "Некорректный URL." };
    }

    if (parsed.protocol !== "https:") {
      return { valid: false, error: "URL должен использовать протокол HTTPS." };
    }

    const validHosts = [
      "cdn.discordapp.com",
      "media.discordapp.net",
      "images.unsplash.com",
      "i.imgur.com",
      "imgur.com",
    ];

    const hostIsValid = validHosts.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`),
    );

    if (!hostIsValid) {
      return {
        valid: false,
        error: `Хост не поддерживается. Допустимые: ${validHosts.join(", ")}.`,
      };
    }

    return { valid: true };
  }

  async saveUploadedBanner(
    guildId: GuildId,
    attachment: Attachment,
  ): Promise<string> {
    const safeFilename = `banner-${guildId}-${Date.now()}.png`;
    const filePath = join(this.bannersPath, safeFilename);

    const response = await fetch(attachment.url);
    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, buffer);

    this.logger.info(
      `Saved uploaded banner for guild ${guildId}: ${safeFilename}`,
    );

    return safeFilename;
  }

  async setCustomUrl(guildId: GuildId, url: string): Promise<void> {
    await this.guildService.update(guildId, { bannerUrl: url });
    this.logger.info(`Set custom banner URL for guild ${guildId}`);
  }

  async resetToDefault(guildId: GuildId): Promise<void> {
    const config = await this.guildService.getById(guildId);
    if (config?.bannerUrl && !config.bannerUrl.startsWith("http")) {
      const filePath = join(this.bannersPath, config.bannerUrl);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        this.logger.info(`Deleted uploaded banner file: ${config.bannerUrl}`);
      }
    }

    await this.guildService.update(guildId, { bannerUrl: null });
    this.logger.info(`Reset banner to default for guild ${guildId}`);
  }

  /**
   * Local files are only needed for uploaded banners. Default and URL
   * banners are referenced directly by URL (no attachments).
   */
  resolveBannerAttachments(config: {
    bannerUrl: string | null;
  }): Array<{ name: string; attachment: Buffer }> {
    if (!config.bannerUrl || config.bannerUrl.startsWith("http")) {
      return [];
    }

    const filePath = join(this.bannersPath, config.bannerUrl);
    if (!existsSync(filePath)) {
      return [];
    }

    return [{ name: config.bannerUrl, attachment: readFileSync(filePath) }];
  }

  getBannerFilename(config: { bannerUrl: string | null }): string {
    if (!config.bannerUrl || config.bannerUrl.startsWith("http")) {
      return "default-banner.png";
    }
    return config.bannerUrl;
  }
}
