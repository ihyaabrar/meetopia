import { z } from "zod";
import {
  AMBIENCES,
  FURNITURE_STYLES,
  ROOM_SIZES,
  buildWalkable,
  tileAt,
  type MapData,
  type MapObject,
} from "./map";
import { canSitAt, seatPose } from "./seats";

export const OBJECT_KINDS = [
  "desk",
  "chair",
  "plant",
  "sofa",
  "whiteboard",
  "noticeboard",
  "vending",
  "coffee",
  "table",
  "bookshelf",
  "welcome",
  "rug",
  "lamp",
  "tv",
  "beanbag",
  "cooler",
  "art",
  "speaker",
  "bed",
  "counter",
  "fridge",
  "arcade",
  "gamingDesk",
  "cabinet",
  "printer",
  "palm",
  "parasol",
  "pergola",
  "camera",
  "softbox",
  "greenscreen",
  "bbq",
  "firepit",
  "foosball",
  "bath",
  "sink",
] as const;
export const appearanceSchema = z.object({
  ambience: z.enum(AMBIENCES),
  furnitureStyle: z.enum(FURNITURE_STYLES),
  roomSize: z.enum(ROOM_SIZES),
});
export const objectSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(OBJECT_KINDS),
  x: z.number().int().min(0).max(120),
  y: z.number().int().min(0).max(120),
  w: z.number().int().min(1).max(20),
  h: z.number().int().min(1).max(20),
  solid: z.boolean(),
  facing: z.enum(["up", "down", "left", "right"]).optional(),
  label: z.string().max(100).optional(),
  actions: z
    .array(
      z.enum([
        "sit",
        "openSharedNotes",
        "openPrivateNotes",
        "showTips",
        "buy",
        "brew",
        "read",
        "drink",
        "watch",
        "music",
        "cook",
        "play",
      ]),
    )
    .max(6)
    .optional(),
  audio: z
    .object({
      fullVolumeRadius: z.number().min(0).max(10),
      radius: z.number().min(2).max(20),
      curve: z.number().min(0.3).max(4),
    })
    .optional(),
});
export const mapEditSchema = z.object({
  appearance: appearanceSchema.optional(),
  objects: z.array(objectSchema).max(300).optional(),
  expectedVersion: z.number().int().positive(),
});

/** Mengembalikan kunci terjemahan (`editor.err.*`) bila penempatan tidak valid. */
export function objectPlacementError(map: MapData, obj: MapObject): string | null {
  if (obj.x + obj.w > map.width || obj.y + obj.h > map.height) return "editor.err.outside";
  for (let y = obj.y; y < obj.y + obj.h; y++)
    for (let x = obj.x; x < obj.x + obj.w; x++)
      if (tileAt(map, x, y) === "wall" || tileAt(map, x, y) === "door") return "editor.err.wall";
  if (
    (obj.solid || obj.actions?.includes("sit")) &&
    map.objects.some(
      (other) =>
        other.id !== obj.id &&
        (other.solid || other.actions?.includes("sit")) &&
        obj.x < other.x + other.w &&
        obj.x + obj.w > other.x &&
        obj.y < other.y + other.h &&
        obj.y + obj.h > other.y,
    )
  )
    return "editor.err.overlap";
  return null;
}

/** BFS ensures edited furniture cannot seal a corridor or isolate a room/seat. */
export function layoutError(map: MapData): string | null {
  const ids = new Set<string>();
  const walkable = buildWalkable(map);
  const start = { x: Math.floor(map.spawn.x), y: Math.floor(map.spawn.y) };
  if (!walkable[start.y]?.[start.x]) return "editor.err.entrance";
  const visited = new Set([`${start.x},${start.y}`]),
    queue = [start];
  for (let i = 0; i < queue.length; i++)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = queue[i].x + dx,
        y = queue[i].y + dy,
        key = `${x},${y}`;
      if (walkable[y]?.[x] && !visited.has(key)) {
        visited.add(key);
        queue.push({ x, y });
      }
    }
  for (const obj of map.objects) {
    if (ids.has(obj.id)) return "editor.err.duplicate";
    ids.add(obj.id);
    if (obj.actions?.includes("sit")) {
      const slots = obj.kind === "sofa" ? Math.max(1, Math.floor(obj.w / 1.4)) : 1;
      for (let slot = 0; slot < slots; slot++) {
        const p = seatPose(map, obj, slot);
        if (!canSitAt(map, obj, p.x, p.y, slot) || !visited.has(`${Math.floor(p.x)},${Math.floor(p.y)}`))
          return "editor.err.seatUnreachable";
      }
    }
  }
  for (const zone of map.zones)
    if (!queue.some((p) => p.x >= zone.x && p.x < zone.x + zone.w && p.y >= zone.y && p.y < zone.y + zone.h))
      return "editor.err.roomBlocked";
  return null;
}

/** Re-space the whole authored plan; preserve wall/door topology and seat orientation. */
export function resizeMap(map: MapData, size: "small" | "medium" | "large"): MapData {
  const factor = size === "small" ? 0.88 : size === "large" ? 1.22 : 1;
  const px = (v: number) => Math.round(v * factor),
    py = (v: number) => Math.round(v * factor);
  const width = px(map.width),
    height = py(map.height);
  const grid = Array.from({ length: height }, () => Array<string>(width).fill("#"));
  // Floor first, walls second and traversable doors last. Every doorway retains at least one tile.
  for (const phase of [0, 1, 2])
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const char = map.tiles[y][x];
        if ((char === "#" ? 1 : char === "d" ? 2 : 0) !== phase) continue;
        for (let yy = py(y); yy < Math.max(py(y + 1), py(y) + 1) && yy < height; yy++)
          for (let xx = px(x); xx < Math.max(px(x + 1), px(x) + 1) && xx < width; xx++) grid[yy][xx] = char;
      }
  const result: MapData = {
    ...map,
    width,
    height,
    tiles: grid.map((row) => row.join("")),
    zones: map.zones.map((z) => ({
      ...z,
      x: px(z.x),
      y: py(z.y),
      w: Math.max(1, px(z.x + z.w) - px(z.x)),
      h: Math.max(1, py(z.y + z.h) - py(z.y)),
    })),
    spawn: { x: px(map.spawn.x), y: py(map.spawn.y) },
    objects: [],
  };
  // Keep tiny props/chairs readable; first place blocking furniture, then seats and rugs.
  const objects = [...map.objects].sort((a, b) => Number(b.solid) - Number(a.solid));
  for (const obj of objects) {
    const transformed = {
      ...obj,
      x: px(obj.x),
      y: py(obj.y),
      w: Math.max(1, px(obj.x + obj.w) - px(obj.x)),
      h: Math.max(1, py(obj.y + obj.h) - py(obj.y)),
      ...(obj.actions?.includes("sit") ? { facing: seatPose(map, obj).dir } : {}),
    };
    let placed = false;
    for (let radius = 0; radius <= 5 && !placed; radius++)
      for (let dy = -radius; dy <= radius && !placed; dy++)
        for (let dx = -radius; dx <= radius && !placed; dx++) {
          const candidate = { ...transformed, x: transformed.x + dx, y: transformed.y + dy };
          if (candidate.x < 0 || candidate.y < 0 || objectPlacementError(result, candidate)) continue;
          if (candidate.actions?.includes("sit")) {
            const p = seatPose(result, candidate);
            if (!canSitAt(result, candidate, p.x, p.y)) continue;
          }
          result.objects.push(candidate);
          placed = true;
        }
    if (!placed) throw new Error(`No room for ${obj.kind}`);
  }
  const error = layoutError(result);
  if (error) throw new Error(error);
  return result;
}
