/**
 * Pemutar musik speaker di sisi browser. Membaca status speaker dari RoomClient dan posisi diri sendiri,
 * lalu mengatur volume tiap speaker menurut jarak (shared/music.speakerVolume): makin jauh makin pelan.
 *
 * Speaker yang tidak terdengar lebih dari beberapa detik dihentikan agar hemat CPU dan kuota data;
 * saat didekati lagi, lagunya dilanjutkan pada posisi yang sama dengan orang lain.
 */
import type { RoomClient } from "./roomClient";
import { getPrefs, subscribePrefs } from "./prefs";
import { StationPlayer } from "./musicSynth";
import { speakerVolume, type MusicSource, type MusicState } from "@/shared/music";

export interface Audible {
  objectId: string;
  source: MusicSource;
  byName: string;
  volume: number;
  failed: boolean;
}

interface Voice {
  key: string;
  state: MusicState;
  level: number;
  silentSince: number | null;
  failed: boolean;
  setLevel(v: number, pan: number): void;
  destroy(): void;
}

const IDLE_STOP_MS = 4000;

const sourceKey = (m: MusicSource) => (m.kind === "url" ? `url:${m.url}` : `${m.kind}:${m.id}`);
const sameSource = (a: MusicSource, b: MusicSource) => sourceKey(a) === sourceKey(b);

export class MusicPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Map<string, Voice>();
  private timer: ReturnType<typeof setInterval>;
  private listeners = new Set<() => void>();
  private audible: Audible[] = [];
  private unlock = () => {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
    for (const v of this.voices.values()) if ("retry" in v) (v as { retry: () => void }).retry();
  };

  private offPrefs: () => void;
  private sinkId = getPrefs().speakerDeviceId;

  constructor(private room: RoomClient) {
    this.timer = setInterval(() => this.tick(), 150);
    this.offPrefs = subscribePrefs(() => {
      if (getPrefs().speakerDeviceId !== this.sinkId) {
        this.sinkId = getPrefs().speakerDeviceId;
        this.applySink();
      }
    });
    window.addEventListener("pointerdown", this.unlock);
    window.addEventListener("keydown", this.unlock);
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.audible;

  private audio(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applySink();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Ikuti speaker yang dipilih di pengaturan Suara & video (bila browser mendukung). */
  applySink() {
    const id = getPrefs().speakerDeviceId;
    const c = this.ctx as (AudioContext & { setSinkId?: (id: string) => Promise<void> }) | null;
    void c?.setSinkId?.(id).catch(() => {});
    for (const v of this.voices.values()) (v as { setSink?: (id: string) => void }).setSink?.(id);
  }

  private songTime(state: MusicState) {
    return Math.max(0, (Date.now() + this.room.snapshot.clockOffset - state.startedAt) / 1000);
  }

  private createVoice(key: string, state: MusicState): Voice {
    if (state.source.kind === "station") {
      const ctx = this.audio();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const pan = ctx.createStereoPanner();
      gain.connect(pan).connect(this.master!);
      const player = new StationPlayer(ctx, gain, state.source.id, () => this.songTime(state));
      player.start();
      return {
        key,
        state,
        level: 0,
        silentSince: null,
        failed: false,
        setLevel(v, p) {
          this.level = v;
          gain.gain.setTargetAtTime(v, ctx.currentTime, 0.25);
          pan.pan.setTargetAtTime(p, ctx.currentTime, 0.25);
        },
        destroy() {
          player.stop();
          gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
          setTimeout(() => pan.disconnect(), 600);
        },
      };
    }

    if (state.source.kind === "youtube") return this.youtubeVoice(key, state, state.source.id);

    // Tautan audio langsung: elemen <audio>, volume diatur langsung (tanpa Web Audio agar
    // berkas dari domain lain tetap bisa diputar walau servernya tidak mengizinkan CORS).
    const el = new Audio();
    el.preload = "auto";
    el.loop = true;
    el.volume = 0;
    const sync = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        const pos = this.songTime(state) % el.duration;
        if (Math.abs(el.currentTime - pos) > 1.5) el.currentTime = pos;
      }
    };
    const voice: Voice & { retry: () => void; setSink: (id: string) => void } = {
      key,
      state,
      level: 0,
      silentSince: null,
      failed: false,
      setLevel(v) {
        this.level = v;
        el.volume = Math.max(0, Math.min(1, v));
      },
      retry() {
        if (el.paused && !voice.failed) void el.play().catch(() => {});
      },
      setSink(id: string) {
        const s = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
        void s.setSinkId?.(id).catch(() => {});
      },
      destroy() {
        el.pause();
        el.removeAttribute("src");
        el.load();
      },
    };
    el.addEventListener("loadedmetadata", sync);
    el.addEventListener("error", () => {
      voice.failed = true;
      this.publish(true);
    });
    voice.setSink(getPrefs().speakerDeviceId);
    el.src = state.source.url;
    void el.play().catch(() => {});
    return voice;
  }

  /**
   * YouTube: pemutar tersembunyi (iframe) yang dikendalikan lewat postMessage IFrame API.
   * Volume 0..100 mengikuti jarak ke speaker; posisi awal sama untuk semua orang.
   */
  private youtubeVoice(key: string, state: MusicState, id: string): Voice {
    const start = Math.floor(this.songTime(state));
    const frame = document.createElement("iframe");
    frame.className = "yt-audio";
    frame.title = "YouTube audio";
    frame.allow = "autoplay; encrypted-media";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.src =
      `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&autoplay=1&start=${start}` +
      `&loop=1&playlist=${id}&controls=0&playsinline=1&origin=${encodeURIComponent(location.origin)}`;
    document.body.appendChild(frame);
    let volume = -1;
    const post = (func: string, args: unknown[] = []) =>
      frame.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || typeof e.data !== "string") return;
      try {
        const data = JSON.parse(e.data) as { event?: string };
        if (data.event === "onError") {
          voice.failed = true;
          this.publish(true);
        }
      } catch {}
    };
    window.addEventListener("message", onMsg);
    frame.addEventListener("load", () => {
      frame.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: key }), "*");
      post("playVideo");
      if (volume >= 0) post("setVolume", [volume]);
    });
    let lastSent = 0;
    const voice: Voice & { retry: () => void } = {
      key,
      state,
      level: 0,
      silentSince: null,
      failed: false,
      setLevel(v) {
        this.level = v;
        const next = Math.round(Math.max(0, Math.min(1, v)) * 100);
        // Kirim ulang berkala: perintah sebelum pemutar siap bisa hilang.
        if (next !== volume || Date.now() - lastSent > 2000) {
          volume = next;
          lastSent = Date.now();
          post("setVolume", [next]);
          if (next > 0) post("unMute");
        }
      },
      retry() {
        post("playVideo");
      },
      destroy() {
        window.removeEventListener("message", onMsg);
        frame.remove();
      },
    };
    return voice;
  }

  private tick() {
    const snap = this.room.snapshot;
    const self = this.room.self;
    const map = snap.map;
    const prefs = getPrefs();
    const now = Date.now();
    const audible: Audible[] = [];
    const seen = new Set<string>();

    if (map && self && snap.conn === "open") {
      for (const state of Object.values(snap.music)) {
        const obj = map.objects.find((o) => o.id === state.objectId);
        if (!obj) continue;
        const key = `${state.objectId}|${state.startedAt}`;
        seen.add(key);
        const { volume, pan } = speakerVolume(map, obj, self.x, self.y);
        const level = prefs.musicMuted ? 0 : volume * prefs.musicVolume;
        let voice = this.voices.get(state.objectId);
        if (voice && (voice.key !== key || !sameSource(voice.state.source, state.source))) {
          voice.destroy();
          this.voices.delete(state.objectId);
          voice = undefined;
        }
        if (!voice && level > 0.001) {
          voice = this.createVoice(key, state);
          this.voices.set(state.objectId, voice);
        }
        if (voice) {
          voice.setLevel(level, pan);
          if (level <= 0.001) {
            voice.silentSince ??= now;
            if (now - voice.silentSince > IDLE_STOP_MS) {
              voice.destroy();
              this.voices.delete(state.objectId);
            }
          } else voice.silentSince = null;
        }
        if (volume > 0.01)
          audible.push({
            objectId: state.objectId,
            source: state.source,
            byName: state.byName,
            volume,
            failed: !!voice?.failed,
          });
      }
    }
    // Speaker yang dihentikan atau sudah tidak ada.
    for (const [id, v] of this.voices) {
      if (!seen.has(v.key)) {
        v.destroy();
        this.voices.delete(id);
      }
    }
    this.audible = this.changed(audible) ? audible : this.audible;
    if (this.audible === audible) this.publish(false);
  }

  private changed(next: Audible[]) {
    const cur = this.audible;
    if (cur.length !== next.length) return true;
    return next.some(
      (a, i) =>
        a.objectId !== cur[i].objectId ||
        a.failed !== cur[i].failed ||
        !sameSource(a.source, cur[i].source) ||
        Math.abs(a.volume - cur[i].volume) > 0.05,
    );
  }

  private publish(force: boolean) {
    if (force)
      this.audible = [
        ...this.audible.map((a) => ({ ...a, failed: this.voices.get(a.objectId)?.failed ?? a.failed })),
      ];
    this.listeners.forEach((f) => f());
  }

  destroy() {
    clearInterval(this.timer);
    this.offPrefs();
    window.removeEventListener("pointerdown", this.unlock);
    window.removeEventListener("keydown", this.unlock);
    for (const v of this.voices.values()) v.destroy();
    this.voices.clear();
    void this.ctx?.close().catch(() => {});
  }
}
