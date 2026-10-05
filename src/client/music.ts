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

const sameSource = (a: MusicSource, b: MusicSource) =>
  a.kind === b.kind && (a.kind === "station" ? a.id === (b as typeof a).id : a.url === (b as typeof a).url);

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
