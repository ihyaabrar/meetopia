import { HAIR_STYLES, OUTFITS, type AvatarConfig, type AvatarDirection } from "@/shared/avatar";

type Sprite = {
  canvas: HTMLCanvasElement;
  face: { x: number; y: number; w: number; h: number } | null;
  collarY?: number;
};
const atlases = new Map<string, Sprite[]>();
const variants = new Map<string, Sprite>();
let pending: Promise<void> | null = null;
export const AVATAR_ASSET_URLS = [
  "/avatars/painted/heads-v1.webp",
  "/avatars/painted/clothing-v1.webp",
  "/avatars/painted/headwear-v1.webp",
  "/avatars/painted/rear-heads-v1.webp",
  "/avatars/painted/sleeves-v1.webp",
  "/avatars/painted/body-kit-v2.webp",
  "/avatars/painted/bodies-v3.webp",
] as const;
const skinPixel = (r: number, g: number, b: number) =>
  r > 170 && g > 110 && b > 75 && r > g * 1.1 && g > b * 1.08;
/** Atlas rows are approximate generated artwork: discard tiny disconnected neighboring-cell debris. */
export function removeCellDebris(pixels: ImageData, w: number, h: number) {
  const visited = new Uint8Array(w * h),
    queue = new Int32Array(w * h);
  const parts: Array<{ area: number; x0: number; y0: number; x1: number; y1: number }> = [];
  for (let start = 0; start < w * h; start++) {
    if (visited[start] || pixels.data[start * 4 + 3] < 100) continue;
    let head = 0,
      tail = 1,
      x0 = w,
      y0 = h,
      x1 = 0,
      y1 = 0;
    queue[0] = start;
    visited[start] = 1;
    while (head < tail) {
      const p = queue[head++],
        x = p % w,
        y = Math.floor(p / w);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (const n of [
        x > 0 ? p - 1 : -1,
        x < w - 1 ? p + 1 : -1,
        y > 0 ? p - w : -1,
        y < h - 1 ? p + w : -1,
      ]) {
        if (n >= 0 && !visited[n] && pixels.data[n * 4 + 3] >= 100) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
    }
    parts.push({ area: tail, x0, y0, x1, y1 });
  }
  const main = parts.reduce((a, b) => (a.area > b.area ? a : b), { area: 0, x0: 0, y0: 0, x1: 0, y1: 0 });
  for (const p of parts) {
    const gap = Math.max(main.x0 - p.x1, p.x0 - main.x1, main.y0 - p.y1, p.y0 - main.y1);
    if (p.area >= Math.max(6, main.area * 0.015) || gap < h * 0.02) continue;
    for (let y = Math.max(0, p.y0 - 1); y <= Math.min(h - 1, p.y1 + 1); y++)
      for (let x = Math.max(0, p.x0 - 1); x <= Math.min(w - 1, p.x1 + 1); x++)
        pixels.data[(y * w + x) * 4 + 3] = 0;
  }
}
/** Isolated atlas cells are cropped in memory only. Source PNG and alpha are never rewritten. */
function decodeAtlas(image: HTMLImageElement, cols: number, rows: number, bodies = false): Sprite[] {
  const cellW = image.width / cols,
    cellH = image.height / rows;
  return Array.from({ length: cols * rows }, (_, i) => {
    const cell = document.createElement("canvas");
    cell.width = Math.ceil(cellW);
    cell.height = Math.ceil(cellH);
    const ctx = cell.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(
      image,
      (i % cols) * cellW,
      Math.floor(i / cols) * cellH,
      cellW,
      cellH,
      0,
      0,
      cell.width,
      cell.height,
    );
    const pixels = ctx.getImageData(0, 0, cell.width, cell.height);
    removeCellDebris(pixels, cell.width, cell.height);
    ctx.putImageData(pixels, 0, 0);
    let minX = cell.width,
      minY = cell.height,
      maxX = 0,
      maxY = 0;
    let collarY = cell.height;
    let fx = cell.width,
      fy = cell.height,
      fmaxX = 0,
      fmaxY = 0,
      count = 0;
    for (let y = 0; y < cell.height; y++)
      for (let x = 0; x < cell.width; x++) {
        const j = (y * cell.width + x) * 4,
          [r, g, b, alpha] = pixels.data.subarray(j, j + 4);
        if (alpha < 100) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        // Ignore small ear islands, and use the central lower face for stable feature alignment.
        if (skinPixel(r, g, b) && x > cell.width * 0.15 && x < cell.width * 0.85) {
          fx = Math.min(fx, x);
          fy = Math.min(fy, y);
          fmaxX = Math.max(fmaxX, x);
          fmaxY = Math.max(fmaxY, y);
          count++;
        }
      }
    if (bodies) {
      // Follow only the first central skin run (the neck), stopping at the ink collar.
      // Shoulder tips can start above the neckline, so their garment bounding box is not an anchor.
      let started = false,
        missing = 0;
      for (let y = minY; y < Math.min(cell.height, minY + cell.height * 0.3); y++) {
        let skin = 0;
        for (let x = Math.floor(cell.width * 0.4); x < cell.width * 0.6; x++) {
          const j = (y * cell.width + x) * 4;
          if (pixels.data[j + 3] > 100 && skinPixel(pixels.data[j], pixels.data[j + 1], pixels.data[j + 2]))
            skin++;
        }
        if (skin >= 3) {
          started = true;
          missing = 0;
          collarY = y + 1;
        } else if (started && ++missing >= 2) break;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, maxX - minX + 1);
    canvas.height = Math.max(1, maxY - minY + 1);
    canvas
      .getContext("2d")!
      .drawImage(cell, minX, minY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    return {
      canvas,
      ...(bodies && collarY < cell.height ? { collarY: collarY - minY } : {}),
      face:
        count > cell.width * cell.height * 0.04
          ? { x: fx - minX, y: fy - minY, w: fmaxX - fx + 1, h: fmaxY - fy + 1 }
          : null,
    };
  });
}
export function loadAvatarAssets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!pending)
    pending = Promise.all(
      AVATAR_ASSET_URLS.map(
        (url, i) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              atlases.set(
                url,
                decodeAtlas(img, i === 2 || i === 3 ? 4 : 8, i === 0 || i === 6 ? 6 : 4, i === 6),
              );
              resolve();
            };
            img.onerror = () => resolve(); // Offline/missing asset: native renderer remains usable.
            img.src = url;
          }),
      ),
    ).then(() => undefined);
  return pending;
}
export function paintedAvatarReady() {
  return AVATAR_ASSET_URLS.every((url) => atlases.has(url));
}
export function spriteView(dir: AvatarDirection): { view: number; mirror: boolean } {
  if (dir === "up") return { view: 3, mirror: false };
  if (dir.startsWith("up-")) return { view: 3, mirror: dir === "up-right" };
  // Generated sheets use left-facing 3/4 and profile artwork. Mirror for right-facing views.
  if (dir === "left" || dir === "right") return { view: 2, mirror: dir === "right" };
  if (dir.includes("-")) return { view: 1, mirror: dir === "down-right" };
  return { view: 0, mirror: false };
}
/** The hair sheet faces left; clothing/headwear sheets face right. Keep layers anatomically aligned. */
export function avatarSpriteMirror(a: AvatarConfig, dir: AvatarDirection, kind: "head" | "cloth") {
  if (kind === "head" && dir.startsWith("up-")) return dir === "up-right";
  const rightSource =
    kind === "cloth" || a.hair === "none" || ["hijab", "cap", "beanie"].includes(a.accessory);
  return dir.includes(rightSource ? "left" : "right");
}
function rgb(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function recolor(
  source: Sprite,
  key: string,
  a: AvatarConfig,
  kind: "head" | "cloth" | "cover" | "limb" | "leg" | "body",
): Sprite {
  const cached = variants.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = source.canvas.width;
  canvas.height = source.canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source.canvas, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
    hair = rgb(a.hairColor),
    skin = rgb(a.skin),
    cloth = rgb(kind === "cover" ? a.accessoryColor : a.bodyColor);
  for (let j = 0; j < pixels.data.length; j += 4) {
    const [r, g, b, alpha] = pixels.data.subarray(j, j + 4);
    if (alpha < 1) continue;
    let target: number[] | null = null,
      lum = 1;
    if ((kind === "leg" || kind === "body") && b > r * 1.08 && b > g * 1.02 && b > 35) {
      const lower = j / 4 / canvas.width / canvas.height > 0.48;
      target = lower && ["shorts", "skirt"].includes(a.bottom) ? skin : rgb(a.pantsColor);
      lum = (r + g + b) / (46 + 65 + 82);
    } else if (
      (kind === "leg" || kind === "body") &&
      r > 165 &&
      Math.abs(r - g) < 30 &&
      Math.abs(g - b) < 30 &&
      a.shoes !== "sneakers"
    ) {
      target = rgb(a.shoes === "boots" ? "#6c4935" : "#4b7860");
      lum = (r + g + b) / (240 * 3);
    } else if (kind !== "cloth" && skinPixel(r, g, b)) {
      target = skin;
      lum = (r + g + b) / (252 + 211 + 179);
    } else if (
      (kind === "cloth" || kind === "cover" || kind === "limb" || kind === "body") &&
      g > r * 1.07 &&
      g > b * 1.05
    ) {
      target = cloth;
      lum = (r + g + b) / (70 + 140 + 98);
    } else if (
      kind !== "cloth" &&
      kind !== "limb" &&
      kind !== "leg" &&
      kind !== "body" &&
      r > 47 &&
      r > g * 1.02 &&
      g >= b * 0.98 &&
      r < 175
    ) {
      target = hair;
      lum = (r + g + b) / (95 + 70 + 57);
    }
    if (target) for (let c = 0; c < 3; c++) pixels.data[j + c] = Math.min(255, Math.round(target[c] * lum));
  }
  ctx.putImageData(pixels, 0, 0);
  const sprite = { ...source, canvas };
  if (variants.size >= 160) variants.delete(variants.keys().next().value!);
  variants.set(key, sprite);
  return sprite;
}
export function avatarSprite(a: AvatarConfig, dir: AvatarDirection, kind: "head" | "cloth"): Sprite | null {
  const { view } = spriteView(dir);
  const cover = ["hijab", "cap", "beanie"].includes(a.accessory)
    ? ["none", "hijab", "cap", "beanie"].indexOf(a.accessory)
    : a.hair === "none"
      ? 0
      : -1;
  const rear = kind === "head" && dir.startsWith("up-") && atlases.has(AVATAR_ASSET_URLS[3]);
  const cohesive = kind === "cloth" && !dir.startsWith("up") && atlases.has(AVATAR_ASSET_URLS[5]);
  const url = AVATAR_ASSET_URLS[cohesive ? 5 : rear ? 3 : kind === "cloth" ? 1 : cover >= 0 ? 2 : 0];
  const index = cohesive
    ? OUTFITS.indexOf(a.outfit)
    : rear
      ? cover >= 0
        ? 12 + cover
        : HAIR_STYLES.indexOf(a.hair)
      : (kind === "cloth" ? OUTFITS.indexOf(a.outfit) : cover >= 0 ? cover : HAIR_STYLES.indexOf(a.hair)) *
          4 +
        view;
  const source = atlases.get(url)?.[index];
  if (!source) return null;
  return recolor(
    source,
    `${url}:${index}:${a.skin}:${a.hairColor}:${a.bodyColor}:${a.accessoryColor}`,
    a,
    kind === "cloth" ? "cloth" : cover > 0 ? "cover" : "head",
  );
}

/** Painted sleeve pieces share the torso's material and overlap at shoulder/elbow/wrist joints. */
export function drawSleeve(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  dir: AvatarDirection,
  shoulder: readonly number[],
  elbow: readonly number[],
  wrist: readonly number[],
  gesture = false,
): boolean {
  const cohesive = atlases.has(AVATAR_ASSET_URLS[5]);
  const atlas = atlases.get(AVATAR_ASSET_URLS[cohesive ? 5 : 4]);
  if (!atlas) return false;
  // Generated sleeve sheet uses outfits in columns and upper/lower/front/side in rows.
  const sideView = dir === "left" || dir === "right",
    offset = OUTFITS.indexOf(a.outfit) + (cohesive ? 8 : sideView ? 16 : 0);
  for (const [i, start, end, width] of [
    [0, shoulder, elbow, 4.4],
    [1, elbow, wrist, 3.9],
  ] as const) {
    const source = atlas[offset + i * 8];
    const sprite = recolor(
      source,
      `sleeve:${cohesive}:${offset + i * 8}:${a.bodyColor}:${a.skin}`,
      a,
      "limb",
    );
    const dx = end[0] - start[0],
      dy = end[1] - start[1],
      length = Math.hypot(dx, dy);
    ctx.save();
    ctx.translate(start[0], start[1]);
    ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
    // Crop open joint rims from the production pieces; overlap their painted material instead.
    const cropY = cohesive ? 0 : sprite.canvas.height * (i === 0 ? 0.02 : 0.1);
    const cropH = sprite.canvas.height * (cohesive ? (i === 1 && gesture ? 0.77 : 1) : i === 0 ? 0.74 : 0.9);
    ctx.drawImage(sprite.canvas, 0, cropY, sprite.canvas.width, cropH, -width / 2, -1.2, width, length + 2.4);
    ctx.restore();
  }
  return true;
}

export function drawPaintedLeg(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  x: number,
  hip: number,
  footX: number,
  footY: number,
  mirror: boolean,
): boolean {
  const source = atlases.get(AVATAR_ASSET_URLS[5])?.[24];
  if (!source) return false;
  const sprite = recolor(source, `leg:${a.pantsColor}:${a.skin}:${a.bottom}:${a.shoes}`, a, "leg");
  ctx.save();
  ctx.translate(x, hip - 1);
  const dx = footX - x,
    dy = footY + 3 - hip;
  ctx.rotate(-Math.atan2(dx, dy));
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(sprite.canvas, -3, 0, 6, Math.hypot(dx, dy) + 1);
  if (a.bottom === "cargo") {
    ctx.strokeStyle = "#283b3c";
    ctx.lineWidth = 0.4;
    ctx.strokeRect(-1.7, 2.5, 2.4, 2.2);
  }
  ctx.restore();
  return true;
}

/** Whole-body silhouettes for everyday locomotion: garments, sleeves and feet share one drawing. */
export function unifiedBodySprite(
  a: AvatarConfig,
  dir: AvatarDirection,
  action: string,
  frame: number,
): Sprite | null {
  if (
    !["trousers", "cargo"].includes(a.bottom) ||
    a.prop !== "none" ||
    !["idle", "walk", "run"].includes(action)
  )
    return null;
  // Non-front movement keeps the articulated rig; this atlas only authors front walking frames.
  if (action !== "idle" && dir !== "down") return null;
  const atlas = atlases.get(AVATAR_ASSET_URLS[6]);
  if (!atlas) return null;
  let row = dir.startsWith("up") ? 3 : dir === "left" || dir === "right" ? 2 : dir.includes("-") ? 1 : 0;
  if ((action === "walk" || action === "run") && dir === "down") row = 4 + (Math.floor(frame / 2) % 2);
  const source = atlas[row * 8 + OUTFITS.indexOf(a.outfit)];
  const sprite = recolor(
    source,
    `body:${row}:${a.outfit}:${a.bodyColor}:${a.skin}:${a.pantsColor}:${a.shoes}`,
    a,
    "body",
  );
  if (a.bottom !== "cargo") return sprite;
  const cargoKey = `cargo:${row}:${a.outfit}:${a.bodyColor}:${a.skin}:${a.pantsColor}:${a.shoes}`;
  const cachedCargo = variants.get(cargoKey);
  if (cachedCargo) return cachedCargo;
  const canvas = document.createElement("canvas");
  canvas.width = sprite.canvas.width;
  canvas.height = sprite.canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(sprite.canvas, 0, 0);
  ctx.strokeStyle = "#283b3c";
  ctx.lineWidth = canvas.width * 0.008;
  // Small thigh pockets use the same ink/shading as the authored trousers, not detached legs.
  for (const x of row === 2 ? [0.48] : [0.3, 0.6]) {
    ctx.beginPath();
    ctx.roundRect(
      canvas.width * x,
      canvas.height * 0.72,
      canvas.width * 0.1,
      canvas.height * 0.06,
      canvas.width * 0.01,
    );
    ctx.stroke();
  }
  const cargo = { ...sprite, canvas };
  if (variants.size >= 160) variants.delete(variants.keys().next().value!);
  variants.set(cargoKey, cargo);
  return cargo;
}
