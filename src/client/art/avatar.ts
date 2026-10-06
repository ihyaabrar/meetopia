/**
 * Production avatar: painted modular heads/clothing/sleeves on an articulated chibi rig.
 * The native fallback below keeps customization usable if the raster assets cannot load.
 */
import type { AvatarConfig, AvatarDirection, AvatarActivity, AvatarCondition } from "@/shared/avatar";
import { drawHeldProp, drawCondition, drawClothingDetail } from "./avatar-details";
import { C, INK, rr, shade, groundShadow } from "./common";
import { drawPaintedAvatar, paintedDims, paintedHeadOffset, paintedTopY } from "./avatar-painted";

export interface AvatarPose {
  dir: AvatarDirection;
  /** Fase animasi jalan (radian); 0 = diam. */
  walk: number;
  sitting?: boolean;
  /** Waktu dalam detik, untuk napas & kedip. */
  time?: number;
  /** Offset fase per orang agar tidak bernapas serempak. */
  seed?: number;
  part?: "body" | "legs";
  activity?: AvatarActivity;
  condition?: AvatarCondition;
  /** Freeze at a representative frame for reduced-motion users. */
  staticPose?: boolean;
}

const LINE = 1.15;

interface Dims {
  headR: number;
  torsoW: number;
  torsoH: number;
  legH: number;
}

function dims(a: AvatarConfig): Dims {
  if (a.body === "tall") return { headR: 12.5, torsoW: 15, torsoH: 13, legH: 7 };
  if (a.body === "small") return { headR: 12, torsoW: 14, torsoH: 9, legH: 4.5 };
  return { headR: 13, torsoW: 17, torsoH: 11, legH: 5.5 };
}

/** Tinggi pusat kepala di atas titik kaki (skala 1, berdiri). Dipakai untuk ikon wajah. */
export function avatarHeadY(a: AvatarConfig): number {
  const d = paintedDims(a);
  return 3 + d.leg + d.torso + paintedHeadOffset(a);
}
/**
 * Skala avatar di peta. Peta ilustrasi memperlihatkan seluruh denah, jadi avatar sedikit lebih besar dari
 * perabot agar orang tetap mudah dikenali (sekitar 1,8 tile tingginya).
 */
export const AVATAR_MAP_SCALE = 1.5;

export function avatarNameOffset(a: AvatarConfig, dir: AvatarDirection, sitting = false) {
  const s = AVATAR_MAP_SCALE;
  return Math.max(53 * s, paintedTopY(a, dir) * s + 20 - (sitting ? 4 : 0));
}
export function avatarPartY(a: AvatarConfig, part: "body" | "legs"): number {
  const d = paintedDims(a);
  return part === "body" ? 3 + d.leg + d.torso / 2 : 3 + d.leg / 2;
}

/** Menggambar avatar dengan titik kaki di (x, y). `s` = skala (1 ≈ tinggi 48px). */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  x: number,
  y: number,
  s: number,
  pose: AvatarPose,
) {
  if (drawPaintedAvatar(ctx, a, x, y, s, pose, drawAccessory)) return;
  const condition = pose.condition ?? "normal";
  const activity = pose.activity ?? "idle";
  const face = condition !== "normal" ? condition : a.face;
  // Expression presets are transient rendering overrides, not changes to saved facial parts.
  a = {
    ...a,
    face,
    eyes: ["sleepy", "tired", "bored"].includes(face)
      ? "sleepy"
      : ["calm", "excited"].includes(face)
        ? "happy"
        : ["surprised", "confused"].includes(face)
          ? "wide"
          : a.eyes,
    mouth: ["sad", "angry", "tired", "hungry", "thirsty"].includes(face)
      ? "frown"
      : ["surprised", "confused"].includes(face)
        ? "open"
        : activity === "talk"
          ? "open"
          : face === "excited"
            ? "laugh"
            : a.mouth,
    brows: ["angry", "focus"].includes(face) ? "angled" : face === "sad" ? "arched" : a.brows,
  };
  pose = {
    ...pose,
    sitting: pose.sitting || activity === "sit" || activity === "type" || activity === "read",
  };
  const t = pose.time ?? 0;
  const seed = pose.seed ?? 0;
  const walking = pose.walk !== 0;
  const breath = walking ? 0 : Math.sin(t * 2.2 + seed * 6) * 0.5 * s;
  const bob = walking ? Math.abs(Math.sin(pose.walk)) * 1.6 * s : 0;
  const blink = !walking && t > 0 && (t + seed * 7) % 4.2 < 0.13;
  const d = dims(a);
  const headR = d.headR * s;
  const torsoW = d.torsoW * s;
  const torsoH = d.torsoH * s;
  const legH = (pose.sitting ? 2 : d.legH) * s;
  const diagonal = pose.dir.includes("-");
  const side = pose.dir.includes("left")
    ? diagonal
      ? -0.6
      : -1
    : pose.dir.includes("right")
      ? diagonal
        ? 0.6
        : 1
      : 0;
  const back = pose.dir.startsWith("up");

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  groundShadow(ctx, x, y, 12 * s, 4.5 * s, 0.3);

  const step = walking ? Math.sin(pose.walk) * 2.4 * s : 0;
  const hipY = y - 3 * s - legH - bob;
  const ty = hipY - torsoH + breath * 0.3;
  const hy = ty - headR * 0.62 + breath * 0.4;
  // Rambut panjang/bob di belakang badan
  if (!back && !pose.part) drawBackHair(ctx, a, x, hy, headR, s, side);

  // Kaki: celana + sepatu. Tampak depan/belakang: kaki berdampingan; tampak samping: melangkah
  // maju-mundur searah hadap (kaki belakang digambar lebih dulu dan sedikit lebih gelap).
  const leg = (lx: number, lift: number, dark: boolean) => {
    const pants = a.pantsColor ?? "#29323c";
    ctx.fillStyle =
      a.bottom === "shorts" || a.bottom === "skirt" ? a.skin : dark ? shade(pants, -0.25) : pants;
    rr(ctx, lx - 2.8 * s, hipY, 5.6 * s, legH + 1 * s - lift, 2 * s);
    ctx.fill();
    ctx.lineWidth = LINE * s;
    ctx.stroke();
    if (a.bottom === "shorts" || a.bottom === "cargo") {
      ctx.fillStyle = dark ? shade(pants, -0.25) : pants;
      rr(ctx, lx - 2.8 * s, hipY, 5.6 * s, a.bottom === "shorts" ? legH * 0.5 : legH, s);
      ctx.fill();
      ctx.stroke();
      if (a.bottom === "cargo") {
        ctx.strokeStyle = shade(pants, 0.3);
        ctx.lineWidth = 0.6 * s;
        ctx.strokeRect(lx - 1.5 * s, hipY + s, 3 * s, 2.5 * s);
        ctx.strokeStyle = INK;
      }
    }
    ctx.fillStyle = a.shoes === "boots" ? "#73523b" : a.shoes === "canvas" ? "#3c685b" : "#f9f6ee";
    ctx.beginPath();
    ctx.ellipse(lx + side * 1.4 * s, y - 2.2 * s - lift, side ? 4 * s : 3.6 * s, 2.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.1 * s;
    ctx.stroke();
    ctx.strokeStyle = "#bdbbb3";
    ctx.beginPath();
    ctx.moveTo(lx - 2.7 * s, y - 0.7 * s - lift);
    ctx.lineTo(lx + 2.7 * s, y - 0.7 * s - lift);
    ctx.stroke();
    ctx.strokeStyle = INK;
    if (a.shoes === "sneakers" && !back) {
      ctx.strokeStyle = "#c3c8c7";
      ctx.lineWidth = 0.5 * s;
      for (const sy of [2.5, 3.4]) {
        ctx.beginPath();
        ctx.moveTo(lx - 1.1 * s, y - sy * s - lift);
        ctx.lineTo(lx + 1.1 * s, y - sy * s - lift);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
    }
  };
  if (side === 0) {
    leg(x - 3.6 * s, Math.max(0, step), false);
    leg(x + 3.6 * s, Math.max(0, -step), false);
  } else {
    const stride = walking ? Math.sin(pose.walk) * 3.2 * s : 0;
    leg(x - side * stride - side * 0.8 * s, Math.max(0, -step) * 0.6, true);
    leg(x + side * stride + side * 0.8 * s, Math.max(0, step) * 0.6, false);
  }

  if (a.bottom === "skirt") {
    ctx.fillStyle = a.pantsColor;
    ctx.lineWidth = LINE * s;
    ctx.beginPath();
    ctx.moveTo(x - 5 * s, hipY - s);
    ctx.lineTo(x + 5 * s, hipY - s);
    ctx.lineTo(x + 8 * s, hipY + 4 * s);
    ctx.lineTo(x - 8 * s, hipY + 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = shade(a.pantsColor, 0.25);
    ctx.lineWidth = 0.6 * s;
    for (const dx of [-3, 0, 3]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * s, hipY);
      ctx.lineTo(x + dx * 1.3 * s, hipY + 3 * s);
      ctx.stroke();
    }
    ctx.strokeStyle = INK;
  }
  if (pose.part === "legs") {
    ctx.restore();
    return;
  }
  // Badan: kaus berlengan pendek (lebih ramping saat tampak samping)
  const bodyW = side ? torsoW * (diagonal ? 0.88 : 0.72) : torsoW;
  if (a.accessory === "backpack") {
    ctx.fillStyle = a.accessoryColor;
    rr(ctx, x - bodyW * 0.65 - side * 3 * s, ty + s, bodyW * 1.3, torsoH, 3 * s);
    ctx.fill();
    ctx.stroke();
  }
  const swing = walking ? Math.sin(pose.walk) * 2 * s : 0;
  // Lengan tampak samping: lengan baju memanjang dengan tangan kecil di ujung.
  const sideArm = (ax: number, dx: number, dark: boolean) => {
    const top = ty + 1.5 * s;
    const len = torsoH - 2 * s;
    ctx.save();
    ctx.translate(ax, top);
    ctx.rotate(dx * 0.06);
    ctx.fillStyle = shade(a.bodyColor, dark ? -0.25 : -0.1);
    rr(ctx, -2.6 * s, 0, 5.2 * s, len, 2.6 * s);
    ctx.fill();
    ctx.lineWidth = LINE * s;
    ctx.stroke();
    ctx.fillStyle = dark ? shade(a.skin, -0.12) : a.skin;
    ctx.beginPath();
    ctx.arc(0, len + 0.5 * s, 2.3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  const arm = (ax: number, dy: number, dx = 0, dark = false) => {
    // lengan baju
    ctx.fillStyle = shade(a.bodyColor, dark ? -0.22 : -0.08);
    const shortSleeve = ["tee", "polo", "striped"].includes(a.outfit);
    const sleeve = shortSleeve ? 4.5 : d.torsoH - 1;
    rr(ctx, ax - 2.8 * s + dx * 0.4, ty + 1 * s + dy * 0.4, 5.6 * s, sleeve * s, 2.4 * s);
    ctx.fill();
    ctx.lineWidth = LINE * s;
    ctx.stroke();
    if (!shortSleeve) {
      ctx.fillStyle = shade(a.bodyColor, -0.23);
      rr(ctx, ax - 2.4 * s + dx * 0.4, ty + (sleeve - 1) * s + dy * 0.4, 4.8 * s, 1.3 * s, 0.7 * s);
      ctx.fill();
    }
    // lengan + tangan
    ctx.fillStyle = dark ? shade(a.skin, -0.12) : a.skin;
    rr(ctx, ax - 2 * s + dx, ty + sleeve * s + dy, 4 * s, shortSleeve ? torsoH - 3.5 * s : 3 * s, 2 * s);
    ctx.fill();
    ctx.stroke();
  };
  const armDy = pose.sitting ? -1 * s : swing;
  if (side === 0) {
    arm(x - (bodyW / 2 + 0.6 * s), armDy);
    arm(x + (bodyW / 2 + 0.6 * s), activity === "wave" ? -8 * s + Math.sin(t * 7) * s : -armDy);
  } else {
    // lengan belakang mengayun berlawanan dengan lengan depan
    sideArm(x - side * 1.5 * s, -side * swing, true);
  }
  const g = ctx.createLinearGradient(0, ty, 0, ty + torsoH);
  g.addColorStop(0, shade(a.bodyColor, 0.1));
  g.addColorStop(1, shade(a.bodyColor, -0.12));
  rr(ctx, x - bodyW / 2, ty, bodyW, torsoH + 1.5 * s, 3 * s);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = LINE * 1.1 * s;
  ctx.stroke();
  // Ribbed hem and restrained fabric highlights keep clothing from looking like a flat badge.
  ctx.fillStyle = shade(a.bodyColor, -0.2);
  rr(ctx, x - bodyW / 2 + s, hipY - 0.3 * s, bodyW - 2 * s, 1.3 * s, 0.7 * s);
  ctx.fill();
  ctx.strokeStyle = shade(a.bodyColor, 0.2);
  ctx.lineWidth = 0.5 * s;
  ctx.beginPath();
  ctx.moveTo(x - bodyW * 0.36, ty + torsoH * 0.35);
  ctx.quadraticCurveTo(x - bodyW * 0.4, ty + torsoH * 0.55, x - bodyW * 0.33, ty + torsoH * 0.8);
  ctx.stroke();
  ctx.strokeStyle = INK;
  if (side !== 0) sideArm(x - side * 0.8 * s, side * swing, false);
  if (!back) {
    if (a.outfit === "hoodie") {
      ctx.strokeStyle = shade(a.bodyColor, -0.23);
      ctx.lineWidth = 0.65 * s;
      // Kangaroo-pocket stitching, not a heavy outlined oval on the stomach.
      ctx.beginPath();
      ctx.moveTo(x - bodyW * 0.22, ty + torsoH * 0.54);
      ctx.lineTo(x + bodyW * 0.22, ty + torsoH * 0.54);
      ctx.lineTo(x + bodyW * 0.28, ty + torsoH * 0.81);
      ctx.quadraticCurveTo(x, ty + torsoH * 0.9, x - bodyW * 0.28, ty + torsoH * 0.81);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = "#d7e5d2";
      ctx.lineWidth = 0.7 * s;
      for (const dx of [-2, 2]) {
        ctx.beginPath();
        ctx.moveTo(x + dx * s, ty + s);
        ctx.lineTo(x + dx * s, ty + 5 * s);
        ctx.stroke();
      }
    } else if (a.outfit === "jacket") {
      ctx.fillStyle = "#f5efe5";
      ctx.beginPath();
      ctx.moveTo(x - 3 * s, ty);
      ctx.lineTo(x + 3 * s, ty);
      ctx.lineTo(x + 1.5 * s, hipY);
      ctx.lineTo(x - 1.5 * s, hipY);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = s;
      ctx.stroke();
    }
    // kerah
    ctx.fillStyle = a.outfit === "hoodie" ? shade(a.bodyColor, -0.28) : "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.moveTo(x - 3.2 * s + side * 2.5 * s, ty + 0.6 * s);
    ctx.quadraticCurveTo(
      x + side * 2.5 * s,
      ty + 4 * s,
      x + (side ? 1.5 : 3.2) * s + side * 2.5 * s,
      ty + 0.6 * s,
    );
    ctx.closePath();
    ctx.fill();
    // sablon kecil di dada
    if (side === 0 && a.outfit === "tee") {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.roundRect(x - torsoW * 0.2, ty + torsoH * 0.4, 2.4 * s, 0.7 * s, 0.3 * s);
      ctx.fill();
    }
  }

  if (pose.part === "body") {
    drawClothingDetail(ctx, a, x, ty, bodyW, torsoH, s, back);
    ctx.restore();
    return;
  }
  drawClothingDetail(ctx, a, x, ty, bodyW, torsoH, s, back);
  if (!back) drawHeldProp(ctx, a, activity, x + side * 2 * s, hipY - 3 * s, s, t);
  // Kepala
  // telinga
  ctx.fillStyle = shade(a.skin, -0.04);
  ctx.lineWidth = LINE * s;
  const ear = (ex: number) => {
    ctx.fillStyle = shade(a.skin, -0.04);
    ctx.lineWidth = LINE * s;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.ellipse(x + ex * headR, hy + headR * 0.12, 2.6 * s, 3.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  if (side === 0) {
    ear(-0.98);
    ear(0.98);
  }
  const hg = ctx.createRadialGradient(x - headR * 0.3, hy - headR * 0.35, headR * 0.2, x, hy, headR * 1.1);
  hg.addColorStop(0, shade(a.skin, 0.2));
  hg.addColorStop(1, shade(a.skin, -0.05));
  ctx.beginPath();
  ctx.ellipse(
    x,
    hy,
    headR * (a.head === "wide" ? 1.09 : a.head === "oval" ? 0.92 : 1),
    headR * (a.head === "soft" ? 0.88 : 0.94),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.lineWidth = LINE * 1.2 * s;
  ctx.stroke();

  if (!back) drawFace(ctx, a, x, hy, headR, s, side, blink);
  drawHair(ctx, a, x, hy, headR, s, side, back);
  drawAccessory(ctx, a, x, hy, headR, s, side, back);
  if (a.eyewear !== "none")
    drawAccessory(
      ctx,
      { ...a, accessory: a.eyewear === "sun" ? "sunglasses" : "glasses" },
      x,
      hy,
      headR,
      s,
      side,
      back,
    );
  if (a.headphones && a.accessory !== "headphones")
    drawAccessory(ctx, { ...a, accessory: "headphones" }, x, hy, headR, s, side, back);
  if (condition !== "normal") drawCondition(ctx, condition, x + headR * 0.92, hy - headR * 0.55, s);
  if (activity === "wave") {
    const hx = x + headR * 1.3,
      handY = hy + headR * 0.45 + Math.sin(t * 7) * s;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.5 * s;
    ctx.beginPath();
    ctx.moveTo(x + bodyW * 0.48, ty + torsoH * 0.6);
    ctx.quadraticCurveTo(hx + 2 * s, ty + torsoH * 0.8, hx, handY);
    ctx.stroke();
    ctx.strokeStyle = a.skin;
    ctx.lineWidth = 2.8 * s;
    ctx.stroke();
    ctx.fillStyle = a.skin;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.ellipse(hx, handY, 2.5 * s, 3 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(hx + (i - 1) * s, handY - s);
      ctx.lineTo(hx + (i - 1) * s, handY - (3.3 + 0.3 * (i % 2)) * s);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function hairGradient(ctx: CanvasRenderingContext2D, a: AvatarConfig, hy: number, r: number) {
  const g = ctx.createLinearGradient(0, hy - r, 0, hy + r * 0.4);
  g.addColorStop(0, shade(a.hairColor, 0.16));
  g.addColorStop(1, shade(a.hairColor, -0.08));
  return g;
}

/** Rambut di belakang kepala (rambut panjang/bob terlihat di samping wajah). */
function drawBackHair(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  x: number,
  hy: number,
  r: number,
  s: number,
  side: number,
) {
  if (a.accessory === "hijab") return;
  if (a.hair === "ponytail" || a.hair === "braids") {
    ctx.fillStyle = hairGradient(ctx, a, hy, r);
    ctx.lineWidth = LINE * s;
    for (const sd of a.hair === "braids" ? [-1, 1] : [side ? -side : 1]) {
      for (let i = 0; i < (a.hair === "braids" ? 4 : 1); i++) {
        ctx.beginPath();
        ctx.ellipse(
          x + sd * r * 0.92,
          hy + r * (0.3 + i * 0.24),
          3.4 * s,
          (a.hair === "braids" ? 2.5 : 8) * s,
          -sd * 0.25,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  if (!["bob", "long", "wavy"].includes(a.hair)) return;
  const len = a.hair === "long" || a.hair === "wavy" ? r * 1.35 : r * 0.75;
  ctx.fillStyle = hairGradient(ctx, a, hy, r);
  ctx.lineWidth = LINE * s;
  ctx.beginPath();
  // Tampak samping: hanya di sisi belakang kepala.
  const left = side === 1 ? x - r * 1.1 : side === -1 ? x - r * 0.2 : x - r * 1.08;
  const right = side === -1 ? x + r * 1.1 : side === 1 ? x + r * 0.2 : x + r * 1.08;
  ctx.moveTo(left, hy - r * 0.2);
  ctx.lineTo(left + (side === 1 ? 0.05 * r : 0), hy + len);
  ctx.quadraticCurveTo((left + right) / 2, hy + len + 3 * s, right, hy + len);
  ctx.lineTo(right, hy - r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** Bentuk rambut bagian atas kepala dengan poni; menutupi dahi sampai sedikit di atas mata. */
function capPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  hy: number,
  r: number,
  s: number,
  side: number,
  style: string,
) {
  const fringe = hy - r * 0.18;
  ctx.beginPath();
  // Busur elips sedikit lebih besar dari kepala: puncak kepala selalu tertutup rambut.
  ctx.moveTo(x - r * 1.06, hy + r * 0.1);
  ctx.ellipse(x, hy - r * 0.04, r * 1.07, r * 1.04, 0, Math.PI, Math.PI * 2);
  ctx.lineTo(x + r * 1.04, hy + r * 0.1);
  // pelipis kanan
  ctx.lineTo(x + r * 0.86, hy - r * 0.02);
  if (style === "spiky") {
    for (let i = 4; i >= 0; i--) {
      const px = x - r * 0.8 + (r * 1.6 * i) / 4 + side * 2.5 * s;
      ctx.lineTo(px + r * 0.2, fringe + (i % 2 ? r * 0.08 : -r * 0.1));
      ctx.lineTo(px, fringe + r * 0.12);
    }
  } else if (style === "sidepart" || style === "undercut") {
    ctx.lineTo(x + r * 0.7, hy - r * 0.3);
    ctx.quadraticCurveTo(
      x + r * 0.45,
      hy - r * 0.68,
      x - r * 0.7,
      hy - r * (style === "undercut" ? 0.4 : 0.04),
    );
    ctx.lineTo(x - r * 0.86, hy - r * 0.02);
  } else if (style === "bob" || style === "braids") {
    ctx.lineTo(x + r * 0.7, fringe + r * 0.13);
    ctx.lineTo(x + r * 0.2, fringe + r * 0.13);
    ctx.lineTo(x, fringe - r * 0.1);
    ctx.lineTo(x - r * 0.2, fringe + r * 0.13);
    ctx.lineTo(x - r * 0.86, fringe + r * 0.13);
  } else if (style === "curly" || style === "wavy") {
    for (let i = 5; i >= 0; i--) {
      const px = x - r * 0.86 + (r * 1.72 * i) / 5;
      ctx.quadraticCurveTo(px + r * 0.17, fringe + r * 0.2, px, fringe);
    }
  } else {
    // poni menyamping: menyapu dari kanan ke kiri (atau ke arah hadap)
    const sw = side === 0 ? 1 : side;
    ctx.quadraticCurveTo(x + r * 0.5 * sw, fringe + r * 0.22, x + r * 0.05 * sw, fringe - r * 0.02);
    ctx.quadraticCurveTo(x - r * 0.3 * sw, fringe + r * 0.2, x - r * 0.62 * sw, fringe + r * 0.06);
    ctx.quadraticCurveTo(x - r * 0.8 * sw, fringe + r * 0.12, x - r * 0.86 * sw, hy - r * 0.02);
  }
  ctx.lineTo(x - r * 0.86, hy - r * 0.02);
  ctx.closePath();
}

function drawHair(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  x: number,
  hy: number,
  r: number,
  s: number,
  side: number,
  back: boolean,
) {
  if (a.accessory === "hijab") return;
  if (a.hair === "none") {
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.arc(x - r * 0.2, hy - r * 0.25, r * 0.6, Math.PI * 1.15, Math.PI * 1.5);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = hairGradient(ctx, a, hy, r);
  ctx.strokeStyle = INK;
  ctx.lineWidth = LINE * 1.1 * s;

  if (a.hair === "bun") {
    ctx.beginPath();
    ctx.arc(x, hy - r * 1.02, 5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (back) {
    // Tampak belakang: rambut menutupi hampir seluruh kepala
    const len = ["long", "wavy"].includes(a.hair) ? r * 1.3 : a.hair === "bob" ? r * 0.8 : r * 0.55;
    ctx.beginPath();
    ctx.moveTo(x - r * 1.07, hy + r * 0.2);
    ctx.ellipse(x, hy - r * 0.04, r * 1.08, r * 1.05, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(x + r * 1.07, hy + r * 0.2);
    ctx.lineTo(x + r * 0.98, hy + len);
    ctx.quadraticCurveTo(x, hy + len + 3 * s, x - r * 0.98, hy + len);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    if (side !== 0) {
      // Tampak samping: rambut menutupi bagian belakang kepala sampai tengkuk
      const bx = x - side * r;
      ctx.beginPath();
      ctx.moveTo(x + side * r * 0.1, hy - r * 0.95);
      ctx.quadraticCurveTo(bx - side * r * 0.2, hy - r * 0.9, bx - side * r * 0.08, hy + r * 0.1);
      ctx.quadraticCurveTo(bx + side * r * 0.05, hy + r * 0.55, x - side * r * 0.45, hy + r * 0.5);
      ctx.lineTo(x - side * r * 0.1, hy - r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    capPath(ctx, x, hy, r, s, side, a.hair);
    ctx.fill();
    ctx.stroke();
    // cambang di samping wajah
    if (a.hair !== "spiky") {
      for (const sx of side === 0 ? [-1, 1] : [-side]) {
        rr(ctx, x + sx * r * 0.93 - 1.8 * s, hy - r * 0.15, 3.6 * s, r * 0.42, 1.6 * s);
        ctx.fill();
      }
    }
  }
  // kilau rambut (tipis, agar tidak terlihat seperti helm)
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.3 * s;
  ctx.beginPath();
  ctx.arc(x - r * 0.15, hy - r * 0.25, r * 0.55, Math.PI * 1.25, Math.PI * 1.45);
  ctx.stroke();

  if (a.hair === "sprout") {
    // Tunas daun khas Meetopia di puncak kepala
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.moveTo(x + 1 * s, hy - r * 0.9);
    ctx.quadraticCurveTo(x + 1.5 * s, hy - r * 0.9 - 3 * s, x + 1 * s, hy - r * 0.9 - 4.5 * s);
    ctx.stroke();
    for (const sd of [-1, 1]) {
      ctx.save();
      ctx.translate(x + 1 * s + sd * 3.6 * s, hy - r * 0.9 - 5.2 * s);
      ctx.rotate(sd * -0.45);
      ctx.beginPath();
      ctx.ellipse(0, 0, 4 * s, 2.3 * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = sd < 0 ? C.green : C.greenLight;
      ctx.fill();
      ctx.lineWidth = 1.2 * s;
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  x: number,
  hy: number,
  r: number,
  s: number,
  side: number,
  blink: boolean,
) {
  const ey = hy + r * 0.2;
  const gap = r * 0.4;
  // Tampak samping: satu mata di depan, mulut dan pipi mengikuti arah hadap.
  const eyes: number[] =
    Math.abs(side) < 1 ? [x - gap + side * r * 0.3, x + gap + side * r * 0.3] : [x + side * r * 0.5];
  const shift = side * r * 0.62;
  ctx.strokeStyle = INK;
  ctx.lineCap = "round";
  ctx.lineWidth = 1.5 * s;

  const open = (cx: number) => {
    ctx.beginPath();
    ctx.ellipse(
      cx,
      ey,
      (a.eyes === "dot" ? 1.4 : 2.1) * s,
      (a.eyes === "dot" ? 1.6 : a.eyes === "wide" ? 3.4 : 2.8) * s,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 0.7 * s, ey - 1 * s, 0.9 * s, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - 0.6 * s, ey + 1.1 * s, 0.45 * s, 0, Math.PI * 2);
    ctx.fill();
  };
  const closed = (cx: number) => {
    ctx.beginPath();
    ctx.moveTo(cx - 2 * s, ey + 0.4 * s);
    ctx.quadraticCurveTo(cx, ey + 1.4 * s, cx + 2 * s, ey + 0.4 * s);
    ctx.stroke();
  };
  const happyArc = (cx: number) => {
    ctx.beginPath();
    ctx.arc(cx, ey + 1.2 * s, 2.1 * s, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  };
  eyes.forEach((cx, i) => {
    if (blink || a.eyes === "sleepy" || a.eyes === "closed") return closed(cx);
    if (a.eyes === "happy") return happyArc(cx);
    if (a.face === "wink" && i === 1) return happyArc(cx);
    open(cx);
  });

  // Alis tipis
  ctx.strokeStyle = shade(a.hairColor, -0.2);
  ctx.lineWidth = 1.1 * s;
  for (const cx of eyes) {
    ctx.beginPath();
    const lift = a.face === "surprised" ? 1.2 * s : 0;
    ctx.moveTo(cx - 1.8 * s, ey - 4.4 * s - lift);
    if (a.brows === "angled") ctx.lineTo(cx + 1.8 * s, ey - 3.2 * s - lift);
    else
      ctx.quadraticCurveTo(
        cx,
        ey - (a.brows === "straight" ? 4.4 : a.brows === "arched" ? 6.4 : 5.2) * s - lift,
        cx + 1.8 * s,
        ey - 4.4 * s - lift,
      );
    ctx.stroke();
  }

  // Pipi merona
  ctx.fillStyle = "rgba(236,120,110,0.35)";
  for (const cx of a.faceAccent === "none"
    ? []
    : side === 0
      ? [x - r * 0.62, x + r * 0.62]
      : [x + side * r * 0.28]) {
    if (a.faceAccent === "freckles") {
      ctx.fillStyle = "#aa7152";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(cx + (i - 1) * 1.4 * s, ey + 3 * s + (i % 2) * s, 0.45 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    if (a.faceAccent === "heart" || a.faceAccent === "star") {
      ctx.fillStyle = a.faceAccent === "heart" ? "#e97790" : "#efb84b";
      ctx.font = `${5 * s}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(a.faceAccent === "heart" ? "♥" : "★", cx, ey + 5 * s);
      continue;
    }
    ctx.beginPath();
    ctx.ellipse(cx, ey + 3.6 * s, 2.4 * s, 1.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mulut
  const mx = x + shift * 1.15;
  const my = ey + 4.6 * s;
  if (a.face === "shy") {
    ctx.fillStyle = "rgba(239,114,126,0.25)";
    ctx.beginPath();
    ctx.ellipse(x + shift, ey + 3 * s, r * 0.65, 2.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const moodMark: Partial<Record<AvatarConfig["face"], string>> = {
    confused: "?",
    hungry: "·",
    thirsty: "💧",
    cool: "✦",
    focus: "⌁",
    bored: "…",
    tired: "︱",
    sleepy: "z",
    sad: "💧",
    excited: "✧",
    angry: "╳",
  };
  if (moodMark[a.face]) {
    ctx.fillStyle =
      a.face === "angry" ? "#cb695d" : a.face === "sad" || a.face === "thirsty" ? "#54a7d3" : "#c99755";
    ctx.font = `700 ${5 * s}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText(moodMark[a.face]!, x + r * 0.8, hy - r * 0.28);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3 * s;
  ctx.beginPath();
  if (a.mouth === "open" || a.mouth === "laugh" || a.mouth === "tongue") {
    ctx.ellipse(mx, my + 0.4 * s, 1.4 * s, 1.8 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#7a2f2a";
    ctx.fill();
    ctx.stroke();
    if (a.mouth === "tongue") {
      ctx.fillStyle = "#ec8591";
      ctx.beginPath();
      ctx.ellipse(mx, my + 1.6 * s, s, 1.3 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (a.mouth === "frown") {
    ctx.moveTo(mx - 1.8 * s, my + s);
    ctx.quadraticCurveTo(mx, my - 1.5 * s, mx + 1.8 * s, my + s);
    ctx.stroke();
  } else if (a.mouth === "smile" && a.face === "normal") {
    ctx.moveTo(mx - 1.8 * s, my);
    ctx.quadraticCurveTo(mx, my + 1.8 * s, mx + 1.8 * s, my);
    ctx.stroke();
  } else if (a.mouth === "tiny" || a.mouth === "straight") {
    ctx.moveTo(mx - 1.4 * s, my);
    ctx.quadraticCurveTo(mx, my + (a.mouth === "straight" ? 0 : 0.8 * s), mx + 1.4 * s, my);
    ctx.stroke();
  } else {
    ctx.moveTo(mx - 2 * s, my - 0.4 * s);
    ctx.quadraticCurveTo(mx, my + 2.2 * s, mx + 2 * s, my - 0.4 * s);
    ctx.closePath();
    ctx.fillStyle = "#8a3a33";
    ctx.fill();
    ctx.stroke();
  }
}

/** Aksesori mengikuti pose, jadi pilihan editor juga terlihat di dalam dunia. */
function drawAccessory(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  x: number,
  hy: number,
  r: number,
  s: number,
  side: number,
  back: boolean,
) {
  const item = a.accessory;
  if (!item || item === "none" || item === "backpack") return;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5 * s;
  if (item === "hijab") {
    ctx.fillStyle = a.accessoryColor;
    ctx.lineWidth = LINE * s;
    ctx.beginPath();
    ctx.ellipse(x, hy - r * 0.03, r * 1.14, r * 1.13, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(x + r * 1.1, hy + r * 0.9);
    ctx.lineTo(x + r * 0.6, hy + r * 1.1);
    ctx.lineTo(x - r * 0.7, hy + r * 1.05);
    ctx.lineTo(x - r * 1.1, hy + r * 0.9);
    ctx.closePath();
    // A real fabric opening, not a hair tint. Back views have no opening.
    if (!back) {
      ctx.moveTo(x + r * 0.88, hy);
      ctx.ellipse(x + side * r * 0.15, hy + r * 0.1, r * 0.88, r * 0.85, 0, 0, Math.PI * 2);
    }
    ctx.fill("evenodd");
    ctx.stroke();
    ctx.strokeStyle = shade(a.accessoryColor, 0.25);
    ctx.lineWidth = 0.7 * s;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.8, hy + r * 0.8);
    ctx.quadraticCurveTo(x, hy + r * 1.03, x + r * 0.7, hy + r * 0.9);
    ctx.stroke();
  } else if (item === "beanie") {
    ctx.fillStyle = a.accessoryColor;
    ctx.beginPath();
    ctx.ellipse(x, hy - r * 0.75, r * 1.02, r * 0.64, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    rr(ctx, x - r * 1.06, hy - r * 0.85, r * 2.12, 4 * s, s);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = shade(a.accessoryColor, 0.25);
    ctx.lineWidth = 0.6 * s;
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 2 * s, hy - r * 0.8);
      ctx.lineTo(x + i * 2 * s, hy - r * 0.8 + 3 * s);
      ctx.stroke();
    }
  } else if (item === "cap") {
    ctx.fillStyle = a.accessoryColor;
    ctx.beginPath();
    ctx.ellipse(x, hy - r * 0.78, r * 0.96, r * 0.45, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    rr(ctx, x - r * 1.04 + side * 3 * s, hy - r * 0.82, r * 2.08, 3 * s, 2 * s);
    ctx.fill();
    ctx.stroke();
  } else if (item === "headphones") {
    ctx.beginPath();
    ctx.arc(x, hy - r * 0.1, r * 1.08, Math.PI, Math.PI * 2);
    ctx.lineWidth = 3 * s;
    ctx.stroke();
    ctx.fillStyle = "#e9e6ef";
    for (const sd of [-1, 1]) {
      rr(ctx, x + sd * r - 2 * s, hy - 2 * s, 4 * s, 8 * s, 2 * s);
      ctx.fill();
      ctx.lineWidth = s;
      ctx.stroke();
    }
  } else if (item === "bow") {
    ctx.fillStyle = "#e782a0";
    const bx = x + r * 0.66,
      by = hy - r * 0.82;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - 5 * s, by - 3 * s);
    ctx.lineTo(bx - 5 * s, by + 3 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 5 * s, by - 3 * s);
    ctx.lineTo(bx + 5 * s, by + 3 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (!back && (item === "glasses" || item === "sunglasses")) {
    ctx.lineWidth = s;
    for (const sd of side === 0 ? [-1, 1] : [side]) {
      rr(
        ctx,
        x + sd * r * 0.4 - 3.8 * s,
        hy + r * 0.2 - 3 * s,
        7.6 * s,
        6 * s,
        a.eyewear === "round" ? 3 * s : 1 * s,
      );
      if (item === "sunglasses") {
        ctx.fillStyle = "#243344";
        ctx.fill();
      }
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - 1.5 * s, hy + r * 0.2);
    ctx.lineTo(x + 1.5 * s, hy + r * 0.2);
    ctx.stroke();
  } else if (!back && item === "mask") {
    ctx.fillStyle = "#a4bddb";
    rr(ctx, x - 5.5 * s + side * r * 0.3, hy + r * 0.36, 11 * s, 5.8 * s, 2 * s);
    ctx.fill();
    ctx.lineWidth = s;
    ctx.stroke();
  } else if (!back && item === "earrings") {
    ctx.fillStyle = "#f0cf73";
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + sd * r * 1.08, hy + r * 0.35, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 0.7 * s;
      ctx.stroke();
    }
  }
}
