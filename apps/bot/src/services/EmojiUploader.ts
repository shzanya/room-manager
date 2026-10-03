import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Image } from "@napi-rs/canvas";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import type { Logger } from "@room-manager/logger";
import type { Attachment } from "discord.js";

const ALL_COLORS = [
  "white",
  "gray",
  "black",
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "purple",
  "pink",
] as const;

const MAX_ICON_SIZE = 512 * 1024;
const MAX_ICON_DIMENSION = 512;

const COLOR_TARGETS: Record<string, [number, number, number]> = {
  white: [255, 255, 255],
  gray: [156, 163, 175],
  black: [17, 24, 39],
  red: [239, 68, 68],
  orange: [249, 115, 22],
  yellow: [234, 179, 8],
  green: [34, 197, 94],
  cyan: [6, 182, 212],
  blue: [59, 130, 246],
  purple: [139, 92, 246],
  pink: [236, 72, 153],
};

export class EmojiUploader {
  private readonly packsPath: string;

  constructor(
    private readonly logger: Logger,
    assetsPath?: string,
  ) {
    const base = assetsPath ?? join(process.cwd(), "assets");
    this.packsPath = join(base, "emojis", "packs");
  }

  async tintBuffer(source: Buffer, r: number, g: number, b: number): Promise<Buffer> {
    const image = await loadImage(source);
    return this.generateColorVariant(image, r, g, b);
  }

  validateIconAttachment(attachment: Attachment): {
    valid: boolean;
    error?: string;
  } {
    if (attachment.size > MAX_ICON_SIZE) {
      return {
        valid: false,
        error: `Файл слишком большой. Максимум: ${MAX_ICON_SIZE / 1024}KB.`,
      };
    }

    if (attachment.contentType && attachment.contentType !== "image/png") {
      return {
        valid: false,
        error: "Поддерживается только PNG.",
      };
    }

    if (!attachment.name.toLowerCase().endsWith(".png")) {
      return {
        valid: false,
        error: "Файл должен иметь расширение .png.",
      };
    }

    return { valid: true };
  }

  async processUploadedIcon(action: string, imageBuffer: Buffer): Promise<string[]> {
    const image = await loadImage(imageBuffer);

    if (image.width > MAX_ICON_DIMENSION || image.height > MAX_ICON_DIMENSION) {
      throw new Error(`Разрешение превышает ${MAX_ICON_DIMENSION}x${MAX_ICON_DIMENSION}.`);
    }

    const actionDir = join(this.packsPath, "custom", action);
    if (!existsSync(actionDir)) {
      mkdirSync(actionDir, { recursive: true });
    }

    const originalPath = join(actionDir, "original.png");
    writeFileSync(originalPath, imageBuffer);
    this.logger.info(`Saved original icon for ${action}: ${originalPath}`);

    const generated: string[] = ["default"];

    for (const colorName of ALL_COLORS) {
      const target = COLOR_TARGETS[colorName];
      if (!target) continue;

      const variantBuffer = await this.generateColorVariant(image, target[0], target[1], target[2]);

      const variantPath = join(actionDir, `${colorName}.png`);
      writeFileSync(variantPath, variantBuffer);
      generated.push(colorName);
    }

    this.logger.info(`Generated ${generated.length} color variants for ${action}`);
    return generated;
  }

  private async generateColorVariant(
    image: Image,
    targetR: number,
    targetG: number,
    targetB: number,
  ): Promise<Buffer> {
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === undefined || a === 0) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r === undefined || g === undefined || b === undefined) continue;

      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      const tintFactor = 1 - luminance * 0.6;

      const newR = Math.round(targetR * tintFactor + r * (1 - tintFactor));
      const newG = Math.round(targetG * tintFactor + g * (1 - tintFactor));
      const newB = Math.round(targetB * tintFactor + b * (1 - tintFactor));

      data[i] = Math.min(255, Math.max(0, newR));
      data[i + 1] = Math.min(255, Math.max(0, newG));
      data[i + 2] = Math.min(255, Math.max(0, newB));
    }

    ctx.putImageData(imageData, 0, 0);

    return canvas.toBuffer("image/png");
  }

  async generateCustomHexVariant(action: string, hexColor: string): Promise<Buffer | null> {
    const originalPath = join(this.packsPath, "custom", action, "original.png");
    if (!existsSync(originalPath)) {
      return null;
    }

    const hex = hexColor.startsWith("#") ? hexColor.slice(1) : hexColor;
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
      return null;
    }

    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);

    const originalBuffer = readFileSync(originalPath);
    const image = await loadImage(originalBuffer);
    const variantBuffer = await this.generateColorVariant(image, r, g, b);

    const variantPath = join(this.packsPath, "custom", action, `hex-${hex.toLowerCase()}.png`);
    writeFileSync(variantPath, variantBuffer);

    return variantBuffer;
  }

  hasCustomIcon(action: string): boolean {
    const originalPath = join(this.packsPath, "custom", action, "original.png");
    return existsSync(originalPath);
  }

  getVariantPath(action: string, color: string): string | null {
    const slug = color.startsWith("#")
      ? `hex-${color.slice(1).toLowerCase()}`
      : color.toLowerCase();
    const filePath = join(this.packsPath, "custom", action, `${slug}.png`);
    return existsSync(filePath) ? filePath : null;
  }
}
