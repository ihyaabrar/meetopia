/**
 * Lapisan statis peta: lantai bertekstur per area, dinding 3/4 dengan jendela, cahaya jendela,
 * bayangan kontak, dan perabot rendah. Perabot tinggi dikembalikan sebagai sprite agar bisa
 * diurutkan kedalamannya bersama avatar (avatar bisa lewat di belakang tanaman/rak).
 */
import { TILE, tileAt, type FloorKind, type MapData, type MapObject } from "@/shared/map";
import { C, hash } from "./common";
import { drawObject, isTall, SPRITE_PAD_TOP, SPRITE_PAD_X } from "./objects";
import { illustrationFor, loadIllustration } from "./illustrated";
import { ICON_PATHS } from "@/shared/icons";
import { zoneIcon } from "@/shared/zone-icons";

export interface Sprite {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  /** Koordinat-y dasar (px dunia) untuk pengurutan kedalaman. */
  sortY: number;
  obj: MapObject;
}

export interface Light {
  x: number;
  y: number;
  r: number;
  color: string;
}

export interface WorldLayers {
  floor: HTMLCanvasElement;
  labels: HTMLCanvasElement;
  sprites: Sprite[];
  lights: Light[];
  illustrated: boolean;
  /** Resolves when final local environment art has replaced the native fallback. */
  ready: Promise<void>;
}

const T = TILE;
const WALL_CAP = 10;

const isFloor = (k: FloorKind) => k !== "wall";

function floorKindAt(map: MapData, x: number, y: number): FloorKind {
  const k = tileAt(map, x, y);
  if (k !== "door") return k;
  // Pintu memakai lantai area tetangga
  for (const [dx, dy] of [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ]) {
    const n = tileAt(map, x + dx, y + dy);
    if (n !== "wall" && n !== "door") return n;
  }
  return "lobby";
}

function drawPlanks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  base: [number, number, number],
  seam: string,
  tx: number,
  ty: number,
) {
  const rows = 4;
  const ph = T / rows;
  for (let r = 0; r < rows; r++) {
    const v = hash(tx, ty * rows + r) * 0.08 - 0.04;
    const [h, s, l] = base;
    ctx.fillStyle = `hsl(${h} ${s}% ${l + v * 100}%)`;
    ctx.fillRect(x, y + r * ph, T, ph);
    // sambungan ujung papan, berselang-seling per baris (panjang papan 64px)
    const off = Math.floor(hash(ty * rows + r, 7) * 8) * 8;
    const seamX = 64 - ((tx * T + off) % 64);
    if (seamX < T) {
      ctx.fillStyle = seam;
      ctx.fillRect(x + seamX, y + r * ph, 1, ph);
    }
    ctx.fillStyle = seam;
    ctx.fillRect(x, y + r * ph + ph - 1, T, 1);
    // serat kayu
    ctx.fillStyle = "rgba(120,80,40,0.06)";
    ctx.fillRect(x + hash(tx, ty, r) * 20, y + r * ph + 3, 8 + hash(r, tx) * 10, 1);
  }
}

function drawFloorTile(ctx: CanvasRenderingContext2D, kind: FloorKind, tx: number, ty: number) {
  const x = tx * T;
  const y = ty * T;
  switch (kind) {
    case "work":
      drawPlanks(ctx, x, y, [33, 50, 72], "rgba(120,80,45,0.26)", tx, ty);
      break;
    case "lounge":
      drawPlanks(ctx, x, y, [26, 44, 64], "rgba(100,62,35,0.28)", tx, ty);
      break;
    case "home":
      drawPlanks(ctx, x, y, [34, 50, 70], "rgba(120,80,45,0.24)", tx, ty);
      break;
    case "kitchen": {
      // ubin catur kecil
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          ctx.fillStyle = (tx * 2 + i + ty * 2 + j) % 2 === 0 ? "#f3ede1" : "#e6dece";
          ctx.fillRect(x + i * 16, y + j * 16, 16, 16);
        }
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(x + 2, y + 2, 5, 1);
      break;
    }
    case "bedroom": {
      ctx.fillStyle = "#cfd5dc";
      ctx.fillRect(x, y, T, T);
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = hash(tx, ty, i) > 0.5 ? "rgba(255,255,255,0.16)" : "rgba(60,70,90,0.07)";
        ctx.fillRect(x + hash(i, tx, ty) * T, y + hash(ty, i, tx) * T, 2, 2);
      }
      break;
    }
    case "garden": {
      const v = hash(tx, ty) * 0.06;
      ctx.fillStyle = `hsl(98 34% ${58 - v * 100}%)`;
      ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = "rgba(60,110,50,0.35)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const gx = x + hash(tx, ty, i) * T;
        const gy = y + hash(i, tx, ty) * T;
        ctx.beginPath();
        ctx.moveTo(gx, gy + 3);
        ctx.lineTo(gx + 1, gy);
        ctx.stroke();
      }
      if (hash(ty, tx, 9) > 0.93) {
        ctx.fillStyle = hash(tx, 3) > 0.5 ? "#f2c46d" : "#f3f0e6";
        ctx.beginPath();
        ctx.arc(x + 16, y + 16, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "gaming": {
      ctx.fillStyle = "#3a3646";
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(x, y, T, 1);
      ctx.fillRect(x, y, 1, T);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = hash(tx, ty, i) > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
        ctx.fillRect(x + hash(i, tx, ty) * T, y + hash(ty, i, tx) * T, 2, 2);
      }
      if (hash(tx, ty, 7) > 0.96) {
        ctx.fillStyle = hash(ty, tx) > 0.5 ? "rgba(124,196,138,0.5)" : "rgba(169,139,224,0.5)";
        ctx.fillRect(x + 8, y + 8, 3, 3);
      }
      break;
    }
    case "studio": {
      // Epoxy terang dengan tanda potong halus: terasa seperti creative lab, bukan kantor kayu.
      ctx.fillStyle = "#d9d7d1";
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = "rgba(65,72,78,0.08)";
      ctx.fillRect(x, y + T - 1, T, 1);
      if ((tx + ty) % 4 === 0) {
        ctx.fillStyle = "rgba(24,134,74,0.18)";
        ctx.fillRect(x + 4, y + T - 5, 10, 2);
      }
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = hash(tx, ty, i) > 0.5 ? "rgba(255,255,255,0.16)" : "rgba(30,35,40,0.04)";
        ctx.fillRect(x + hash(i, tx, ty) * T, y + hash(ty, i, tx) * T, 2, 2);
      }
      break;
    }
    case "rooftop": {
      drawPlanks(ctx, x, y, [28, 42, 62], "rgba(92,58,39,.25)", tx, ty);
      break;
    }
    case "meeting": {
      ctx.fillStyle = "#c8ccd0";
      ctx.fillRect(x, y, T, T);
      // tekstur karpet
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = hash(tx, ty, i) > 0.5 ? "rgba(255,255,255,0.10)" : "rgba(60,50,40,0.07)";
        ctx.fillRect(x + hash(i, tx, ty) * T, y + hash(ty, i, tx) * T, 2, 2);
      }
      break;
    }
    case "lobby":
    default: {
      // ubin batu besar 2x2
      const v = hash(Math.floor(tx / 2), Math.floor(ty / 2)) * 0.05;
      ctx.fillStyle = `hsl(36 30% ${82 - v * 100}%)`;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      for (let i = 0; i < 4; i++) ctx.fillRect(x + hash(tx, ty, i) * T, y + hash(i, ty, tx) * T, 3, 1);
      ctx.fillStyle = "rgba(120,100,70,0.3)";
      if (tx % 2 === 0) ctx.fillRect(x, y, 1, T);
      if (ty % 2 === 0) ctx.fillRect(x, y, T, 1);
    }
  }
}

function drawWalls(ctx: CanvasRenderingContext2D, map: MapData) {
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      if (tileAt(map, tx, ty) !== "wall") continue;
      const x = tx * T;
      const y = ty * T;
      if (map.template === "rooftop" && (tx >= 48 || ty >= 26)) continue;
      if (map.template === "rooftop" && (tx === 0 || ty === 0 || tx === 47 || ty === 25)) {
        ctx.fillStyle = "#293b36";
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = "#b29a6d";
        ctx.fillRect(x + 2, y + 2, T - 4, 4);
        ctx.fillStyle = "rgba(226,220,183,.28)";
        ctx.fillRect(x + 5, y + 9, 3, T - 12);
        continue;
      }
      const faceBelow = ty + 1 < map.height && isFloor(tileAt(map, tx, ty + 1));
      // Tutup dinding
      ctx.fillStyle = C.wallCap;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = C.wallCapLight;
      if (ty > 0 && tileAt(map, tx, ty - 1) !== "wall") ctx.fillRect(x, y, T, 3);
      if (tileAt(map, tx - 1, ty) !== "wall") ctx.fillRect(x, y, 2, T);
      if (tileAt(map, tx + 1, ty) !== "wall") ctx.fillRect(x + T - 2, y, 2, T);
      if (faceBelow) {
        // Muka dinding (wallpaper + list bawah)
        const fy = y + WALL_CAP;
        const fh = T - WALL_CAP;
        ctx.fillStyle = C.wallFace;
        ctx.fillRect(x, fy, T, fh);
        ctx.fillStyle = C.wallFaceDark;
        for (let i = 0; i < T; i += 8) ctx.fillRect(x + i, fy, 3, fh - 5);
        ctx.fillStyle = C.baseboard;
        ctx.fillRect(x, y + T - 5, T, 5);
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(x, fy, T, 2);
      }
    }
  }
  // Jendela di dinding luar bagian atas
  for (let tx = 2; map.template !== "rooftop" && tx < map.width - 2; tx += 4) {
    if (tileAt(map, tx, 0) !== "wall" || !isFloor(tileAt(map, tx, 1)) || !isFloor(tileAt(map, tx + 1, 1)))
      continue;
    const x = tx * T + 6;
    const y = WALL_CAP - 2;
    const w = T * 2 - 12;
    const h = T - WALL_CAP - 4;
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#e3f4f8");
    g.addColorStop(1, "#9fcfdd");
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - 3, y - 2, w + 6, h + 4);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.moveTo(x + 6, y + h);
    ctx.lineTo(x + 14, y);
    ctx.lineTo(x + 20, y);
    ctx.lineTo(x + 12, y + h);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + w / 2 - 1, y, 2, h);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 3, y - 2, w + 6, h + 4);
  }
}

/** Cahaya matahari dari jendela jatuh ke lantai. */
function drawWindowLight(ctx: CanvasRenderingContext2D, map: MapData) {
  ctx.save();
  for (let tx = 2; tx < map.width - 2; tx += 4) {
    if (tileAt(map, tx, 0) !== "wall" || !isFloor(tileAt(map, tx, 1)) || !isFloor(tileAt(map, tx + 1, 1)))
      continue;
    const x = tx * T + 6;
    const g = ctx.createLinearGradient(0, T, 0, T * 4.5);
    g.addColorStop(0, "rgba(255,250,225,0.35)");
    g.addColorStop(1, "rgba(255,250,225,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, T);
    ctx.lineTo(x + T * 2 - 12, T);
    ctx.lineTo(x + T * 2 + 20, T * 4.5);
    ctx.lineTo(x + 26, T * 4.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Bayangan di lantai tepat di bawah dan di samping dinding (ambient occlusion sederhana). */
function drawWallShadows(ctx: CanvasRenderingContext2D, map: MapData) {
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      if (tileAt(map, tx, ty) === "wall") continue;
      const x = tx * T;
      const y = ty * T;
      if (tileAt(map, tx, ty - 1) === "wall") {
        const g = ctx.createLinearGradient(0, y, 0, y + 12);
        g.addColorStop(0, "rgba(30,24,20,0.22)");
        g.addColorStop(1, "rgba(30,24,20,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, T, 12);
      }
      if (tileAt(map, tx - 1, ty) === "wall") {
        const g = ctx.createLinearGradient(x, 0, x + 8, 0);
        g.addColorStop(0, "rgba(30,24,20,0.16)");
        g.addColorStop(1, "rgba(30,24,20,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, 8, T);
      }
      if (tileAt(map, tx + 1, ty) === "wall") {
        const g = ctx.createLinearGradient(x + T, 0, x + T - 8, 0);
        g.addColorStop(0, "rgba(30,24,20,0.16)");
        g.addColorStop(1, "rgba(30,24,20,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x + T - 8, y, 8, T);
      }
    }
  }
}

const zonePaths = new Map<string, Path2D>();
function drawZoneDecor(ctx: CanvasRenderingContext2D, map: MapData, zoneLabel: (k: string) => string) {
  // Garis tepi karpet ruang rapat dan label area sebagai "stiker lantai"
  for (const z of map.zones) {
    if (z.private) {
      ctx.save();
      ctx.strokeStyle = "rgba(58,54,50,0.25)";
      ctx.lineWidth = 3;
      ctx.strokeRect(z.x * T + 6, z.y * T + 6, z.w * T - 12, z.h * T - 12);
      ctx.restore();
    }
    const label = zoneLabel(z.label);
    ctx.save();
    ctx.font = "600 14px Outfit, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(label).width;
    const px = (z.x + z.w / 2) * T - (tw + 34) / 2;
    const py = (z.y + z.h) * T - 27;
    ctx.fillStyle = "rgba(13,26,32,.90)";
    ctx.beginPath();
    ctx.roundRect(px - 10, py - 16, tw + 54, 32, 9);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.13)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#f2f7f5";
    // Same vector icon system as the frontend, with a meaningful symbol for each area.
    ctx.strokeStyle = z.private ? "#63e9bd" : "#d2e4e0";
    ctx.lineWidth = 1.6;
    const icon = zoneIcon(z.label);
    if (!zonePaths.has(icon)) zonePaths.set(icon, new Path2D(ICON_PATHS[icon]));
    ctx.save();
    ctx.translate(px + 1, py - 7);
    ctx.scale(14 / 24, 14 / 24);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(zonePaths.get(icon)!);
    ctx.restore();
    ctx.fillText(label, px + 23, py + 1);
    ctx.restore();
  }
}

export function makeSprite(o: MapObject): Sprite {
  const c = document.createElement("canvas");
  c.width = o.w * T + SPRITE_PAD_X * 2;
  c.height = o.h * T + SPRITE_PAD_TOP + 8;
  const ctx = c.getContext("2d")!;
  ctx.translate(SPRITE_PAD_X - o.x * T, SPRITE_PAD_TOP - o.y * T);
  drawObject(ctx, o);
  return {
    canvas: c,
    x: o.x * T - SPRITE_PAD_X,
    y: o.y * T - SPRITE_PAD_TOP,
    sortY: (o.y + o.h) * T,
    obj: o,
  };
}

export function renderWorld(
  map: MapData,
  zoneLabel: (key: string) => string,
  options: { illustration?: boolean } = {},
): WorldLayers {
  const c = document.createElement("canvas");
  c.width = map.width * T;
  c.height = map.height * T;
  const ctx = c.getContext("2d")!;
  if (map.template === "rooftop") drawRooftopSky(ctx, c.width, c.height);
  for (let ty = 0; ty < map.height; ty++)
    for (let tx = 0; tx < map.width; tx++) {
      const k = tileAt(map, tx, ty);
      if (k === "wall") continue;
      drawFloorTile(ctx, floorKindAt(map, tx, ty), tx, ty);
      if (k === "door") {
        ctx.fillStyle = "rgba(169,138,99,0.45)";
        ctx.fillRect(tx * T + 2, ty * T + 2, T - 4, T - 4);
      }
    }
  drawWindowLight(ctx, map);
  drawWallShadows(ctx, map);
  drawWalls(ctx, map);

  const sprites: Sprite[] = [];
  const lights: Light[] = [];
  const order = [...map.objects].sort(
    (a, b) => (a.kind === "rug" ? -1 : 0) - (b.kind === "rug" ? -1 : 0) || a.y - b.y,
  );
  for (const o of order) {
    if (isTall(o.kind)) sprites.push(makeSprite(o));
    else drawObject(ctx, o);
    if (o.kind === "lamp") lights.push({ x: (o.x + 0.5) * T, y: o.y * T - 6, r: 110, color: "255,214,140" });
    if (o.kind === "tv") lights.push({ x: (o.x + o.w / 2) * T, y: o.y * T + 4, r: 70, color: "150,210,255" });
    if (o.kind === "arcade")
      lights.push({ x: (o.x + 0.5) * T, y: o.y * T - 12, r: 55, color: "150,140,255" });
    if (o.kind === "gamingDesk")
      lights.push({ x: (o.x + o.w / 2) * T, y: o.y * T, r: 60, color: "140,170,255" });
    if (o.kind === "vending")
      lights.push({ x: (o.x + o.w / 2) * T, y: o.y * T, r: 60, color: "255,170,150" });
  }
  const labels = document.createElement("canvas");
  labels.width = c.width;
  labels.height = c.height;
  drawZoneDecor(labels.getContext("2d")!, map, zoneLabel);
  const layers: WorldLayers = {
    floor: c,
    labels,
    sprites,
    lights,
    illustrated: false,
    ready: Promise.resolve(),
  };
  const asset = options.illustration === false ? null : illustrationFor(map);
  if (asset) {
    layers.ready = loadIllustration(asset).then((image) => {
      if (!image) return;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(image, 0, 0, c.width, c.height);
      // Furniture and warm lighting already exist in the illustration; no double rendering.
      layers.sprites = [];
      layers.lights = [];
      layers.illustrated = true;
    });
  }
  return layers;
}

/** Sunset and distant buildings sit outside the deck, never inside the collision grid. */
function drawRooftopSky(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, "#aa86a9");
  g.addColorStop(0.24, "#edaf8b");
  g.addColorStop(0.62, "#ba8d8e");
  g.addColorStop(1, "#4d596d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  const sunX = width - 91,
    sunY = 70;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 120);
  glow.addColorStop(0, "rgba(255,222,165,.7)");
  glow.addColorStop(1, "rgba(255,222,165,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 120, sunY - 120, 240, 240);
  ctx.fillStyle = "#ffe0a3";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 24, 0, Math.PI * 2);
  ctx.fill();
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 9; i++) {
      const x = 47 * T + i * 28 + layer * 9;
      const top = 170 + layer * 95 + hash(i, layer) * 210;
      const w = 25 + hash(layer, i) * 26;
      ctx.fillStyle = ["#b491a1", "#887b91", "#5f657d"][layer];
      ctx.fillRect(x, top, w, height - top);
      ctx.fillRect(x + 7, top - 7, w - 14, 8);
      ctx.fillStyle = "rgba(255,217,161,.55)";
      for (let yy = top + 14; yy < height; yy += 18)
        for (let xx = x + 5; xx < x + w - 4; xx += 9) if (hash(xx, yy) > 0.4) ctx.fillRect(xx, yy, 3, 6);
    }
  }
}

/** Kompatibilitas: hanya lapisan lantai + semua objek (untuk pratinjau statis). */
export function renderStaticMap(map: MapData, zoneLabel: (key: string) => string): HTMLCanvasElement {
  const w = renderWorld(map, zoneLabel, { illustration: false });
  const ctx = w.floor.getContext("2d")!;
  for (const s of w.sprites) ctx.drawImage(s.canvas, s.x, s.y);
  ctx.drawImage(w.labels, 0, 0);
  return w.floor;
}

/** Auth, gallery and the live room consume identical illustration assets. */
export async function renderIllustratedPreview(
  map: MapData,
  zoneLabel: (key: string) => string,
): Promise<{ canvas: HTMLCanvasElement; illustrated: boolean }> {
  const layers = renderWorld(map, zoneLabel);
  await layers.ready;
  const ctx = layers.floor.getContext("2d")!;
  for (const sprite of layers.sprites) ctx.drawImage(sprite.canvas, sprite.x, sprite.y);
  ctx.drawImage(layers.labels, 0, 0);
  return { canvas: layers.floor, illustrated: layers.illustrated };
}
