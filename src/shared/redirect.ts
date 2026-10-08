/**
 * Tujuan setelah login/daftar (`?next=`). Hanya path di situs ini: "//evil.com" atau "/\evil.com"
 * diperlakukan browser sebagai alamat situs lain (open redirect), jadi ditolak.
 */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
