import type { GuildId } from "@room-manager/shared";
import { svc } from "../services/registry";
import { en } from "./en";
import { type Dictionary, ru } from "./ru";

export type Locale = "ru" | "en";

const DICTS: Record<Locale, Dictionary> = { ru, en };

export const LOCALE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
];

export function isLocale(value: string): value is Locale {
  return value === "ru" || value === "en";
}

export function tr(locale: Locale): Dictionary {
  return DICTS[locale] ?? ru;
}

export function tOf(guildId: string | null | undefined): Dictionary {
  if (!guildId) return ru;
  return tr(svc().locale.get(guildId as GuildId));
}

export function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}
