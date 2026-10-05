/** Status kustom pengguna (teks singkat + waktu hapus otomatis). */
export const STATUS_TEXT_MAX = 80;

/** Status kustom yang sudah lewat waktunya dianggap kosong. */
export function activeStatus(
  text: string | null | undefined,
  expires: string | Date | null | undefined,
): { statusText: string | null; statusExpiresAt: string | null } {
  if (!text) return { statusText: null, statusExpiresAt: null };
  const exp = expires ? new Date(expires) : null;
  if (exp && exp.getTime() <= Date.now()) return { statusText: null, statusExpiresAt: null };
  return { statusText: text, statusExpiresAt: exp ? exp.toISOString() : null };
}
