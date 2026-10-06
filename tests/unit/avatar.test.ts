import { describe, it, expect } from "vitest";
import {
  sanitizeAvatar,
  DEFAULT_AVATAR,
  randomAvatar,
  AVATAR_GENDERS,
  ACCESSORIES,
  HAIR_STYLES,
  OUTFITS,
  BOTTOMS,
  FACES,
  PROPS,
} from "@/shared/avatar";
import { avatarCondition } from "@/shared/avatar-state";
import { DEFAULT_LIFE, FULL_NEEDS, type LifeState } from "@/shared/life";

describe("avatar reference system", () => {
  it("migrates older profiles without losing their appearance", () => {
    const old = {
      body: "tall",
      bodyColor: "#123456",
      skin: "#c5845a",
      face: "sleepy",
      hair: "long",
      hairColor: "#a8652f",
    };
    const a = sanitizeAvatar(old);
    expect(a.gender).toBe("neutral");
    expect(a.bodyColor).toBe(old.bodyColor);
    expect(a.hair).toBe("long");
    expect(a.eyes).toBe("sleepy");
    expect(a.outfit).toBe("hoodie");
    expect(a.accessory).toBe("none");
  });
  it("preserves all new customization parts for saving and realtime", () => {
    const a = {
      ...DEFAULT_AVATAR,
      gender: "female",
      head: "oval",
      eyes: "dot",
      mouth: "open",
      outfit: "jacket",
      pantsColor: "#c9b28e",
      shoes: "canvas",
      accessory: "headphones",
      brows: "angled",
      faceAccent: "freckles",
      bottom: "cargo",
      accessoryColor: "#765432",
      eyewear: "round",
      headphones: true,
      prop: "book",
    };
    expect(sanitizeAvatar(a)).toEqual(a);
  });
  it("accepts every reference-inspired part and keeps legacy accessory names", () => {
    for (const [key, list] of Object.entries({
      hair: HAIR_STYLES,
      outfit: OUTFITS,
      bottom: BOTTOMS,
      face: FACES,
      prop: PROPS,
      accessory: ACCESSORIES,
    })) {
      for (const item of list)
        expect(sanitizeAvatar({ ...DEFAULT_AVATAR, [key]: item })[key as keyof typeof DEFAULT_AVATAR]).toBe(
          item,
        );
    }
    expect(sanitizeAvatar({ accessory: "glasses" }).accessory).toBe("glasses");
    expect(
      sanitizeAvatar({ headphones: "true", accessoryColor: "javascript:x", bottom: "bad" }).headphones,
    ).toBe(false);
  });
  it("rejects invalid parts and unsafe colors", () => {
    expect(
      sanitizeAvatar({
        outfit: "invalid",
        head: "invalid",
        accessory: "<script>",
        pantsColor: "url(secret)",
      }),
    ).toEqual(DEFAULT_AVATAR);
    expect(sanitizeAvatar(null)).toEqual(DEFAULT_AVATAR);
  });
  it.each(AVATAR_GENDERS)("randomizes within %s while all styles stay available", (gender) => {
    for (let i = 0; i < 20; i++) {
      const a = randomAvatar(gender);
      expect(a.gender).toBe(gender);
      expect(sanitizeAvatar(a)).toEqual(a);
      expect(ACCESSORIES).toContain(a.accessory);
    }
  });
});

describe("private cosmetic conditions", () => {
  const life: LifeState = {
    needs: FULL_NEEDS,
    settings: DEFAULT_LIFE,
    rest: "none",
    coins: 50,
    earnedToday: 0,
  };
  it("does not invent a condition when needs are healthy or unknown", () => {
    expect(avatarCondition(null)).toBe("normal");
    expect(avatarCondition(life)).toBe("normal");
  });
  it.each([
    ["hunger", "hungry"],
    ["thirst", "thirsty"],
    ["energy", "tired"],
  ] as const)("uses the lowest actual %s need", (key, result) => {
    expect(avatarCondition({ ...life, needs: { ...FULL_NEEDS, [key]: 12 } })).toBe(result);
  });
  it("prioritizes critically low energy and respects both effects switches", () => {
    const low = { ...life, needs: { energy: 5, hunger: 2, thirst: 1 } };
    expect(avatarCondition(low)).toBe("sleepy");
    expect(avatarCondition(low, false)).toBe("normal");
    expect(avatarCondition({ ...low, settings: { ...DEFAULT_LIFE, effects: false } })).toBe("normal");
    expect(avatarCondition({ ...low, settings: { ...DEFAULT_LIFE, enabled: false } })).toBe("normal");
    expect(low.needs).toEqual({ energy: 5, hunger: 2, thirst: 1 });
  });
});
