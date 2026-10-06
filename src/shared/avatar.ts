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
export const FACES = [
  "normal",
  "happy",
  "calm",
  "wink",
  "surprised",
  "sleepy",
  "sad",
  "angry",
  "shy",
  "confused",
  "cool",
  "excited",
  "tired",
  "hungry",
  "thirsty",
  "focus",
  "bored",
] as const;
export const HAIR_STYLES = [
  "short",
  "sidepart",
  "undercut",
  "bob",
  "long",
  "wavy",
  "curly",
  "spiky",
  "bun",
  "ponytail",
  "braids",
  "sprout",
  "none",
] as const;
export const AVATAR_GENDERS = ["male", "female", "neutral"] as const;
export const HEAD_SHAPES = ["round", "oval", "soft", "wide"] as const;
export const EYE_STYLES = ["oval", "dot", "happy", "sleepy", "wide", "closed"] as const;
export const MOUTH_STYLES = ["smile", "open", "tiny", "straight", "frown", "laugh", "tongue"] as const;
export const BROW_STYLES = ["soft", "straight", "arched", "angled"] as const;
export const FACE_ACCENTS = ["none", "blush", "freckles", "heart", "star"] as const;
export const OUTFITS = ["hoodie", "tee", "jacket", "shirt", "polo", "sweater", "blazer", "striped"] as const;
export const BOTTOMS = ["trousers", "shorts", "cargo", "skirt"] as const;
export const SHOE_STYLES = ["sneakers", "boots", "canvas"] as const;
export const ACCESSORIES = [
  "none",
  "glasses",
  "cap",
  "beanie",
  "headphones",
  "bow",
  "earrings",
  "mask",
  "sunglasses",
  "hijab",
  "backpack",
] as const;
export const PROPS = ["none", "coffee", "phone", "book", "laptop"] as const;
export { AVATAR_ACTIONS as PREVIEW_ACTIONS } from "./avatar-animation";
export type { AvatarAction as AvatarActivity } from "./avatar-animation";
export const AVATAR_DIRECTIONS = [
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
  "right",
  "down-right",
] as const;
export type AvatarDirection = (typeof AVATAR_DIRECTIONS)[number];
export const AVATAR_CONDITIONS = ["normal", "hungry", "thirsty", "tired", "sleepy"] as const;
export type AvatarCondition = (typeof AVATAR_CONDITIONS)[number];
export const PANTS_COLORS = ["#29323c", "#527eb0", "#c9b28e", "#505865"] as const;

export type BodyShape = (typeof BODY_SHAPES)[number];
export type Face = (typeof FACES)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type AvatarGender = (typeof AVATAR_GENDERS)[number];

export interface AvatarConfig {
  /** Gaya dasar avatar. Semua bagian tetap bisa dipilih bebas setelahnya. */
  gender: AvatarGender;
  body: BodyShape;
  bodyColor: string;
  skin: string;
  face: Face;
  hair: HairStyle;
  hairColor: string;
  head: (typeof HEAD_SHAPES)[number];
  eyes: (typeof EYE_STYLES)[number];
  mouth: (typeof MOUTH_STYLES)[number];
  outfit: (typeof OUTFITS)[number];
  pantsColor: string;
  shoes: (typeof SHOE_STYLES)[number];
  accessory: (typeof ACCESSORIES)[number];
  brows: (typeof BROW_STYLES)[number];
  faceAccent: (typeof FACE_ACCENTS)[number];
  bottom: (typeof BOTTOMS)[number];
  accessoryColor: string;
  /** Secondary layers can coexist with a hat/hijab or other primary accessory. */
  eyewear: "none" | "round" | "square" | "sun";
  headphones: boolean;
  prop: (typeof PROPS)[number];
}

export const DEFAULT_AVATAR: AvatarConfig = {
  gender: "neutral",
  body: "round",
  bodyColor: BODY_COLORS[0],
  skin: SKIN_TONES[0],
  face: "happy",
  hair: "short",
  hairColor: HAIR_COLORS[1],
  head: "round",
  eyes: "oval",
  mouth: "smile",
  outfit: "hoodie",
  pantsColor: PANTS_COLORS[0],
  shoes: "sneakers",
  accessory: "none",
  brows: "soft",
  faceAccent: "blush",
  bottom: "trousers",
  accessoryColor: "#29765a",
  eyewear: "none",
  headphones: false,
  prop: "none",
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Membersihkan input avatar dari klien; nilai tidak valid diganti default. */
export function sanitizeAvatar(input: unknown): AvatarConfig {
  const a = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T =>
    typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : d;
  const color = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
  return {
    gender: pick(a.gender, AVATAR_GENDERS, DEFAULT_AVATAR.gender),
    body: pick(a.body, BODY_SHAPES, DEFAULT_AVATAR.body),
    bodyColor: color(a.bodyColor, DEFAULT_AVATAR.bodyColor),
    skin: color(a.skin, DEFAULT_AVATAR.skin),
    face: pick(a.face, FACES, DEFAULT_AVATAR.face),
    hair: pick(a.hair, HAIR_STYLES, DEFAULT_AVATAR.hair),
    hairColor: color(a.hairColor, DEFAULT_AVATAR.hairColor),
    head: pick(a.head, HEAD_SHAPES, DEFAULT_AVATAR.head),
    eyes: pick(
      a.eyes,
      EYE_STYLES,
      a.face === "calm" ? "happy" : a.face === "sleepy" ? "sleepy" : DEFAULT_AVATAR.eyes,
    ),
    mouth: pick(a.mouth, MOUTH_STYLES, a.face === "surprised" ? "open" : DEFAULT_AVATAR.mouth),
    outfit: pick(a.outfit, OUTFITS, DEFAULT_AVATAR.outfit),
    pantsColor: color(a.pantsColor, DEFAULT_AVATAR.pantsColor),
    shoes: pick(a.shoes, SHOE_STYLES, DEFAULT_AVATAR.shoes),
    accessory: pick(a.accessory, ACCESSORIES, DEFAULT_AVATAR.accessory),
    brows: pick(a.brows, BROW_STYLES, DEFAULT_AVATAR.brows),
    faceAccent: pick(a.faceAccent, FACE_ACCENTS, DEFAULT_AVATAR.faceAccent),
    bottom: pick(a.bottom, BOTTOMS, DEFAULT_AVATAR.bottom),
    accessoryColor: color(a.accessoryColor, DEFAULT_AVATAR.accessoryColor),
    eyewear: pick(a.eyewear, ["none", "round", "square", "sun"] as const, "none"),
    headphones: a.headphones === true,
    prop: pick(a.prop, PROPS, DEFAULT_AVATAR.prop),
  };
}

export const HAIR_BY_GENDER: Record<AvatarGender, readonly HairStyle[]> = {
  male: ["short", "sidepart", "undercut", "curly", "spiky", "sprout", "none"],
  female: ["bob", "long", "wavy", "curly", "bun", "ponytail", "braids", "sprout"],
  neutral: HAIR_STYLES.filter((h) => h !== "none"),
};

export function randomAvatar(gender: AvatarGender = "neutral"): AvatarConfig {
  const r = <T>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)];
  return {
    ...DEFAULT_AVATAR,
    gender,
    body:
      gender === "male"
        ? r(["round", "tall"] as const)
        : gender === "female"
          ? r(["round", "small"] as const)
          : r(BODY_SHAPES),
    bodyColor: r(BODY_COLORS),
    skin: r(SKIN_TONES),
    face: r(FACES),
    hair: r(HAIR_BY_GENDER[gender]),
    hairColor: r(HAIR_COLORS),
    head: r(HEAD_SHAPES),
    eyes: r(EYE_STYLES),
    mouth: r(MOUTH_STYLES),
    outfit: r(OUTFITS),
    pantsColor: r(PANTS_COLORS),
    shoes: r(SHOE_STYLES),
    accessory: r(ACCESSORIES),
    brows: r(BROW_STYLES),
    faceAccent: r(FACE_ACCENTS),
    bottom: r(BOTTOMS),
    accessoryColor: r(BODY_COLORS),
    prop: r(PROPS),
  };
}
