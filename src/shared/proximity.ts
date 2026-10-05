/**
 * Aturan siapa mendengar siapa (FR-20, FR-21, FR-23).
 * Dipakai bersama oleh klien (volume) dan server (izin sinyal WebRTC).
 */
import { privateZoneAt, type AudioConfig, type MapData } from "./map";

export interface Positioned {
  id: string;
  x: number;
  y: number;
  status: PresenceStatus;
  /** Orang yang boleh berbicara walau salah satu sedang sibuk (hasil "ketuk" yang diterima). */
  allowedPeers?: string[];
}

export const STATUSES = ["active", "busy", "meeting", "away"] as const;
export type PresenceStatus = (typeof STATUSES)[number];

/** Volume 0..1 berdasarkan jarak dalam tile. */
export function volumeForDistance(d: number, audio: AudioConfig): number {
  if (d <= audio.fullVolumeRadius) return 1;
  if (d >= audio.radius) return 0;
  const t = (d - audio.fullVolumeRadius) / (audio.radius - audio.fullVolumeRadius);
  return Math.max(0, Math.min(1, 1 - Math.pow(t, audio.curve)));
}

function busyBlocked(a: Positioned, b: Positioned): boolean {
  const aBusy = a.status === "busy";
  const bBusy = b.status === "busy";
  if (!aBusy && !bBusy) return false;
  return !(a.allowedPeers?.includes(b.id) || b.allowedPeers?.includes(a.id));
}

/** Volume yang didengar antara dua orang (simetris). 0 = tidak tersambung. */
export function pairVolume(map: MapData, a: Positioned, b: Positioned): number {
  if (a.id === b.id) return 0;
  const za = privateZoneAt(map, a.x, a.y);
  const zb = privateZoneAt(map, b.x, b.y);
  // Ruang privat: hanya orang di ruang yang sama yang saling mendengar, dengan volume penuh.
  if (za || zb) return za && zb && za.id === zb.id ? 1 : 0;
  if (busyBlocked(a, b)) return 0;
  return volumeForDistance(Math.hypot(a.x - b.x, a.y - b.y), map.audio);
}

export const MAX_AUDIO_PEERS = 16;
export const MAX_VIDEO_PEERS = 8;

/** Peserta percakapan sekitar untuk `self`, diurutkan dari yang terdekat, dibatasi 16 audio. */
export function audiblePeers<T extends Positioned>(map: MapData, self: Positioned, others: T[]) {
  return others
    .map((o) => ({
      peer: o,
      volume: pairVolume(map, self, o),
      distance: Math.hypot(self.x - o.x, self.y - o.y),
    }))
    .filter((p) => p.volume > 0)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_AUDIO_PEERS);
}
