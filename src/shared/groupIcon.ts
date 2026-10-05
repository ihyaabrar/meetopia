/**
 * Ikon grup: warna latar + simbol (atau inisial nama). Semua warna lolos kontras AA dengan teks putih.
 * Unggah gambar sendiri bisa ditambahkan nanti (mis. lewat Vercel Blob).
 */
export const GROUP_COLORS = {
  green: "#2f7d45",
  teal: "#1d6b73",
  blue: "#35609f",
  indigo: "#5b54a6",
  plum: "#7f4a8f",
  rose: "#a3415a",
  brick: "#a74a2a",
  amber: "#85631a",
  olive: "#5d6b2a",
  slate: "#4f5661",
} as const;
export type GroupColor = keyof typeof GROUP_COLORS;
export const GROUP_COLOR_KEYS = Object.keys(GROUP_COLORS) as GroupColor[];

export const GROUP_SYMBOLS = [
  "initials",
  "door",
  "coffee",
  "code",
  "book",
  "briefcase",
  "rocket",
  "star",
  "leaf",
  "heart",
  "music",
  "globe",
  "flag",
  "bolt",
] as const;
export type GroupSymbol = (typeof GROUP_SYMBOLS)[number];

export const isGroupColor = (v: unknown): v is GroupColor => typeof v === "string" && v in GROUP_COLORS;
export const isGroupSymbol = (v: unknown): v is GroupSymbol =>
  typeof v === "string" && (GROUP_SYMBOLS as readonly string[]).includes(v);

export function groupInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Warna bawaan yang stabil per nama, agar grup lama tidak semuanya hijau. */
export function defaultGroupColor(seed: string): GroupColor {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GROUP_COLOR_KEYS[h % GROUP_COLOR_KEYS.length];
}
