/**
 * The floor of a 3D world, painted once into a canvas: wood, stone, carpet, concrete, grass or deck
 * per tile, rugs, door thresholds and soft contact shadows under walls and furniture. Unlike the 2D
 * floor it contains no wall faces, labels or window light: in 3D those are real geometry and light.
 */
import { hash } from "@/client/art/common";
import { tileAt, type FloorKind, type MapData, type MapObject } from "@/shared/map";
import type { RoomPalette } from "./palette3d";
import type { WallPlan } from "./wall-plan";

/** Texture pixels per tile. */
export const FLOOR_PX = 48;
/** Wall body thickness as a share of a tile (must match the 3D walls). */
export const WALL_SHARE = 0.3;

const P = FLOOR_PX;

type Planks = { h: number; s: number; l: number; v: number; rows: number; len: number; seam: string };
const PLANKS: Partial<Record<FloorKind, Planks>> = {
  work: { h: 33, s: 42, l: 71, v: 3.5, rows: 4, len: 144, seam: "rgba(110,72,38,0.28)" },
  lounge: { h: 27, s: 36, l: 58, v: 3.5, rows: 4, len: 120, seam: "rgba(80,48,26,0.32)" },
  home: { h: 32, s: 45, l: 66, v: 3.5, rows: 3, len: 168, seam: "rgba(105,68,36,0.28)" },
  rooftop: { h: 25, s: 36, l: 53, v: 4, rows: 4, len: 96, seam: "rgba(52,30,16,0.55)" },
};

function planks(ctx: CanvasRenderingContext2D, tx: number, ty: number, o: Planks) {
  const rh = P / o.rows;
  const x0 = tx * P;
  for (let r = 0; r < o.rows; r++) {
    const R = ty * o.rows + r;
    const y0 = ty * P + r * rh;
    const off = Math.floor(hash(R, 11) * o.len);
    let x = x0;
    while (x < x0 + P) {
      const i = Math.floor((x + off) / o.len);
      const end = Math.min(x0 + P, (i + 1) * o.len - off);
      const v = hash(R, i, 3) * 2 - 1;
      ctx.fillStyle = `hsl(${o.h + v * 2} ${o.s}% ${o.l + v * o.v}%)`;
      ctx.fillRect(x, y0, end - x, rh);
      // Grain: a couple of faint lengthwise streaks per board.
      for (let g = 0; g < 2; g++) {
        ctx.fillStyle = hash(R, i, g) > 0.5 ? "rgba(255,240,215,0.10)" : "rgba(80,48,20,0.08)";
        ctx.fillRect(x, y0 + 2 + hash(i, R, g) * (rh - 4), end - x, 1);
      }
      if (end < x0 + P) {
        ctx.fillStyle = o.seam;
        ctx.fillRect(end - 1, y0, 1.5, rh);
      }
      x = end;
    }
    ctx.fillStyle = o.seam;
    ctx.fillRect(x0, y0 + rh - 1, P, 1.2);
  }
}

function speckle(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  n: number,
  light: string,
  dark: string,
) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = hash(tx, ty, i) > 0.5 ? light : dark;
    const s = 1 + Math.floor(hash(i, ty, tx) * 2);
    ctx.fillRect(tx * P + hash(i, tx, ty) * P, ty * P + hash(ty, i, tx) * P, s, s);
  }
}

function floorTile(ctx: CanvasRenderingContext2D, kind: FloorKind, tx: number, ty: number) {
  const x = tx * P,
    y = ty * P;
  const plank = PLANKS[kind];
  if (plank) {
    planks(ctx, tx, ty, plank);
    return;
  }
  switch (kind) {
    case "kitchen": {
      const n = 2,
        s = P / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = (tx * n + i + ty * n + j) % 2 === 0 ? "#efe9dc" : "#d9d2c1";
          ctx.fillRect(x + i * s, y + j * s, s, s);
        }
      ctx.fillStyle = "rgba(120,108,88,0.35)";
      for (let i = 0; i <= n; i++) {
        ctx.fillRect(x + i * s - 0.5, y, 1, P);
        ctx.fillRect(x, y + i * s - 0.5, P, 1);
      }
      break;
    }
    case "meeting":
      ctx.fillStyle = "#a7b3ae";
      ctx.fillRect(x, y, P, P);
      speckle(ctx, tx, ty, 34, "rgba(255,255,255,0.10)", "rgba(40,50,45,0.08)");
      break;
    case "bedroom":
      ctx.fillStyle = "#d2cdd6";
      ctx.fillRect(x, y, P, P);
      speckle(ctx, tx, ty, 34, "rgba(255,255,255,0.14)", "rgba(60,50,70,0.07)");
      break;
    case "garden": {
      ctx.fillStyle = `hsl(98 32% ${49 + (hash(tx, ty) * 2 - 1) * 2.5}%)`;
      ctx.fillRect(x, y, P, P);
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const gx = x + hash(tx, ty, i) * P,
          gy = y + hash(i, tx, ty) * P;
        ctx.strokeStyle = hash(ty, i) > 0.5 ? "rgba(40,90,35,0.35)" : "rgba(170,210,120,0.3)";
        ctx.beginPath();
        ctx.moveTo(gx, gy + 4);
        ctx.lineTo(gx + 1, gy);
        ctx.stroke();
      }
      if (hash(ty, tx, 9) > 0.9) {
        ctx.fillStyle = hash(tx, 3) > 0.5 ? "#f2c46d" : "#f6f1e6";
        ctx.beginPath();
        ctx.arc(x + 12 + hash(tx, ty, 4) * 24, y + 12 + hash(ty, tx, 4) * 24, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "gaming":
      ctx.fillStyle = "#33314a";
      ctx.fillRect(x, y, P, P);
      speckle(ctx, tx, ty, 26, "rgba(255,255,255,0.05)", "rgba(0,0,0,0.12)");
      // Faint diagonal weave every second tile.
      ctx.strokeStyle = "rgba(139,108,255,0.07)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      if ((tx + ty) % 2 === 0) {
        ctx.moveTo(x, y + P);
        ctx.lineTo(x + P, y);
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x + P, y + P);
      }
      ctx.stroke();
      break;
    case "studio":
      ctx.fillStyle = `hsl(40 6% ${84 + (hash(Math.floor(tx / 3), Math.floor(ty / 3)) * 2 - 1) * 1.5}%)`;
      ctx.fillRect(x, y, P, P);
      speckle(ctx, tx, ty, 14, "rgba(255,255,255,0.18)", "rgba(40,40,40,0.05)");
      ctx.fillStyle = "rgba(70,70,70,0.18)";
      if (tx % 4 === 0) ctx.fillRect(x, y, 1, P);
      if (ty % 4 === 0) ctx.fillRect(x, y, P, 1);
      break;
    case "lobby":
    default: {
      // Large 2x2 stone slabs with thin grout.
      const v = hash(Math.floor(tx / 2), Math.floor(ty / 2)) * 2 - 1;
      ctx.fillStyle = `hsl(38 24% ${85 + v * 2}%)`;
      ctx.fillRect(x, y, P, P);
      speckle(ctx, tx, ty, 10, "rgba(255,255,255,0.25)", "rgba(110,90,60,0.06)");
      ctx.fillStyle = "rgba(130,112,86,0.32)";
      if (tx % 2 === 0) ctx.fillRect(x, y, 1.2, P);
      if (ty % 2 === 0) ctx.fillRect(x, y, P, 1.2);
    }
  }
}

/** The floor that continues under a wall or door tile: taken from the floor on that side. */
function floorNear(
  map: MapData,
  plan: WallPlan,
  x: number,
  y: number,
  dx: number,
  dy: number,
  anySide: boolean,
): FloorKind | null {
  // Walls only take floor from their own side: the outer half of an outside wall stays empty.
  const sides = [
    [dx, 0],
    [0, dy],
    [dx, dy],
  ];
  if (anySide) sides.push([-dx, 0], [0, -dy], [-dx, -dy]);
  for (const [ax, ay] of sides) {
    const k = tileAt(map, x + ax, y + ay);
    if (plan.isFloor(x + ax, y + ay) && k !== "door") return k;
  }
  return null;
}

const LOW_KINDS = new Set<MapObject["kind"]>([
  "chair",
  "plant",
  "lamp",
  "speaker",
  "camera",
  "softbox",
  "beanbag",
  "cooler",
  "palm",
  "parasol",
]);

function contactShadows(ctx: CanvasRenderingContext2D, map: MapData) {
  ctx.save();
  ctx.shadowColor = "rgba(30,20,10,0.55)";
  ctx.shadowBlur = 14;
  for (const o of map.objects) {
    if (o.kind === "rug" || o.kind === "pergola") continue;
    const round = LOW_KINDS.has(o.kind);
    ctx.fillStyle = round ? "rgba(30,20,10,0.20)" : "rgba(30,20,10,0.24)";
    ctx.beginPath();
    if (round) {
      const r = Math.min(o.w, o.h) * P * 0.32;
      ctx.ellipse((o.x + o.w / 2) * P, (o.y + o.h / 2) * P, r, r * 0.9, 0, 0, Math.PI * 2);
    } else ctx.roundRect(o.x * P + 4, o.y * P + 4, o.w * P - 8, o.h * P - 8, 6);
    ctx.fill();
  }
  ctx.restore();
}

function wallShadows(ctx: CanvasRenderingContext2D, plan: WallPlan) {
  const t = P * WALL_SHARE;
  ctx.save();
  ctx.shadowBlur = 12;
  for (const c of plan.cells) {
    const glass = c.style !== "wall";
    ctx.shadowColor = glass ? "rgba(30,20,10,0.25)" : "rgba(30,20,10,0.6)";
    ctx.fillStyle = glass ? "rgba(30,20,10,0.12)" : "rgba(30,20,10,0.35)";
    const cx = (c.x + 0.5) * P,
      cy = (c.y + 0.5) * P;
    ctx.fillRect(cx - t / 2, cy - t / 2, t, t);
    if (c.arms.n) ctx.fillRect(cx - t / 2, c.y * P, t, P / 2);
    if (c.arms.s) ctx.fillRect(cx - t / 2, cy, t, P / 2);
    if (c.arms.w) ctx.fillRect(c.x * P, cy - t / 2, P / 2, t);
    if (c.arms.e) ctx.fillRect(cx, cy - t / 2, P / 2, t);
  }
  ctx.restore();
}

function rug(ctx: CanvasRenderingContext2D, o: MapObject, colors: RoomPalette["rugs"][number], i: number) {
  const x = o.x * P + 5,
    y = o.y * P + 5,
    w = o.w * P - 10,
    h = o.h * P - 10;
  ctx.save();
  ctx.shadowColor = "rgba(30,20,10,0.25)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = colors.base;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x + 9, y + 9, w - 18, h - 18, 6);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 14, y + 14, w - 28, h - 28);
  ctx.clip();
  ctx.fillStyle = colors.pattern;
  if (i % 2 === 0) {
    // Diamond band through the middle of the long side.
    const horizontal = w >= h;
    const n = Math.max(2, Math.floor((horizontal ? w : h) / 34));
    for (let k = 0; k < n; k++) {
      const cx = horizontal ? x + ((k + 0.5) * w) / n : x + w / 2,
        cy = horizontal ? y + h / 2 : y + ((k + 0.5) * h) / n;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(cx + 9, cy);
      ctx.lineTo(cx, cy + 9);
      ctx.lineTo(cx - 9, cy);
      ctx.fill();
    }
  } else {
    for (let s = x + 20; s < x + w; s += 22) ctx.fillRect(s, y, 7, h);
  }
  ctx.restore();
}

export function paintFloor(map: MapData, plan: WallPlan, palette: RoomPalette): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = map.width * P;
  c.height = map.height * P;
  const ctx = c.getContext("2d")!;
  for (let ty = 0; ty < map.height; ty++)
    for (let tx = 0; tx < map.width; tx++) {
      const k = tileAt(map, tx, ty);
      if (plan.isFloor(tx, ty) && k !== "door") {
        floorTile(ctx, k, tx, ty);
        continue;
      }
      if (k === "wall" && plan.isVoid(tx, ty)) continue;
      // Walls and doors: each quarter of the tile continues the floor on its side.
      for (const [qx, qy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const kind = floorNear(map, plan, tx, ty, qx ? 1 : -1, qy ? 1 : -1, k === "door");
        if (!kind) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect(tx * P + (qx * P) / 2, ty * P + (qy * P) / 2, P / 2, P / 2);
        ctx.clip();
        floorTile(ctx, kind, tx, ty);
        ctx.restore();
      }
      if (k === "door") {
        // Threshold strip along the wall line the door sits in.
        const t = P * WALL_SHARE;
        const across =
          !plan.isFloor(tx - 1, ty) ||
          !plan.isFloor(tx + 1, ty) ||
          tileAt(map, tx - 1, ty) === "door" ||
          tileAt(map, tx + 1, ty) === "door";
        ctx.fillStyle = "rgba(96,72,48,0.55)";
        if (across) ctx.fillRect(tx * P, (ty + 0.5) * P - t / 2, P, t);
        else ctx.fillRect((tx + 0.5) * P - t / 2, ty * P, t, P);
      }
    }
  wallShadows(ctx, plan);
  let n = 0;
  for (const o of map.objects) if (o.kind === "rug") rug(ctx, o, palette.rugs[n % palette.rugs.length], n++);
  contactShadows(ctx, map);
  return c;
}
