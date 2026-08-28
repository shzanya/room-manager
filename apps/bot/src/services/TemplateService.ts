import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Locale } from "../i18n";

export interface PanelTemplate {
  name: string;
  title: string;
  description: string;
  /** Whether to render the 10-action emoji list as embed fields. */
  showList: boolean;
  /** Minimal mode: no title/description/footer — just banner + buttons. */
  minimal?: boolean;
  image?: {
    /** Static file relative to apps/bot/assets/panel/. */
    file?: string;
    /** Or a remote URL. */
    url?: string;
  };
  /**
   * Localized title/description per locale code ("en", ...).
   * The base title/description act as the default (ru) fallback.
   */
  i18n?: Record<string, { title?: string; description?: string }>;
}

const TEMPLATES_DIR = join(process.cwd(), "assets", "templates");

export class TemplateService {
  private readonly cache = new Map<string, PanelTemplate>();

  constructor() {
    this.loadAll();
  }

  private loadAll(): void {
    if (!existsSync(TEMPLATES_DIR)) return;

    for (const f of readdirSync(TEMPLATES_DIR)) {
      if (!f.endsWith(".json")) continue;
      try {
        const tpl = JSON.parse(
          readFileSync(join(TEMPLATES_DIR, f), "utf8"),
        ) as PanelTemplate;
        this.cache.set(tpl.name, tpl);
      } catch {
        // Skip malformed template files.
      }
    }
  }

  list(): PanelTemplate[] {
    return [...this.cache.values()];
  }

  /**
   * Returns the template with title/description resolved for the locale
   * (falls back to base text when no translation exists).
   */
  get(name: string, locale?: Locale): PanelTemplate {
    const tpl = this.cache.get(name) ?? DEFAULT_TEMPLATE;

    if (!locale || !tpl.i18n) return tpl;
    const localized = tpl.i18n[locale];
    if (!localized) return tpl;

    return {
      ...tpl,
      title: localized.title ?? tpl.title,
      description: localized.description ?? tpl.description,
    };
  }

  /** Minimal templates drop everything except the banner image. */
  isMinimal(name: string): boolean {
    return this.get(name).minimal === true;
  }
}

const DEFAULT_TEMPLATE: PanelTemplate = {
  name: "default",
  title: "—・Управление приватной комнатой",
  description: "Жми следующие кнопки, чтобы настроить свою комнату",
  showList: true,
};
