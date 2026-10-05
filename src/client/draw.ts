/**
 * Menggambar avatar kartun dan peta secara prosedural di kanvas 2D.
 * Semua aset dibuat sendiri dengan bentuk dasar (tanpa gambar pihak lain).
 */
import type { AvatarConfig } from "@/shared/avatar";
import type { Direction } from "@/shared/protocol";
import { TILE, tileAt, type FloorKind, type MapData, type MapObject } from "@/shared/map";

export const PALETTE = {
  ink: "#1b3a2a",
  green: "#3f9a55",
  greenLight: "#7cc48a",
  cream: "#f7f5ec",
  wall: "#24432f",
  wallTop: "#33624a",
  wood: "#c49a6c",
  woodDark: "#8f6a45",
};

const FLOOR: Record<FloorKind, [string, string]> = {
  lobby: ["#f3efe2", "#ebe5d4"],
  work: ["#e9dcc4", "#e1d2b6"],
  meeting: ["#dde9df", "#d3e2d6"],
  lounge: ["#efe0cf", "#e7d5c1"],
  door: ["#e6dcc7", "#e6dcc7"],
  wall: [PALETTE.wall, PALETTE.wall],
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export interface AvatarPose {
  dir: Direction;
  /** Fase animasi jalan (radian); 0 = diam. */
  walk: number;
  sitting?: boolean;
}

/**
 * Menggambar avatar dengan titik kaki di (x, y). `s` = skala (1 = ukuran tile 32px).
 */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  x: number,
  y: number,
  s: number,
  pose: AvatarPose,
) {
  const bob = pose.walk ? Math.abs(Math.sin(pose.walk)) * 1.6 * s : 0;
  const bodyW = (a.body === "tall" ? 17 : a.body === "small" ? 15 : 19) * s;
  const bodyH = (a.body === "tall" ? 13 : a.body === "small" ? 9 : 11) * s;
  const headR = (a.body === "small" ? 9.5 : 10.5) * s;
  const sitDrop = pose.sitting ? 3 * s : 0;

  ctx.save();
  // Bayangan
  ctx.fillStyle = "rgba(20,40,28,0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y, 10 * s, 3.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Kaki
  if (!pose.sitting) {
    const step = pose.walk ? Math.sin(pose.walk) * 2.5 * s : 0;
    ctx.fillStyle = PALETTE.ink;
    roundRect(ctx, x - 6 * s, y - 5 * s + step * 0.3, 5 * s, 5 * s, 2 * s);
    ctx.fill();
    roundRect(ctx, x + 1 * s, y - 5 * s - step * 0.3, 5 * s, 5 * s, 2 * s);
    ctx.fill();
  }

  const by = y - 4 * s - bodyH - bob + sitDrop;
  // Badan (hoodie)
  ctx.fillStyle = a.bodyColor;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1.6 * s;
  roundRect(ctx, x - bodyW / 2, by, bodyW, bodyH + 2 * s, 6 * s);
  ctx.fill();
  ctx.stroke();
  // Tangan
  ctx.fillStyle = a.skin;
  const arm = pose.walk ? Math.sin(pose.walk) * 1.5 * s : 0;
  ctx.beginPath();
  ctx.arc(x - bodyW / 2 + 1 * s, by + bodyH * 0.7 + arm, 2.6 * s, 0, Math.PI * 2);
  ctx.arc(x + bodyW / 2 - 1 * s, by + bodyH * 0.7 - arm, 2.6 * s, 0, Math.PI * 2);
  ctx.fill();

  // Kepala
  const hy = by - headR + 3 * s;
  ctx.fillStyle = a.skin;
  ctx.beginPath();
  ctx.arc(x, hy, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  drawHair(ctx, a, x, hy, headR, s, pose.dir);
  if (pose.dir !== "up") drawFace(ctx, a, x, hy, headR, s, pose.dir);
  ctx.restore();
}

function drawHair(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  x: number,
  hy: number,
  r: number,
  s: number,
  dir: Direction,
) {
  ctx.fillStyle = a.hairColor;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1.4 * s;
  const back = dir === "up";
  switch (a.hair) {
    case "short":
    case "bob":
    case "spiky":
    case "bun": {
      ctx.beginPath();
      if (back) ctx.arc(x, hy, r, 0, Math.PI * 2);
      else ctx.arc(x, hy, r, Math.PI * 1.02, Math.PI * 1.98);
      if (!back) ctx.quadraticCurveTo(x, hy - r * 0.25, x - r, hy - r * 0.05);
      ctx.fill();
      ctx.stroke();
      if (a.hair === "bob") {
        roundRect(ctx, x - r - 1.5 * s, hy - r * 0.2, 4 * s, r * 0.95, 2 * s);
        ctx.fill();
        roundRect(ctx, x + r - 2.5 * s, hy - r * 0.2, 4 * s, r * 0.95, 2 * s);
        ctx.fill();
      }
      if (a.hair === "spiky") {
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) {
          ctx.moveTo(x + i * 4 * s - 3 * s, hy - r + 2 * s);
          ctx.lineTo(x + i * 4 * s, hy - r - 4 * s);
          ctx.lineTo(x + i * 4 * s + 3 * s, hy - r + 2 * s);
        }
        ctx.fill();
      }
      if (a.hair === "bun") {
        ctx.beginPath();
        ctx.arc(x, hy - r - 2.5 * s, 4.5 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "sprout": {
      // Tunas daun khas Meetopia.
      ctx.strokeStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.moveTo(x, hy - r);
      ctx.lineTo(x, hy - r - 4 * s);
      ctx.stroke();
      ctx.fillStyle = PALETTE.green;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + side * 3.6 * s, hy - r - 5 * s, 4 * s, 2.3 * s, side * -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "none":
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
  dir: Direction,
) {
  const shift = dir === "left" ? -3 * s : dir === "right" ? 3 * s : 0;
  const ex = 3.8 * s;
  const ey = hy + 1 * s;
  ctx.fillStyle = PALETTE.ink;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1.3 * s;
  const eye = (cx: number) => {
    ctx.beginPath();
    ctx.arc(cx, ey, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
  };
  const lineEye = (cx: number) => {
    ctx.beginPath();
    ctx.moveTo(cx - 1.7 * s, ey);
    ctx.lineTo(cx + 1.7 * s, ey);
    ctx.stroke();
  };
  const arcEye = (cx: number) => {
    ctx.beginPath();
    ctx.arc(cx, ey + 0.8 * s, 1.7 * s, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  };
  switch (a.face) {
    case "sleepy":
      lineEye(x + shift - ex);
      lineEye(x + shift + ex);
      break;
    case "wink":
      eye(x + shift - ex);
      arcEye(x + shift + ex);
      break;
    case "calm":
      arcEye(x + shift - ex);
      arcEye(x + shift + ex);
      break;
    default:
      eye(x + shift - ex);
      eye(x + shift + ex);
  }
  // Pipi
  ctx.fillStyle = "rgba(232,120,110,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + shift - 6 * s, ey + 3 * s, 2 * s, 1.2 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + shift + 6 * s, ey + 3 * s, 2 * s, 1.2 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Mulut
  ctx.strokeStyle = PALETTE.ink;
  ctx.beginPath();
  if (a.face === "surprised") {
    ctx.fillStyle = PALETTE.ink;
    ctx.ellipse(x + shift, ey + 4 * s, 1.4 * s, 1.8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (a.face === "calm" || a.face === "sleepy") {
    ctx.moveTo(x + shift - 1.6 * s, ey + 4 * s);
    ctx.lineTo(x + shift + 1.6 * s, ey + 4 * s);
    ctx.stroke();
  } else {
    ctx.arc(x + shift, ey + 2.6 * s, 2.2 * s, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- peta

function drawObject(ctx: CanvasRenderingContext2D, o: MapObject) {
  const x = o.x * TILE;
  const y = o.y * TILE;
  const w = o.w * TILE;
  const h = o.h * TILE;
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.ink;
  switch (o.kind) {
    case "rug":
      ctx.fillStyle = "rgba(63,154,85,0.16)";
      roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 14);
      ctx.fill();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "rgba(63,154,85,0.45)";
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    case "desk":
      ctx.fillStyle = PALETTE.wood;
      roundRect(ctx, x + 2, y + 4, w - 4, h - 6, 5);
      ctx.fill();
      ctx.stroke();
      // Laptop
      ctx.fillStyle = "#cfd6d2";
      roundRect(ctx, x + w / 2 - 9, y + 7, 18, 12, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PALETTE.green;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 13, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Cangkir
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + 12, y + 14, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case "chair":
      ctx.fillStyle = "#4b7d61";
      roundRect(ctx, x + 7, y + 6, w - 14, h - 10, 6);
      ctx.fill();
      ctx.stroke();
      break;
    case "table":
      ctx.fillStyle = PALETTE.wood;
      roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 12);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.moveTo(x + 14, y + h / 2);
      ctx.lineTo(x + w - 14, y + h / 2);
      ctx.stroke();
      break;
    case "sofa":
      ctx.fillStyle = PALETTE.green;
      roundRect(ctx, x + 2, y + 4, w - 4, h - 6, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PALETTE.greenLight;
      for (let i = 0; i < o.w; i++) {
        roundRect(ctx, x + i * TILE + 6, y + 10, TILE - 12, h - 18, 5);
        ctx.fill();
      }
      break;
    case "plant":
      ctx.fillStyle = "#b5714a";
      roundRect(ctx, x + 9, y + 17, 14, 12, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PALETTE.green;
      for (const [dx, dy, r] of [
        [16, 12, 7],
        [10, 9, 5],
        [22, 9, 5],
        [16, 5, 5],
      ]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    case "whiteboard":
    case "noticeboard":
      ctx.fillStyle = o.kind === "whiteboard" ? "#ffffff" : "#d7b58a";
      roundRect(ctx, x + 3, y + 3, w - 6, h - 8, 4);
      ctx.fill();
      ctx.stroke();
      if (o.kind === "whiteboard") {
        ctx.strokeStyle = PALETTE.green;
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 12);
        ctx.lineTo(x + 40, y + 12);
        ctx.moveTo(x + 12, y + 18);
        ctx.lineTo(x + 60, y + 18);
        ctx.stroke();
      } else {
        for (const [dx, c] of [
          [10, "#fff6a8"],
          [36, "#bfe6c6"],
          [62, "#ffd3c4"],
        ] as const) {
          ctx.fillStyle = c;
          ctx.fillRect(x + dx, y + 7, 18, 14);
        }
      }
      break;
    case "bookshelf":
      ctx.fillStyle = PALETTE.woodDark;
      roundRect(ctx, x + 2, y + 2, w - 4, h - 6, 3);
      ctx.fill();
      ctx.stroke();
      ["#d9605a", "#4a7fc1", "#e0a33a", "#3f9a55", "#8a63c9", "#3aa6a0"].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(x + 6 + i * 9, y + 6, 6, h - 16);
      });
      break;
    case "vending":
      ctx.fillStyle = "#d9605a";
      roundRect(ctx, x + 3, y + 2, w - 6, h - 4, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e8f1f4";
      ctx.fillRect(x + 8, y + 6, w - 26, h - 14);
      ctx.fillStyle = "#fff";
      ctx.fillRect(x + w - 15, y + 8, 6, 4);
      break;
    case "coffee":
      ctx.fillStyle = "#555b66";
      roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2 + 2, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "welcome":
      ctx.fillStyle = PALETTE.green;
      roundRect(ctx, x + 2, y + 4, w - 4, h - 8, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px Outfit, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Meetopia", x + w / 2, y + h / 2);
      break;
  }
}

/** Menggambar lapisan statis peta (lantai, dinding, objek) ke kanvas offscreen sekali saja. */
export function renderStaticMap(map: MapData, zoneLabel: (key: string) => string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = map.width * TILE;
  c.height = map.height * TILE;
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const kind = tileAt(map, x, y);
      const [a, b] = FLOOR[kind];
      ctx.fillStyle = (x + y) % 2 === 0 ? a : b;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (kind === "work" || kind === "lounge") {
        ctx.strokeStyle = "rgba(120,90,50,0.08)";
        ctx.beginPath();
        ctx.moveTo(x * TILE, y * TILE + 16);
        ctx.lineTo(x * TILE + TILE, y * TILE + 16);
        ctx.stroke();
      }
    }
  }
  // Dinding dengan sisi atas lebih terang agar terasa 3D.
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (tileAt(map, x, y) !== "wall") continue;
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (tileAt(map, x, y + 1) !== "wall") {
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(x * TILE, y * TILE + TILE - 10, TILE, 10);
      }
    }
  }
  // Area: label dan garis putus-putus untuk ruang privat.
  for (const z of map.zones) {
    if (z.private) {
      ctx.save();
      ctx.strokeStyle = "rgba(63,154,85,0.7)";
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.strokeRect(z.x * TILE + 3, z.y * TILE + 3, z.w * TILE - 6, z.h * TILE - 6);
      ctx.restore();
    }
  }
  for (const o of map.objects) if (o.kind === "rug") drawObject(ctx, o);
  for (const o of map.objects) if (o.kind !== "rug") drawObject(ctx, o);
  ctx.font = "600 13px Outfit, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (const z of map.zones) {
    const label = zoneLabel(z.label) + (z.private ? " 🔒" : "");
    ctx.fillStyle = "rgba(27,58,42,0.45)";
    ctx.fillText(label, z.x * TILE + 10, (z.y + z.h) * TILE - 22);
  }
  return c;
}
