/**
 * Avatar chibi Meetopia (gaya desain baru): kepala besar dengan rambut penuh, mata besar berkilau,
 * kaus berlengan pendek, celana, dan sepatu. Animasi jalan, napas, dan kedip.
 * Digambar prosedural sehingga setiap kombinasi konfigurasi (FR-11) langsung tersedia.
 */
import type { AvatarConfig } from "@/shared/avatar";
import type { Direction } from "@/shared/protocol";
import { C, INK, rr, shade, groundShadow } from "./common";

export interface AvatarPose {
  dir: Direction;
  /** Fase animasi jalan (radian); 0 = diam. */
  walk: number;
  sitting?: boolean;
  /** Waktu dalam detik, untuk napas & kedip. */
  time?: number;
  /** Offset fase per orang agar tidak bernapas serempak. */
  seed?: number;
}

const SHOE = "#2b2623";
const PANTS = "#34404c";
const LINE = 1.5;

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
  const d = dims(a);
  return 3 + d.legH + d.torsoH + d.headR * 0.62;
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
  const side = pose.dir === "left" ? -1 : pose.dir === "right" ? 1 : 0;
  const back = pose.dir === "up";

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
  if (!back) drawBackHair(ctx, a, x, hy, headR, s, side);

  // Kaki: celana + sepatu. Tampak depan/belakang: kaki berdampingan; tampak samping: melangkah
  // maju-mundur searah hadap (kaki belakang digambar lebih dulu dan sedikit lebih gelap).
  const leg = (lx: number, lift: number, dark: boolean) => {
    ctx.fillStyle = dark ? shade(PANTS, -0.25) : PANTS;
    rr(ctx, lx - 2.8 * s, hipY, 5.6 * s, legH + 1 * s - lift, 2 * s);
    ctx.fill();
    ctx.lineWidth = LINE * s;
    ctx.stroke();
    ctx.fillStyle = SHOE;
    ctx.beginPath();
    ctx.ellipse(lx + side * 1.4 * s, y - 2.2 * s - lift, side ? 4 * s : 3.6 * s, 2.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  if (side === 0) {
    leg(x - 3.6 * s, Math.max(0, step), false);
    leg(x + 3.6 * s, Math.max(0, -step), false);
  } else {
    const stride = walking ? Math.sin(pose.walk) * 3.2 * s : 0;
    leg(x - side * stride - side * 0.8 * s, Math.max(0, -step) * 0.6, true);
    leg(x + side * stride + side * 0.8 * s, Math.max(0, step) * 0.6, false);
  }

  // Badan: kaus berlengan pendek (lebih ramping saat tampak samping)
  const bodyW = side ? torsoW * 0.72 : torsoW;
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
    rr(ctx, ax - 2.8 * s + dx * 0.4, ty + 1 * s + dy * 0.4, 5.6 * s, 5.5 * s, 2.4 * s);
    ctx.fill();
    ctx.lineWidth = LINE * s;
    ctx.stroke();
    // lengan + tangan
    ctx.fillStyle = dark ? shade(a.skin, -0.12) : a.skin;
    rr(ctx, ax - 2 * s + dx, ty + 5 * s + dy, 4 * s, torsoH - 3.5 * s, 2 * s);
    ctx.fill();
    ctx.stroke();
  };
  const armDy = pose.sitting ? -1 * s : swing;
  if (side === 0) {
    arm(x - (bodyW / 2 + 0.6 * s), armDy);
    arm(x + (bodyW / 2 + 0.6 * s), -armDy);
  } else {
    // lengan belakang mengayun berlawanan dengan lengan depan
    sideArm(x - side * 1.5 * s, -side * swing, true);
  }
  const g = ctx.createLinearGradient(0, ty, 0, ty + torsoH);
  g.addColorStop(0, shade(a.bodyColor, 0.1));
  g.addColorStop(1, shade(a.bodyColor, -0.12));
  rr(ctx, x - bodyW / 2, ty, bodyW, torsoH + 1.5 * s, 5 * s);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = LINE * 1.1 * s;
  ctx.stroke();
  if (side !== 0) sideArm(x - side * 0.8 * s, side * swing, false);
  if (!back) {
    // kerah
    ctx.fillStyle = "rgba(255,255,255,0.85)";
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
    if (side === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.beginPath();
      ctx.arc(x - torsoW * 0.18, ty + torsoH * 0.5, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

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
  ctx.ellipse(x, hy, headR, headR * 0.94, 0, 0, Math.PI * 2);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.lineWidth = LINE * 1.2 * s;
  ctx.stroke();

  if (!back) drawFace(ctx, a, x, hy, headR, s, side, blink);
  drawHair(ctx, a, x, hy, headR, s, side, back);
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
  if (a.hair !== "bob" && a.hair !== "long") return;
  const len = a.hair === "long" ? r * 1.35 : r * 0.75;
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
  ctx.moveTo(x - r * 1.04, hy + r * 0.1);
  ctx.bezierCurveTo(x - r * 1.18, hy - r * 1.05, x + r * 1.18, hy - r * 1.05, x + r * 1.04, hy + r * 0.1);
  // pelipis kanan
  ctx.lineTo(x + r * 0.86, hy - r * 0.02);
  if (style === "spiky") {
    for (let i = 4; i >= 0; i--) {
      const px = x - r * 0.8 + (r * 1.6 * i) / 4 + side * 2.5 * s;
      ctx.lineTo(px + r * 0.2, fringe + (i % 2 ? r * 0.08 : -r * 0.1));
      ctx.lineTo(px, fringe + r * 0.12);
    }
  } else if (style === "curly") {
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
    const len = a.hair === "long" ? r * 1.3 : a.hair === "bob" ? r * 0.8 : r * 0.55;
    ctx.beginPath();
    ctx.moveTo(x - r * 1.06, hy + r * 0.2);
    ctx.bezierCurveTo(x - r * 1.2, hy - r * 1.08, x + r * 1.2, hy - r * 1.08, x + r * 1.06, hy + r * 0.2);
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
  const eyes: number[] = side === 0 ? [x - gap, x + gap] : [x + side * r * 0.5];
  const shift = side * r * 0.62;
  ctx.strokeStyle = INK;
  ctx.lineCap = "round";
  ctx.lineWidth = 1.5 * s;

  const open = (cx: number) => {
    ctx.beginPath();
    ctx.ellipse(cx, ey, 2.1 * s, 2.8 * s, 0, 0, Math.PI * 2);
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
    if (blink || a.face === "sleepy") return closed(cx);
    if (a.face === "calm") return happyArc(cx);
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
    ctx.quadraticCurveTo(cx, ey - 5.2 * s - lift, cx + 1.8 * s, ey - 4.4 * s - lift);
    ctx.stroke();
  }

  // Pipi merona
  ctx.fillStyle = "rgba(236,120,110,0.35)";
  for (const cx of side === 0 ? [x - r * 0.62, x + r * 0.62] : [x + side * r * 0.28]) {
    ctx.beginPath();
    ctx.ellipse(cx, ey + 3.6 * s, 2.4 * s, 1.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mulut
  const mx = x + shift * 1.15;
  const my = ey + 4.6 * s;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3 * s;
  ctx.beginPath();
  if (a.face === "surprised") {
    ctx.ellipse(mx, my + 0.4 * s, 1.4 * s, 1.8 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#7a2f2a";
    ctx.fill();
    ctx.stroke();
  } else if (a.face === "calm" || a.face === "sleepy") {
    ctx.moveTo(mx - 1.4 * s, my);
    ctx.quadraticCurveTo(mx, my + 0.8 * s, mx + 1.4 * s, my);
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
