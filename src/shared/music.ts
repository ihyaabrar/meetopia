/**
 * Speaker musik di ruangan. Status pemutaran disimpan di Redis per grup dan disiarkan ke semua orang,
 * tetapi suaranya diputar di tiap browser dengan volume menurut jarak ke speaker:
 * makin jauh makin pelan, lalu hilang di luar radius. Ruang privat terisolasi seperti suara orang.
 */
import { z } from "zod";
import { privateZoneAt, zoneAt, type AudioConfig, type MapData, type MapObject } from "./map";
import { volumeForDistance } from "./proximity";

/** Stasiun bawaan: musik dibuat langsung di browser (Web Audio), tanpa berkas dan tanpa lisensi pihak ketiga. */
export const STATIONS = ["lofi", "ambient", "piano", "retro"] as const;
export type StationId = (typeof STATIONS)[number];

export type MusicSource =
  | { kind: "station"; id: StationId }
  | { kind: "url"; url: string }
  /** Video YouTube diputar sebagai audio (pemutar tersembunyi), volume tetap menurut jarak. */
  | { kind: "youtube"; id: string };

export interface MusicState {
  objectId: string;
  source: MusicSource;
  /** Waktu server (ms) saat lagu dimulai; semua browser menghitung posisi lagu dari sini agar sinkron. */
  startedAt: number;
  by: string;
  byName: string;
}

/** Bawaan: penuh sampai 2,5 tile, hilang total di 12 tile. */
export const SPEAKER_AUDIO: AudioConfig = { fullVolumeRadius: 2.5, radius: 12, curve: 1.3 };
/** Peredaman saat pendengar ada di area lain (suara lewat dinding/pintu). */
export const WALL_DAMPING = 0.35;
/** Jarak maksimal (tile) untuk mengatur speaker. */
export const SPEAKER_CONTROL_RANGE = 3;

export function isValidAudioUrl(raw: string): boolean {
  if (raw.length > 500) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}

export const musicSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("station"), id: z.enum(STATIONS) }),
  z.object({ kind: z.literal("url"), url: z.string().max(500).refine(isValidAudioUrl) }),
  z.object({ kind: z.literal("youtube"), id: z.string().regex(/^[A-Za-z0-9_-]{11}$/) }),
]);

export function speakerCenter(o: MapObject) {
  return { x: o.x + o.w / 2, y: o.y + o.h / 2 };
}

/** Volume 0..1 speaker untuk pendengar di (x, y), plus posisi stereo -1..1. */
export function speakerVolume(
  map: MapData,
  o: MapObject,
  x: number,
  y: number,
): { volume: number; pan: number } {
  const c = speakerCenter(o);
  const zs = privateZoneAt(map, c.x, c.y);
  const zl = privateZoneAt(map, x, y);
  if ((zs || zl) && zs?.id !== zl?.id) return { volume: 0, pan: 0 };
  const audio = o.audio ?? SPEAKER_AUDIO;
  let volume = volumeForDistance(Math.hypot(x - c.x, y - c.y), audio);
  const a = zoneAt(map, c.x, c.y);
  const b = zoneAt(map, x, y);
  if (a && b && a.id !== b.id) volume *= WALL_DAMPING;
  const pan = Math.max(-0.7, Math.min(0.7, (c.x - x) / audio.radius));
  return { volume, pan };
}
