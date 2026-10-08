import { describe, it, expect } from "vitest";
import {
  AVATAR_ACTIONS,
  ACTION_GROUPS,
  ACTION_LABELS,
  sampleAvatarAction,
  directionFrom,
} from "@/shared/avatar-animation";
import { AVATAR_DIRECTIONS, DEFAULT_AVATAR, OUTFITS } from "@/shared/avatar";
import { clientMessageSchema } from "@/shared/protocol";
import {
  avatarSpriteMirror,
  spriteView,
  AVATAR_ASSET_URLS,
  removeCellDebris,
  directionalTorsoCell,
} from "@/client/art/avatar-assets";
import { avatarNameOffset, AVATAR_MAP_SCALE } from "@/client/art/avatar";
import { paintedTopY, fitHeadScale } from "@/client/art/avatar-painted";
import { readFileSync } from "node:fs";

describe("complete cosmetic animation library", () => {
  it("categorizes every reference action exactly once with both locale labels", () => {
    const categorized = Object.values(ACTION_GROUPS).flat();
    expect(new Set(categorized).size).toBe(44);
    expect(categorized.length).toBe(AVATAR_ACTIONS.length);
    for (const action of AVATAR_ACTIONS) {
      expect(categorized).toContain(action);
      expect(ACTION_LABELS[action].every(Boolean)).toBe(true);
    }
  });
  it.each(AVATAR_ACTIONS)(
    "%s has a looping 6/8 frame timeline and a stable reduced-motion pose",
    (action) => {
      const first = sampleAvatarAction(action, 0);
      expect([6, 8]).toContain(first.frames);
      const frames = Array.from({ length: first.frames }, (_, i) => sampleAvatarAction(action, i / 8));
      expect(frames.map((p) => p.frame)).toEqual(Array.from({ length: first.frames }, (_, i) => i));
      expect(sampleAvatarAction(action, first.frames / 8)).toEqual(first);
      expect(sampleAvatarAction(action, 0, true)).toEqual(sampleAvatarAction(action, 100, true));
      expect(new Set(frames.map((p) => JSON.stringify({ ...p, frame: 0 }))).size).toBeGreaterThan(1);
      for (const p of frames)
        expect([p.bob, p.lean, p.tilt, p.stride, ...p.left, ...p.right].every(Number.isFinite)).toBe(true);
    },
  );
  it("distinguishes severe conditions and floor/sofa/chair sitting", () => {
    for (const [a, b] of [
      ["tired", "very-tired"],
      ["thirsty", "very-thirsty"],
      ["sit", "sit-floor"],
      ["sit", "sit-sofa"],
    ] as const)
      expect(sampleAvatarAction(a, 0.25)).not.toEqual(sampleAvatarAction(b, 0.25));
  });
});
describe("eight live directions and safe public poses", () => {
  it("fits narrow-face quarter/profile artwork into the front head silhouette instead of enlarging it", () => {
    for (const [width, height] of [
      [180, 200],
      [240, 180],
      [80, 180],
    ]) {
      const ratio = fitHeadScale(width, height, 30, 32);
      expect(width * ratio).toBeLessThanOrEqual(30);
      expect(height * ratio).toBeLessThanOrEqual(32);
    }
  });
  it.each(AVATAR_DIRECTIONS)("keeps the name pill above the full hair silhouette facing %s", (dir) => {
    expect(avatarNameOffset(DEFAULT_AVATAR, dir)).toBeGreaterThanOrEqual(
      paintedTopY(DEFAULT_AVATAR, dir) * AVATAR_MAP_SCALE + 20,
    );
  });
  it("removes tiny isolated neighboring-cell debris without erasing meaningful detached pieces", () => {
    const w = 64,
      h = 64,
      data = new Uint8ClampedArray(w * h * 4);
    const fill = (x0: number, y0: number, width: number, height: number) => {
      for (let y = y0; y < y0 + height; y++)
        for (let x = x0; x < x0 + width; x++) data[(y * w + x) * 4 + 3] = 255;
    };
    fill(12, 20, 40, 25);
    fill(2, 2, 2, 2);
    fill(55, 50, 5, 5);
    removeCellDebris({ data, width: w, height: h } as ImageData, w, h);
    expect(data[(2 * w + 2) * 4 + 3]).toBe(0);
    expect(data[(20 * w + 12) * 4 + 3]).toBe(255);
    expect(data[(50 * w + 55) * 4 + 3]).toBe(255);
  });
  it.each(AVATAR_DIRECTIONS)("accepts %s without breaking older four-direction clients", (dir) => {
    expect(clientMessageSchema.safeParse({ t: "move", x: 1, y: 1, dir, moving: true }).success).toBe(true);
    expect([0, 1, 2, 3]).toContain(spriteView(dir).view);
  });
  it("uses eight angular sectors and stable zero-vector fallback", () => {
    expect(directionFrom(1, 1, "up")).toBe("down-right");
    expect(directionFrom(-1, -1, "down")).toBe("up-left");
    expect(directionFrom(0.01, -1, "down")).toBe("up");
    expect(directionFrom(0, 0, "left")).toBe("left");
  });
  it("normalizes independently drawn sheet orientations", () => {
    expect(avatarSpriteMirror(DEFAULT_AVATAR, "right", "head")).toBe(true);
    expect(avatarSpriteMirror(DEFAULT_AVATAR, "right", "cloth")).toBe(false);
    expect(avatarSpriteMirror({ ...DEFAULT_AVATAR, accessory: "hijab" }, "right", "head")).toBe(false);
  });
  it.each(OUTFITS)("never reuses the front %s torso for a turned articulated avatar", (outfit) => {
    const a = { ...DEFAULT_AVATAR, outfit },
      column = OUTFITS.indexOf(outfit);
    expect(directionalTorsoCell(a, "down")).toBe(column);
    expect(directionalTorsoCell(a, "down-right")).toBe(8 + column);
    expect(directionalTorsoCell(a, "down-left")).toBe(8 + column);
    expect(directionalTorsoCell(a, "right")).toBe(16 + column);
    expect(directionalTorsoCell(a, "left")).toBe(16 + column);
    for (const dir of ["up", "up-left", "up-right"] as const)
      expect(directionalTorsoCell(a, dir)).toBe(24 + column);
  });
  it("whitelists public cosmetic actions and does not replace the activity heartbeat", () => {
    expect(clientMessageSchema.safeParse({ t: "activity" }).success).toBe(true);
    for (const action of AVATAR_ACTIONS)
      expect(clientMessageSchema.safeParse({ t: "avatarAction", action }).success).toBe(true);
    expect(clientMessageSchema.safeParse({ t: "avatarAction", action: "<script>" }).success).toBe(false);
    expect(
      clientMessageSchema.safeParse({ t: "move", x: Infinity, y: 1, dir: "down", moving: true }).success,
    ).toBe(false);
  });
  it("ships lossless WebP atlases with alpha (pixel colors are recolored and probed at runtime)", () => {
    for (const url of AVATAR_ASSET_URLS) {
      const webp = readFileSync(`public${url}`);
      expect(webp.toString("ascii", 0, 4)).toBe("RIFF");
      expect(webp.toString("ascii", 8, 12)).toBe("WEBP");
      // VP8L = lossless; lossy compression shifts the collar/chin detection and recolor thresholds.
      expect(webp.toString("ascii", 12, 16)).toBe("VP8L");
      const bits = webp.readUInt32LE(21);
      expect((bits & 0x3fff) + 1).toBeGreaterThanOrEqual(1024);
      expect((bits >>> 28) & 1).toBe(1);
    }
  });
});
