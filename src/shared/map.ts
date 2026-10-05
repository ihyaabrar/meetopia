/**
 * Peta template kantor 2D (FR-10, FR-72).
 * Peta disusun sebagai grid tile. Setiap grup mendapat salinan template ini saat dibuat,
 * disimpan di tabel `maps` sebagai JSON sehingga bisa diubah per grup (editor peta: P1).
 */

export const TILE = 32;

export type FloorKind = "lobby" | "work" | "meeting" | "lounge" | "wall" | "door";

export type ObjectKind =
  | "desk"
  | "chair"
  | "plant"
  | "sofa"
  | "whiteboard"
  | "noticeboard"
  | "vending"
  | "coffee"
  | "table"
  | "bookshelf"
  | "welcome"
  | "rug"
  | "lamp"
  | "tv"
  | "beanbag"
  | "cooler"
  | "art";

export type ObjectAction =
  "sit" | "openSharedNotes" | "openPrivateNotes" | "showTips" | "buy" | "brew" | "read" | "drink" | "watch";

export interface MapObject {
  id: string;
  kind: ObjectKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Menghalangi jalan avatar. */
  solid: boolean;
  /** Arah hadap kursi (sandaran di sisi sebaliknya). */
  facing?: "up" | "down";
  /** Kunci terjemahan nama objek. Bila ada, objek bisa diinteraksi (FR-74). */
  label?: string;
  actions?: ObjectAction[];
}

export interface Zone {
  id: string;
  /** Kunci terjemahan nama area. */
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Ruang privat: audio terisolasi dan perlu "ketuk" bila ada orang di dalam (FR-23, FR-31). */
  private: boolean;
}

export interface AudioConfig {
  /** Jarak (tile) di mana suara masih penuh. */
  fullVolumeRadius: number;
  /** Jarak (tile) di mana suara hilang. */
  radius: number;
  /** Bentuk kurva: 1 = linear, >1 = turun lebih cepat di dekat batas. */
  curve: number;
}

export interface MapData {
  version: number;
  /** Revisi template asal; peta yang belum diubah admin ikut diperbarui saat template diperbaiki. */
  templateRev?: number;
  width: number;
  height: number;
  /** Baris-baris tile; satu karakter per tile. Lihat FLOOR_CHARS. */
  tiles: string[];
  zones: Zone[];
  objects: MapObject[];
  spawn: { x: number; y: number };
  audio: AudioConfig;
}

export const FLOOR_CHARS: Record<string, FloorKind> = {
  "#": "wall",
  ".": "lobby",
  w: "work",
  m: "meeting",
  l: "lounge",
  d: "door",
};

export const TEMPLATE_REV = 2;

export const DEFAULT_AUDIO: AudioConfig = { fullVolumeRadius: 1.5, radius: 6, curve: 1.4 };

function buildTemplate(): MapData {
  const W = 44;
  const H = 28;
  const grid: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => "#"));
  const fill = (x0: number, y0: number, w: number, h: number, c: string) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) grid[y][x] = c;
  };
  // Area kerja (kiri atas), ruang rapat privat (kanan atas), lobi (kiri bawah), lounge (kanan bawah).
  fill(1, 1, 22, 13, "w");
  fill(24, 1, 19, 10, "m");
  fill(1, 15, 22, 12, ".");
  fill(24, 12, 19, 15, "l");
  // Pintu
  fill(10, 14, 3, 1, "d"); // lobi <-> area kerja
  fill(23, 20, 1, 3, "d"); // lobi <-> lounge
  fill(32, 11, 2, 1, "d"); // lounge <-> ruang rapat
  fill(23, 5, 1, 2, "d"); // area kerja <-> ruang rapat

  const objects: MapObject[] = [];
  let n = 0;
  const add = (o: Omit<MapObject, "id">) => objects.push({ id: `${o.kind}-${++n}`, ...o });

  // Area kerja: deretan meja dengan kursi
  for (const row of [3, 8]) {
    for (const col of [3, 9, 15]) {
      add({
        kind: "desk",
        x: col,
        y: row,
        w: 3,
        h: 1,
        solid: true,
        label: "object.desk",
        actions: ["openPrivateNotes"],
      });
      add({
        kind: "chair",
        x: col + 1,
        y: row + 1,
        w: 1,
        h: 1,
        solid: false,
        label: "object.chair",
        actions: ["sit"],
      });
    }
  }
  add({
    kind: "whiteboard",
    x: 19,
    y: 1,
    w: 3,
    h: 1,
    solid: true,
    label: "object.whiteboard",
    actions: ["openSharedNotes"],
  });
  add({
    kind: "bookshelf",
    x: 1,
    y: 1,
    w: 2,
    h: 1,
    solid: true,
    label: "object.bookshelf",
    actions: ["read"],
  });
  add({ kind: "plant", x: 21, y: 12, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 1, y: 12, w: 1, h: 1, solid: true });
  add({ kind: "lamp", x: 1, y: 6, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 7, y: 1, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 13, y: 1, w: 1, h: 1, solid: true });
  add({ kind: "lamp", x: 21, y: 6, w: 1, h: 1, solid: true });

  // Ruang rapat
  add({
    kind: "table",
    x: 29,
    y: 4,
    w: 8,
    h: 3,
    solid: true,
    label: "object.meetingTable",
    actions: ["openSharedNotes"],
  });
  for (const x of [30, 32, 34, 36]) {
    add({
      kind: "chair",
      x,
      y: 3,
      w: 1,
      h: 1,
      solid: false,
      facing: "down",
      label: "object.chair",
      actions: ["sit"],
    });
    add({
      kind: "chair",
      x,
      y: 7,
      w: 1,
      h: 1,
      solid: false,
      facing: "up",
      label: "object.chair",
      actions: ["sit"],
    });
  }
  add({
    kind: "whiteboard",
    x: 39,
    y: 1,
    w: 3,
    h: 1,
    solid: true,
    label: "object.whiteboard",
    actions: ["openSharedNotes"],
  });
  add({ kind: "plant", x: 41, y: 9, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 25, y: 9, w: 1, h: 1, solid: true });
  add({
    kind: "tv",
    x: 31,
    y: 1,
    w: 3,
    h: 1,
    solid: true,
    label: "object.screen",
    actions: ["openSharedNotes"],
  });
  add({ kind: "lamp", x: 25, y: 1, w: 1, h: 1, solid: true });

  // Lobi
  add({ kind: "rug", x: 8, y: 19, w: 7, h: 4, solid: false });
  add({
    kind: "welcome",
    x: 10,
    y: 16,
    w: 3,
    h: 1,
    solid: true,
    label: "object.welcome",
    actions: ["showTips"],
  });
  add({
    kind: "noticeboard",
    x: 2,
    y: 15,
    w: 3,
    h: 1,
    solid: true,
    label: "object.noticeboard",
    actions: ["openSharedNotes"],
  });
  add({ kind: "plant", x: 1, y: 25, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 21, y: 25, w: 1, h: 1, solid: true });
  add({ kind: "sofa", x: 17, y: 24, w: 3, h: 1, solid: false, label: "object.sofa", actions: ["sit"] });
  add({ kind: "cooler", x: 21, y: 15, w: 1, h: 1, solid: true, label: "object.cooler", actions: ["drink"] });
  add({ kind: "beanbag", x: 3, y: 21, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "beanbag", x: 5, y: 23, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "plant", x: 15, y: 15, w: 1, h: 1, solid: true });
  add({ kind: "lamp", x: 1, y: 18, w: 1, h: 1, solid: true });
  add({ kind: "art", x: 6, y: 14, w: 2, h: 1, solid: false });
  add({ kind: "art", x: 16, y: 14, w: 2, h: 1, solid: false });

  // Lounge
  add({ kind: "sofa", x: 27, y: 16, w: 3, h: 1, solid: false, label: "object.sofa", actions: ["sit"] });
  add({ kind: "sofa", x: 33, y: 16, w: 3, h: 1, solid: false, label: "object.sofa", actions: ["sit"] });
  add({ kind: "table", x: 30, y: 18, w: 3, h: 2, solid: true });
  add({ kind: "vending", x: 40, y: 13, w: 2, h: 1, solid: true, label: "object.vending", actions: ["buy"] });
  add({ kind: "coffee", x: 37, y: 13, w: 2, h: 1, solid: true, label: "object.coffee", actions: ["brew"] });
  add({ kind: "plant", x: 41, y: 25, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 25, y: 25, w: 1, h: 1, solid: true });
  add({ kind: "rug", x: 31, y: 22, w: 6, h: 3, solid: false });
  add({ kind: "tv", x: 27, y: 13, w: 3, h: 1, solid: true, label: "object.tv", actions: ["watch"] });
  add({ kind: "beanbag", x: 32, y: 23, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "beanbag", x: 35, y: 23, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "lamp", x: 42, y: 17, w: 1, h: 1, solid: true });
  add({ kind: "lamp", x: 24, y: 13, w: 1, h: 1, solid: true });
  add({ kind: "art", x: 34, y: 11, w: 2, h: 1, solid: false });
  add({ kind: "art", x: 38, y: 11, w: 2, h: 1, solid: false });

  return {
    version: 1,
    templateRev: TEMPLATE_REV,
    width: W,
    height: H,
    tiles: grid.map((r) => r.join("")),
    zones: [
      { id: "work", label: "zone.work", x: 1, y: 1, w: 22, h: 13, private: false },
      { id: "meeting", label: "zone.meeting", x: 24, y: 1, w: 19, h: 10, private: true },
      { id: "lobby", label: "zone.lobby", x: 1, y: 15, w: 22, h: 12, private: false },
      { id: "lounge", label: "zone.lounge", x: 24, y: 12, w: 19, h: 15, private: false },
    ],
    objects,
    spawn: { x: 11, y: 21 },
    audio: { ...DEFAULT_AUDIO },
  };
}

export const OFFICE_TEMPLATE: MapData = buildTemplate();

export function tileAt(map: MapData, x: number, y: number): FloorKind {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return "wall";
  return FLOOR_CHARS[map.tiles[y][x]] ?? "wall";
}

/** Grid boolean: true = bisa dilewati. */
export function buildWalkable(map: MapData): boolean[][] {
  const g = Array.from({ length: map.height }, (_, y) =>
    Array.from({ length: map.width }, (_, x) => tileAt(map, x, y) !== "wall"),
  );
  for (const o of map.objects) {
    if (!o.solid) continue;
    for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) if (g[y]) g[y][x] = false;
  }
  return g;
}

/** Area tempat titik (dalam satuan tile, boleh pecahan) berada. */
export function zoneAt(map: MapData, x: number, y: number): Zone | null {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  return map.zones.find((z) => tx >= z.x && tx < z.x + z.w && ty >= z.y && ty < z.y + z.h) ?? null;
}

export function privateZoneAt(map: MapData, x: number, y: number): Zone | null {
  const z = zoneAt(map, x, y);
  return z && z.private ? z : null;
}

/** Jarak terdekat (tile) dari titik ke kotak objek. */
export function distanceToObject(o: MapObject, x: number, y: number): number {
  const cx = Math.max(o.x, Math.min(x, o.x + o.w));
  const cy = Math.max(o.y, Math.min(y, o.y + o.h));
  return Math.hypot(x - cx, y - cy);
}

export const INTERACT_RANGE = 1.6;
