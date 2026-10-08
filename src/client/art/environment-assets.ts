import { TILE, type FloorKind, type MapObject } from "@/shared/map";
import { seatPose } from "@/shared/seats";
import type { MapData } from "@/shared/map";
import { drawWorkstation, loadWorkstationAssets, workstationLayout } from "./workstation-assets";

/** Runtime atlas decoding only. Source PNGs stay unchanged and preserve their original alpha. */
const atlases: HTMLCanvasElement[][] = [];
const atlasRequests = new Map<number, Promise<HTMLCanvasElement[]>>();
const pending: Partial<Record<"world" | "props", Promise<boolean>>> = {};
const URLS = [
  "furniture-core-v1",
  "furniture-decor-v1",
  "avatar-props-v1",
  "floor-textures-v1",
  "furniture-extra-v1",
];
export function loadEnvironmentAssets(scope: "world" | "props" = "world"): Promise<boolean> {
  const indexes = scope === "props" ? [2] : [0, 1, 2, 3, 4];
  if (indexes.every((i) => atlases[i]))
    return scope === "world" ? loadWorkstationAssets() : Promise.resolve(true);
  if (pending[scope]) return pending[scope]!;
  pending[scope] = Promise.all(
    indexes.map((atlas) => {
      const existing = atlasRequests.get(atlas);
      if (existing) return existing;
      const request = new Promise<HTMLCanvasElement[]>((resolve, reject) => {
        const name = URLS[atlas];
        if (atlases[atlas]) {
          resolve(atlases[atlas]);
          return;
        }
        const img = new Image();
        img.onload = () => {
          const columns = 4,
            rows = atlas === 3 ? 2 : 4;
          // Generated sheets have unequal vertical gutters. Use inspected row boundaries instead of
          // assuming exact mathematical cells (which would cut chair feet and laptop bases).
          const rowEdges =
            atlas === 0
              ? [0, 0.311, 0.559, 0.761, 1]
              : atlas === 1
                ? [0, 0.262, 0.508, 0.754, 1]
                : atlas === 2
                  ? [0, 0.287, 0.533, 0.764, 1]
                  : atlas === 3
                    ? [0, 0.5, 1]
                    : [0, 0.279, 0.53, 0.762, 1];
          const cells: HTMLCanvasElement[] = [];
          for (let i = 0; i < columns * rows; i++) {
            const row = Math.floor(i / columns),
              col = i % columns;
            const colEdges =
              atlas === 0 && row === 2
                ? [0, 0.289, 0.558, 0.763, 1]
                : atlas === 0 && row === 3
                  ? [0, 0.242, 0.482, 0.71, 1]
                  : [0, 0.25, 0.5, 0.75, 1];
            const sx = Math.round(colEdges[col] * img.width),
              sy = Math.round(rowEdges[row] * img.height);
            const w = Math.round(colEdges[col + 1] * img.width) - sx,
              h = Math.round(rowEdges[row + 1] * img.height) - sy;
            const cell = document.createElement("canvas");
            cell.width = w;
            cell.height = h;
            const ctx = cell.getContext("2d")!;
            ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
            if (atlas !== 3) {
              const data = ctx.getImageData(0, 0, w, h).data;
              let x0 = w,
                y0 = h,
                x1 = -1,
                y1 = -1;
              for (let y = 0; y < h; y++)
                for (let x = 0; x < w; x++)
                  if (data[(y * w + x) * 4 + 3] > 24) {
                    x0 = Math.min(x0, x);
                    y0 = Math.min(y0, y);
                    x1 = Math.max(x1, x);
                    y1 = Math.max(y1, y);
                  }
              if (x1 >= x0) {
                const cropped = document.createElement("canvas");
                cropped.width = x1 - x0 + 1;
                cropped.height = y1 - y0 + 1;
                cropped
                  .getContext("2d")!
                  .drawImage(
                    cell,
                    x0,
                    y0,
                    cropped.width,
                    cropped.height,
                    0,
                    0,
                    cropped.width,
                    cropped.height,
                  );
                cells.push(cropped);
                continue;
              }
            }
            cells.push(cell);
          }
          resolve(cells);
        };
        img.onerror = () => reject(new Error(`Missing environment atlas: ${name}`));
        img.src = `/environment/${name}.webp`;
      });
      atlasRequests.set(atlas, request);
      void request.catch(() => atlasRequests.delete(atlas));
      return request;
    }),
  )
    .then(async (result) => {
      result.forEach((cells, i) => {
        atlases[indexes[i]] = cells;
      });
      if (scope === "world") await loadWorkstationAssets();
      return true;
    })
    .catch(() => {
      delete pending[scope];
      return false;
    });
  return pending[scope]!;
}

const CORE: Partial<Record<MapObject["kind"], number>> = {
  desk: 5,
  gamingDesk: 6,
  table: 7,
  sofa: 8,
  beanbag: 10,
  welcome: 13,
  bed: 14,
  counter: 15,
};
const DECOR: Partial<Record<MapObject["kind"], number>> = {
  plant: 0,
  palm: 1,
  lamp: 2,
  bookshelf: 3,
  whiteboard: 4,
  noticeboard: 4,
  tv: 5,
  coffee: 6,
  cooler: 7,
  fridge: 8,
  arcade: 9,
  speaker: 10,
  cabinet: 11,
  camera: 12,
  softbox: 13,
  greenscreen: 14,
  bbq: 15,
};
const EXTRA: Partial<Record<MapObject["kind"], number>> = {
  vending: 0,
  printer: 1,
  sink: 2,
  bath: 3,
  foosball: 4,
  firepit: 5,
  parasol: 6,
  pergola: 7,
  art: 8,
};
export function furnitureRect(o: MapObject, map?: MapData) {
  const master = workstationLayout(o, map);
  if (master) return master.bounds;
  const w = o.w * TILE;
  // Chair seat is at y + .45 tiles, consistent with seatPose's seated hip anchor.
  const height =
    o.kind === "chair"
      ? 44
      : o.kind === "sofa"
        ? Math.max(48, w * 0.52)
        : ["table", "desk", "gamingDesk", "welcome", "counter"].includes(o.kind)
          ? o.h * TILE + 30
          : ["bed", "beanbag"].includes(o.kind)
            ? o.h * TILE + 8
            : o.h * TILE + 42;
  return { x: o.x * TILE, y: (o.y + o.h) * TILE - height, w, h: height };
}
/** Select the foremost rendered object, not an invisible rectangle baked into a wallpaper. */
let hitCanvas: HTMLCanvasElement | null = null;
const hitOrder = new WeakMap<MapData, MapObject[]>();
export function furnitureAt(map: MapData, x: number, y: number): MapObject | null {
  let ordered = hitOrder.get(map);
  if (!ordered) {
    ordered = [...map.objects]
      .filter((o) => o.label && o.actions?.length)
      .sort((a, b) => b.y + b.h - (a.y + a.h));
    hitOrder.set(map, ordered);
  }
  for (const o of ordered) {
    const r = furnitureRect(o, map);
    if (x < r.x || x >= r.x + r.w || y < r.y || y >= r.y + r.h) continue;
    // Transparent parts above a chair/desk should not steal clicks from a neighboring object.
    if (!hitCanvas) {
      hitCanvas = document.createElement("canvas");
      hitCanvas.width = hitCanvas.height = 1;
    }
    const ctx = hitCanvas.getContext("2d", { willReadFrequently: true })!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 1, 1);
    ctx.translate(-x, -y);
    if (!drawFurniture(ctx, o, map)) return o;
    if (ctx.getImageData(0, 0, 1, 1).data[3] > 40) return o;
  }
  return null;
}
export function drawFurniture(
  ctx: CanvasRenderingContext2D,
  o: MapObject,
  map?: MapData,
  foreground = false,
) {
  if (drawWorkstation(ctx, o, map, foreground)) return true;
  if (!atlases[0]) return false;
  const facing = map ? seatPose(map, o).dir : (o.facing ?? "up");
  const index =
    o.kind === "chair"
      ? { down: 0, up: 1, left: 2, right: 3 }[facing]
      : o.kind === "sofa" && facing === "up"
        ? 9
        : CORE[o.kind];
  let sprite =
    index !== undefined
      ? atlases[0]?.[index]
      : DECOR[o.kind] !== undefined
        ? atlases[1]?.[DECOR[o.kind]!]
        : atlases[4]?.[EXTRA[o.kind] ?? -1];
  if (o.kind === "chair" && facing === "left") sprite = atlases[4]?.[15];
  if (o.kind === "sofa" && (facing === "left" || facing === "right"))
    sprite = atlases[4]?.[facing === "left" ? 11 : 12];
  if (o.kind === "table" && (facing === "left" || facing === "right")) sprite = atlases[4]?.[13];
  if (o.kind === "desk" && (facing === "left" || facing === "right")) sprite = atlases[4]?.[14];
  if (!sprite) return false;
  const r = furnitureRect(o);
  ctx.save();
  const style = map?.appearance?.furnitureStyle;
  if (style === "modern") ctx.filter = "saturate(.8) brightness(1.07)";
  if (style === "industrial") ctx.filter = "saturate(.5) contrast(1.12)";
  if (style === "tropical") ctx.filter = "saturate(1.22)";
  if (foreground) {
    // Only the rear chair back is in front of a seated person; never overpaint their head or feet.
    if (o.kind !== "chair" || facing !== "up") {
      ctx.restore();
      return true;
    }
    ctx.beginPath();
    ctx.rect(r.x, r.y + r.h * 0.06, r.w, r.h * 0.53);
    ctx.clip();
  }
  if ((o.kind === "table" || o.kind === "desk") && facing === "right") {
    ctx.translate(r.x + r.w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, 0, r.y, r.w, r.h);
  } else ctx.drawImage(sprite, r.x, r.y, r.w, r.h);
  ctx.restore();
  return true;
}

const FLOOR: Partial<Record<FloorKind, number>> = {
  work: 0,
  lobby: 1,
  kitchen: 1,
  home: 0,
  lounge: 2,
  bedroom: 2,
  gaming: 3,
  studio: 4,
  rooftop: 5,
  garden: 6,
  meeting: 7,
};
export function drawFloorTexture(ctx: CanvasRenderingContext2D, kind: FloorKind, tx: number, ty: number) {
  const sprite = atlases[3]?.[FLOOR[kind] ?? -1];
  if (!sprite) return false;
  const repeat = 4;
  ctx.drawImage(
    sprite,
    ((tx % repeat) * sprite.width) / repeat,
    ((ty % repeat) * sprite.height) / repeat,
    sprite.width / repeat,
    sprite.height / repeat,
    tx * TILE,
    ty * TILE,
    TILE,
    TILE,
  );
  return true;
}

const PROPS: Record<string, number> = {
  laptop: 1,
  book: 2,
  pen: 3,
  phone: 4,
  coffee: 5,
  bottle: 6,
  burger: 7,
  board: 11,
};
export function drawHeldProp(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  width: number,
  back = false,
) {
  const sprite = atlases[2]?.[name === "laptop" && back ? 0 : PROPS[name]];
  if (!sprite) return false;
  const height = Math.min(name === "board" ? 22 : 12, (width * sprite.height) / sprite.width);
  ctx.drawImage(sprite, x - width / 2, y - height / 2, width, height);
  return true;
}
