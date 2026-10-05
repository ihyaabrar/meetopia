/**
 * Avatar kartun "chibi" Meetopia: kepala besar, hoodie, animasi jalan, napas, dan kedip.
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

const SHOE = "#2b302d";

/** Menggambar avatar dengan titik kaki di (x, y). `s` = skala (1 ≈ tinggi 46px). */
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
  const breath = walking ? 0 : Math.sin(t * 2.2 + seed * 6) * 0.6 * s;
  const bob = walking ? Math.abs(Math.sin(pose.walk)) * 1.8 * s : 0;
  const blink = !walking && (t + seed * 7) % 4.2 < 0.13;

  const bodyW = (a.body === "tall" ? 17 : a.body === "small" ? 15 : 20) * s;
  const bodyH = (a.body === "tall" ? 14 : a.body === "small" ? 10 : 12) * s;
  const headR = (a.body === "small" ? 10.5 : 11.5) * s;
  const sit = pose.sitting ? 4 * s : 0;
  const side = pose.dir === "left" ? -1 : pose.dir === "right" ? 1 : 0;
  const back = pose.dir === "up";

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  groundShadow(ctx, x, y, 12 * s, 4.5 * s, 0.28);

  // Kaki / sepatu
  if (!pose.sitting) {
    const step = walking ? Math.sin(pose.walk) * 2.6 * s : 0;
    ctx.fillStyle = SHOE;
    for (const [dx, lift] of [
      [-5.5, Math.max(0, step)],
      [0.5, Math.max(0, -step)],
    ] as const) {
      rr(ctx, x + dx * s + side * 1.5 * s, y - 5.5 * s - lift, 5 * s, 5 * s, 2.2 * s);
      ctx.fill();
    }
  }

  const by = y - 4 * s - bodyH - bob + sit + breath * 0.3;
  const top = shade(a.bodyColor, 0.08);
  const bottom = shade(a.bodyColor, -0.18);

  // Lengan (di belakang badan saat menghadap samping)
  const swing = walking ? Math.sin(pose.walk) * 2.2 * s : 0;
  const arm = (dx: number, dy: number) => {
    ctx.fillStyle = shade(a.bodyColor, -0.08);
    rr(ctx, x + dx - 2.6 * s, by + 2 * s + dy, 5.2 * s, bodyH * 0.72, 2.6 * s);
    ctx.fill();
    ctx.lineWidth = 1.4 * s;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = a.skin;
    ctx.beginPath();
    ctx.arc(x + dx, by + 2 * s + dy + bodyH * 0.72, 2.6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  if (pose.sitting) {
    arm(-bodyW / 2 + 2 * s, -1 * s);
    arm(bodyW / 2 - 2 * s, -1 * s);
  } else {
    arm(-bodyW / 2 + 0.5 * s, swing);
    arm(bodyW / 2 - 0.5 * s, -swing);
  }

  // Badan (hoodie)
  const g = ctx.createLinearGradient(0, by, 0, by + bodyH);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  rr(ctx, x - bodyW / 2, by, bodyW, bodyH + 2 * s, 7 * s);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.7 * s;
  ctx.strokeStyle = INK;
  ctx.stroke();
  if (!back) {
    // Kantong depan
    ctx.fillStyle = shade(a.bodyColor, -0.1);
    rr(ctx, x - bodyW * 0.3 + side * 2 * s, by + bodyH * 0.55, bodyW * 0.6, bodyH * 0.32, 3 * s);
    ctx.fill();
    // Tali hoodie
    if (side === 0) {
      ctx.strokeStyle = C.cream;
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.moveTo(x - 2.5 * s, by + 1 * s);
      ctx.lineTo(x - 2.8 * s, by + 5 * s);
      ctx.moveTo(x + 2.5 * s, by + 1 * s);
      ctx.lineTo(x + 2.8 * s, by + 5 * s);
      ctx.stroke();
    }
  }

  // Tudung di belakang leher
  const hy = by - headR + 4 * s + breath * 0.5;
  ctx.fillStyle = shade(a.bodyColor, -0.05);
  ctx.beginPath();
  ctx.ellipse(x, hy + headR * 0.55, headR * 1.02, headR * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.6 * s;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // Kepala
  const hg = ctx.createRadialGradient(x - headR * 0.35, hy - headR * 0.4, headR * 0.15, x, hy, headR * 1.1);
  hg.addColorStop(0, shade(a.skin, 0.25));
  hg.addColorStop(1, shade(a.skin, -0.06));
  ctx.beginPath();
  ctx.arc(x, hy, headR, 0, Math.PI * 2);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.lineWidth = 1.8 * s;
  ctx.strokeStyle = INK;
  ctx.stroke();

  drawHair(ctx, a, x, hy, headR, s, side, back);
  if (back) {
    // Tudung hoodie tampak dari belakang
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.8, hy + headR * 0.62);
    ctx.quadraticCurveTo(x, hy + headR * 0.4, x + headR * 0.8, hy + headR * 0.62);
    ctx.quadraticCurveTo(x + headR * 0.75, hy + headR * 1.15, x, hy + headR * 1.2);
    ctx.quadraticCurveTo(x - headR * 0.75, hy + headR * 1.15, x - headR * 0.8, hy + headR * 0.62);
    ctx.fillStyle = shade(a.bodyColor, -0.04);
    ctx.fill();
    ctx.lineWidth = 1.6 * s;
    ctx.strokeStyle = INK;
    ctx.stroke();
  } else drawFace(ctx, a, x, hy, headR, s, side, blink);
  ctx.restore();
}

function hairCap(
  ctx: CanvasRenderingContext2D,
  x: number,
  hy: number,
  r: number,
  s: number,
  side: number,
  back: boolean,
) {
  ctx.beginPath();
  if (back) {
    ctx.arc(x, hy, r + 0.6 * s, Math.PI * 0.95, Math.PI * 2.05);
    ctx.lineTo(x + r, hy + r * 0.5);
    ctx.quadraticCurveTo(x, hy + r * 0.85, x - r, hy + r * 0.5);
    ctx.closePath();
  } else {
    ctx.arc(x, hy, r + 0.6 * s, Math.PI * 1.0, Math.PI * 2.0);
    // poni bergelombang
    const n = 4;
    for (let i = n; i >= 0; i--) {
      const px = x - r + (2 * r * i) / n + side * 2 * s;
      const py = hy - r * 0.18 + (i % 2 === 0 ? 0 : r * 0.16);
      ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
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
  ctx.lineWidth = 1.6 * s;
  ctx.strokeStyle = INK;
  const hairFill = () => {
    const g = ctx.createLinearGradient(0, hy - r, 0, hy);
    g.addColorStop(0, shade(a.hairColor, 0.18));
    g.addColorStop(1, a.hairColor);
    return g;
  };
  const shine = () => {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.arc(x - r * 0.15, hy - r * 0.15, r * 0.7, Math.PI * 1.15, Math.PI * 1.45);
    ctx.stroke();
    ctx.strokeStyle = INK;
  };

  switch (a.hair) {
    case "short":
    case "bob":
    case "spiky":
    case "bun": {
      if (a.hair === "bun") {
        ctx.beginPath();
        ctx.arc(x, hy - r - 2.5 * s, 4.8 * s, 0, Math.PI * 2);
        ctx.fillStyle = hairFill();
        ctx.fill();
        ctx.stroke();
      }
      if (a.hair === "spiky") {
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) {
          const bx = x + i * 4.2 * s;
          ctx.moveTo(bx - 3.4 * s, hy - r + 3 * s);
          ctx.lineTo(bx + side * 1.5 * s, hy - r - 4.5 * s + Math.abs(i) * 1.2 * s);
          ctx.lineTo(bx + 3.4 * s, hy - r + 3 * s);
        }
        ctx.fillStyle = hairFill();
        ctx.fill();
        ctx.stroke();
      }
      if (a.hair === "bob") {
        ctx.fillStyle = a.hairColor;
        for (const sx of [-1, 1]) {
          if (side && sx === side) continue;
          rr(ctx, x + sx * r - (sx > 0 ? 4 : 0.5) * s, hy - r * 0.3, 4.5 * s, r * 1.15, 2.4 * s);
          ctx.fill();
          ctx.stroke();
        }
      }
      hairCap(ctx, x, hy, r, s, side, back);
      ctx.fillStyle = hairFill();
      ctx.fill();
      ctx.stroke();
      shine();
      break;
    }
    case "sprout": {
      // Tunas daun khas Meetopia
      ctx.beginPath();
      ctx.moveTo(x, hy - r + 0.5 * s);
      ctx.quadraticCurveTo(x + 0.5 * s, hy - r - 3 * s, x, hy - r - 4.5 * s);
      ctx.stroke();
      for (const sd of [-1, 1]) {
        ctx.save();
        ctx.translate(x + sd * 4 * s, hy - r - 5.5 * s);
        ctx.rotate(sd * -0.45);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4.6 * s, 2.6 * s, 0, 0, Math.PI * 2);
        const lg = ctx.createLinearGradient(0, -3 * s, 0, 3 * s);
        lg.addColorStop(0, C.greenLight);
        lg.addColorStop(1, C.green);
        ctx.fillStyle = lg;
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "rgba(27,58,42,0.45)";
        ctx.lineWidth = 0.9 * s;
        ctx.beginPath();
        ctx.moveTo(-3 * s * sd, 0);
        ctx.lineTo(3 * s * sd, 0);
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6 * s;
      }
      break;
    }
    case "none":
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.arc(x - r * 0.2, hy - r * 0.2, r * 0.6, Math.PI * 1.15, Math.PI * 1.5);
      ctx.stroke();
      break;
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
  const shift = side * 3.4 * s;
  const ex = 4.2 * s;
  const ey = hy + 1.8 * s;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4 * s;
  const dot = (cx: number) => {
    ctx.beginPath();
    ctx.ellipse(cx, ey, 1.7 * s, 2.2 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 0.6 * s, ey - 0.8 * s, 0.65 * s, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  };
  const line = (cx: number) => {
    ctx.beginPath();
    ctx.moveTo(cx - 1.8 * s, ey);
    ctx.lineTo(cx + 1.8 * s, ey);
    ctx.stroke();
  };
  const arc = (cx: number) => {
    ctx.beginPath();
    ctx.arc(cx, ey + 1 * s, 1.9 * s, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  };
  const eyes: number[] = side === 0 ? [x - ex, x + ex] : [x + shift - ex * 0.6, x + shift + ex * 0.9];
  eyes.forEach((cx, i) => {
    if (blink || a.face === "sleepy") return line(cx);
    if (a.face === "calm") return arc(cx);
    if (a.face === "wink" && i === 1) return arc(cx);
    dot(cx);
  });

  // Pipi merona
  ctx.fillStyle = "rgba(236,120,110,0.38)";
  for (const cx of side === 0 ? [x - 7 * s, x + 7 * s] : [x + shift + side * 6 * s]) {
    ctx.beginPath();
    ctx.ellipse(cx, ey + 3.4 * s, 2.3 * s, 1.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mulut
  const mx = x + shift * 0.9;
  const my = ey + 4.4 * s;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3 * s;
  ctx.beginPath();
  if (a.face === "surprised") {
    ctx.ellipse(mx, my + 0.4 * s, 1.5 * s, 1.9 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#7a2f2a";
    ctx.fill();
    ctx.stroke();
  } else if (a.face === "calm" || a.face === "sleepy") {
    ctx.moveTo(mx - 1.6 * s, my);
    ctx.quadraticCurveTo(mx, my + 0.8 * s, mx + 1.6 * s, my);
    ctx.stroke();
  } else {
    ctx.arc(mx, my - 1.4 * s, 2.4 * s, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
  }
}
