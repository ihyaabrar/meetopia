import { TILE, type MapData, type MapObject } from "@/shared/map";
import { seatPose } from "@/shared/seats";
import { SEATED_PELVIS_OFFSET } from "@/shared/avatar-metrics";
import {
  workstationFacing,
  workstationSeat,
  WORKSTATION_DIRECTIONS,
  type WorkstationDirection,
} from "@/shared/workstation";

type Region = readonly [number, number, number, number];
type Kit = {
  desk: HTMLCanvasElement;
  chair: HTMLCanvasElement;
  monitor: HTMLCanvasElement;
  keyboard: HTMLCanvasElement;
};
type Rect = { x: number; y: number; w: number; h: number };
const kits: Partial<Record<WorkstationDirection, Kit>> = {};
let request: Promise<boolean> | undefined;
// Normalized inspected atlas REGIONS, not equal quadrants. Retain original alpha; crop only at decode.
const REGIONS: Record<WorkstationDirection, readonly Region[]> = {
  up: [
    [0.015, 0.22, 0.565, 0.235],
    [0.585, 0.1, 0.385, 0.475],
    [0.035, 0.63, 0.45, 0.3],
    [0.485, 0.7, 0.49, 0.235],
  ],
  down: [
    [0.015, 0.22, 0.57, 0.235],
    [0.585, 0.1, 0.385, 0.48],
    [0.035, 0.63, 0.45, 0.3],
    [0.485, 0.7, 0.49, 0.235],
  ],
  right: [
    [0.19, 0.015, 0.245, 0.515],
    [0.575, 0.015, 0.385, 0.525],
    [0.2, 0.54, 0.195, 0.4],
    [0.64, 0.53, 0.2, 0.425],
  ],
  left: [
    [0.18, 0.015, 0.25, 0.515],
    [0.535, 0.015, 0.365, 0.525],
    [0.19, 0.54, 0.2, 0.4],
    [0.63, 0.53, 0.2, 0.425],
  ],
};
/** Measured contact points in tightly cropped chair sprites. No PNG mirroring, incl. left/right. */
const CHAIR_SEAT = { up: [0.5, 0.62], down: [0.5, 0.58], right: [0.61, 0.59], left: [0.39, 0.59] } as const;
export const WORKSTATION_CAMERA = {
  projection: "orthographic",
  elevationTarget: 45,
  yaw: 0,
  light: "screen-upper-left",
  status: "illustrated prototype; not a measured 3D projection",
} as const;

function decode(img: HTMLImageElement, region: Region) {
  const sx = Math.round(region[0] * img.width),
    sy = Math.round(region[1] * img.height);
  const w = Math.round(region[2] * img.width),
    h = Math.round(region[3] * img.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h).data;
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (pixels[(y * w + x) * 4 + 3] > 24) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) throw Error("Empty workstation component");
  const crop = document.createElement("canvas");
  crop.width = x1 - x0 + 1;
  crop.height = y1 - y0 + 1;
  crop.getContext("2d")!.drawImage(canvas, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return crop;
}
export function loadWorkstationAssets(): Promise<boolean> {
  if (WORKSTATION_DIRECTIONS.every((dir) => kits[dir])) return Promise.resolve(true);
  if (request) return request;
  request = Promise.all(
    WORKSTATION_DIRECTIONS.map(
      (dir) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            try {
              const [desk, chair, monitor, keyboard] = REGIONS[dir].map((region) => decode(img, region));
              kits[dir] = { desk, chair, monitor, keyboard };
              resolve();
            } catch (e) {
              reject(e);
            }
          };
          img.onerror = () => reject(Error(`Missing workstation ${dir}`));
          img.src = `/environment/workstation-${dir}-v2.webp`;
        }),
    ),
  )
    .then(() => true)
    .catch(() => {
      request = undefined;
      return false;
    });
  return request;
}
export function workstationReady() {
  return WORKSTATION_DIRECTIONS.every((dir) => kits[dir]);
}
function fit(sprite: HTMLCanvasElement, width: number, cx: number, bottom: number): Rect {
  const h = (width * sprite.height) / sprite.width;
  return { x: cx - width / 2, y: bottom - h, w: width, h };
}
function union(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x)),
    y = Math.min(...rects.map((r) => r.y));
  return {
    x,
    y,
    w: Math.max(...rects.map((r) => r.x + r.w)) - x,
    h: Math.max(...rects.map((r) => r.y + r.h)) - y,
  };
}
export function workstationLayout(o: MapObject, map?: MapData) {
  const dir = workstationFacing(map, o),
    kit = kits[dir];
  if (!kit || !["desk", "chair"].includes(o.kind)) return null;
  if (o.kind === "chair") {
    const p = map ? seatPose(map, o) : { x: o.x + o.w / 2, y: o.y + Math.min(o.h * 0.6, 0.6) };
    const width = 38,
      height = (width * kit.chair.height) / kit.chair.width,
      anchor = CHAIR_SEAT[dir];
    // Current painted rig's pelvis = root + FOOT(8) - (3 + seatedLeg(4)) * mapScale(1.5).
    const contact = { x: p.x * TILE, y: p.y * TILE + SEATED_PELVIS_OFFSET };
    const chair = {
      x: contact.x - anchor[0] * width,
      y: contact.y - anchor[1] * height,
      w: width,
      h: height,
    };
    return { dir, kit, chair, contact, bounds: chair };
  }
  const sideways = dir === "left" || dir === "right";
  // Legacy custom layouts may store a sideways gaze with a horizontal footprint. Keep their
  // fallback instead of stretching a profile into the wrong geometry or mutating saved layouts.
  if (o.w !== o.h && sideways !== o.h > o.w) return null;
  const desk = fit(kit.desk, o.w * TILE + (sideways ? 12 : 0), (o.x + o.w / 2) * TILE, (o.y + o.h) * TILE);
  const seat = map ? workstationSeat(map, o) : undefined;
  const center =
    seat && map
      ? seatPose(map, seat)
      : { x: o.x + o.w * (dir === "down" ? 0.625 : 0.375), y: o.y + o.h * (dir === "left" ? 0.625 : 0.375) };
  const operator = sideways ? center.y * TILE : center.x * TILE;
  const monitorWidth = sideways ? 14 : 42,
    keyboardWidth = sideways ? 9 : 28;
  const monitor = sideways
    ? fit(kit.monitor, monitorWidth, (o.x + o.w * (dir === "right" ? 0.7 : 0.3)) * TILE, operator - 23)
    : fit(kit.monitor, monitorWidth, operator, desk.y + desk.h * (dir === "up" ? 0.13 : 0.35));
  const keyboard = sideways
    ? fit(kit.keyboard, keyboardWidth, (o.x + o.w * (dir === "right" ? 0.23 : 0.77)) * TILE, operator + 2)
    : fit(kit.keyboard, keyboardWidth, operator, desk.y + desk.h * (dir === "up" ? 0.36 : 0.13));
  return { dir, kit, desk, monitor, keyboard, bounds: union([desk, monitor, keyboard]) };
}
export function drawWorkstation(
  ctx: CanvasRenderingContext2D,
  o: MapObject,
  map?: MapData,
  foreground = false,
) {
  const layout = workstationLayout(o, map);
  if (!layout) return false;
  ctx.save();
  if (layout.chair) {
    if (foreground) {
      if (layout.dir !== "up") {
        ctx.restore();
        return true;
      }
      const r = layout.chair;
      // Author-calibrated rear shell polygon, excluding arms, wheelbase and head area.
      const polygon = [
        [0.22, 0.155],
        [0.78, 0.155],
        [0.9, 0.3],
        [0.84, 0.62],
        [0.16, 0.62],
        [0.1, 0.3],
      ];
      ctx.beginPath();
      polygon.forEach(([x, y], i) =>
        i ? ctx.lineTo(r.x + x * r.w, r.y + y * r.h) : ctx.moveTo(r.x + x * r.w, r.y + y * r.h),
      );
      ctx.closePath();
      ctx.clip();
    }
    const r = layout.chair;
    ctx.drawImage(layout.kit.chair, r.x, r.y, r.w, r.h);
  } else if (!foreground) {
    const order =
      layout.dir === "down"
        ? (["desk", "keyboard", "monitor"] as const)
        : (["desk", "monitor", "keyboard"] as const);
    for (const part of order) {
      const r = layout[part]!;
      ctx.drawImage(layout.kit[part], r.x, r.y, r.w, r.h);
    }
  }
  ctx.restore();
  return true;
}

/** Actual keyboard contact coordinates; mouth/neck/clothing anchors remain avatar-owned. */
export function workstationHandTargets(surface: MapObject, map: MapData) {
  const layout = workstationLayout(surface, map);
  if (!layout?.keyboard) return null;
  const r = layout.keyboard;
  const points = {
    up: [
      [0.22, 0.56],
      [0.55, 0.56],
    ],
    down: [
      [0.75, 0.56],
      [0.42, 0.56],
    ],
    right: [
      [0.4, 0.27],
      [0.4, 0.53],
    ],
    left: [
      [0.6, 0.73],
      [0.6, 0.47],
    ],
  }[layout.dir];
  return {
    left: [r.x + points[0][0] * r.w, r.y + points[0][1] * r.h] as const,
    right: [r.x + points[1][0] * r.w, r.y + points[1][1] * r.h] as const,
  };
}
