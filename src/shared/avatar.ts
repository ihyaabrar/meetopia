/** Konfigurasi avatar dasar (FR-11, FR-59). Semua bagian bisa dipilih tanpa membeli apa pun. */
export const SKIN_TONES = ["#fde3c8", "#f6cfa6", "#e3a77c", "#c5845a", "#8d5a3b", "#5c3a26"] as const;
export const BODY_COLORS = [
  "#3f9a55",
  "#1f4d36",
  "#4a7fc1",
  "#e0a33a",
  "#d9605a",
  "#8a63c9",
  "#3aa6a0",
  "#555b66",
] as const;
export const HAIR_COLORS = [
  "#2b211c",
  "#5a3a22",
  "#a8652f",
  "#e2c27a",
  "#b9b9b9",
  "#c94f6d",
  "#3f6fb5",
] as const;
export const BODY_SHAPES = ["round", "tall", "small"] as const;
export const FACES = ["happy", "calm", "wink", "surprised", "sleepy"] as const;
export const HAIR_STYLES = ["short", "bob", "long", "curly", "spiky", "bun", "sprout", "none"] as const;

export type BodyShape = (typeof BODY_SHAPES)[number];
export type Face = (typeof FACES)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];

export interface AvatarConfig {
  body: BodyShape;
  bodyColor: string;
  skin: string;
  face: Face;
  hair: HairStyle;
  hairColor: string;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  body: "round",
  bodyColor: BODY_COLORS[0],
  skin: SKIN_TONES[0],
  face: "happy",
  hair: "short",
  hairColor: HAIR_COLORS[1],
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Membersihkan input avatar dari klien; nilai tidak valid diganti default. */
export function sanitizeAvatar(input: unknown): AvatarConfig {
  const a = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T =>
    typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : d;
  const color = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
  return {
    body: pick(a.body, BODY_SHAPES, DEFAULT_AVATAR.body),
    bodyColor: color(a.bodyColor, DEFAULT_AVATAR.bodyColor),
    skin: color(a.skin, DEFAULT_AVATAR.skin),
    face: pick(a.face, FACES, DEFAULT_AVATAR.face),
    hair: pick(a.hair, HAIR_STYLES, DEFAULT_AVATAR.hair),
    hairColor: color(a.hairColor, DEFAULT_AVATAR.hairColor),
  };
}

export function randomAvatar(): AvatarConfig {
  const r = <T>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)];
  return {
    body: r(BODY_SHAPES),
    bodyColor: r(BODY_COLORS),
    skin: r(SKIN_TONES),
    face: r(FACES),
    hair: r(HAIR_STYLES.filter((h) => h !== "none")),
    hairColor: r(HAIR_COLORS),
  };
}
