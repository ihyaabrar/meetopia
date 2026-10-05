"use client";

import { useI18n } from "@/i18n/client";
import { LOCALES, type Locale } from "@/i18n";

export function LanguageSwitch({ onChange }: { onChange?: (l: Locale) => void }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="row" style={{ gap: 6 }}>
      <span className="sr-only">{t("common.language")}</span>
      <select
        className="input"
        style={{ minHeight: 36, width: "auto", padding: "4px 10px" }}
        value={locale}
        onChange={(e) => {
          const l = e.target.value as Locale;
          setLocale(l);
          onChange?.(l);
        }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {l === "id" ? "Bahasa Indonesia" : "English"}
          </option>
        ))}
      </select>
    </label>
  );
}
