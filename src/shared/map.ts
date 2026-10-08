/**
 * Peta template kantor 2D (FR-10, FR-72).
 * Peta disusun sebagai grid tile. Setiap grup mendapat salinan template ini saat dibuat,
 * disimpan di tabel `maps` sebagai JSON sehingga bisa diubah per grup (editor peta: P1).
 */

export const TILE = 32;

export type FloorKind =
  | "lobby"
  | "work"
  | "meeting"
  | "lounge"
  | "home"
  | "kitchen"
  | "bedroom"
  | "garden"
  | "gaming"
  | "studio"
  | "rooftop"
  | "wall"
  | "door";

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
  | "art"
  | "speaker"
  | "bed"
  | "counter"
  | "fridge"
  | "arcade"
  | "gamingDesk"
  | "cabinet"
  | "printer"
  | "palm"
  | "parasol"
  | "pergola"
  | "camera"
  | "softbox"
  | "greenscreen"
  | "bbq"
  | "firepit"
  | "foosball"
  | "bath"
  | "sink";

export type ObjectAction =
  | "sit"
  | "openSharedNotes"
  | "openPrivateNotes"
  | "showTips"
  | "buy"
  | "brew"
  | "read"
  | "drink"
  | "watch"
  | "music"
  | "cook"
  | "play";

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
  facing?: "up" | "down" | "left" | "right";
  /** Kunci terjemahan nama objek. Bila ada, objek bisa diinteraksi (FR-74). */
  label?: string;
  actions?: ObjectAction[];
  /** Khusus speaker: jangkauan suara musik (bawaan SPEAKER_AUDIO di shared/music). */
  audio?: AudioConfig;
}

export interface Zone {
  id: string;
  /** Kunci terjemahan nama area. */
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Ruang kedap suara: hanya orang di dalamnya yang saling mendengar, dengan volume penuh (FR-23). */
  private: boolean;
  /**
   * Bisa dikunci oleh orang di dalamnya; saat terkunci, orang luar harus "ketuk" (FR-31).
   * Bawaan: sama dengan `private` (ruang rapat lama tetap bisa dikunci).
   */
  lockable?: boolean;
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
  /** Jenis ruangan (kantor, rumah, gaming house); peta lama tanpa nilai ini adalah kantor. */
  template?: string;
  /** Revisi template asal; peta yang belum diubah admin ikut diperbarui saat template diperbaiki. */
  templateRev?: number;
  /** Edited layouts never get overwritten by an automatic template upgrade. */
  customLayout?: boolean;
  width: number;
  height: number;
  /** Baris-baris tile; satu karakter per tile. Lihat FLOOR_CHARS. */
  tiles: string[];
  zones: Zone[];
  objects: MapObject[];
  spawn: { x: number; y: number };
  audio: AudioConfig;
  appearance?: MapAppearance;
}

export const AMBIENCES = ["bright", "normal", "dim", "night"] as const;
export const FURNITURE_STYLES = ["warm", "modern", "industrial", "tropical"] as const;
export const ROOM_SIZES = ["small", "medium", "large"] as const;
export interface MapAppearance {
  ambience: (typeof AMBIENCES)[number];
  furnitureStyle: (typeof FURNITURE_STYLES)[number];
  roomSize: (typeof ROOM_SIZES)[number];
}
export const DEFAULT_APPEARANCE: MapAppearance = {
  ambience: "normal",
  furnitureStyle: "warm",
  roomSize: "medium",
};

export const FLOOR_CHARS: Record<string, FloorKind> = {
  "#": "wall",
  ".": "lobby",
  w: "work",
  m: "meeting",
  l: "lounge",
  h: "home",
  k: "kitchen",
  b: "bedroom",
  g: "garden",
  x: "gaming",
  s: "studio",
  r: "rooftop",
  d: "door",
};

export const DEFAULT_AUDIO: AudioConfig = { fullVolumeRadius: 1.5, radius: 6, curve: 1.4 };

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

export const isLockable = (z: Zone) => z.lockable ?? z.private;

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
