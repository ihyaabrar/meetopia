/**
 * TV di ruangan: anggota di dekat TV bisa memutar video YouTube untuk ditonton bersama.
 * Status (video + waktu mulai) disimpan di Redis per grup; setiap orang yang membuka TV melihat
 * video yang sama pada posisi yang sama.
 */
import { z } from "zod";

export interface TvState {
  objectId: string;
  videoId: string;
  /** Waktu server (ms) saat video mulai diputar. */
  startedAt: number;
  by: string;
  byName: string;
}

const ID = /^[A-Za-z0-9_-]{11}$/;

/** Mengambil id video dari tautan YouTube (watch, youtu.be, shorts, embed, live) atau id langsung. */
export function youtubeId(raw: string): string | null {
  const v = raw.trim();
  if (ID.test(v)) return v;
  try {
    const u = new URL(v);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1, 12);
      return ID.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
      const q = u.searchParams.get("v");
      if (q && ID.test(q)) return q;
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
      return m ? m[1] : null;
    }
  } catch {}
  return null;
}

export const tvMessageSchema = z.object({
  t: z.literal("tv"),
  objectId: z.string().max(64),
  action: z.enum(["play", "stop"]),
  url: z.string().max(300).optional(),
});

export const TV_CONTROL_RANGE = 3;
