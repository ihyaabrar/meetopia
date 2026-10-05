/** Sistem terjemahan sederhana (Indonesia & Inggris). Semua teks UI diambil dari berkas JSON. */
import id from "./messages/id.json";
import en from "./messages/en.json";

export const LOCALES = ["id", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "id";
export const LOCALE_COOKIE = "mt_locale";

export const messages: Record<Locale, Record<string, string>> = { id, en };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export type Vars = Record<string, string | number>;

export function translate(locale: Locale, key: string, vars?: Vars): string {
  const raw = messages[locale][key] ?? messages[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
