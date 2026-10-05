/** "5 menit lalu" / "2 hari lalu" sesuai bahasa. */
export function timeAgo(iso: string, locale: string, now = Date.now()): string {
  const diff = (Date.parse(iso) - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === "id" ? "id-ID" : "en-US", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
  return rtf.format(Math.round(diff / (86400 * 365)), "year");
}
