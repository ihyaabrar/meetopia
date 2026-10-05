/**
 * Stasiun musik bawaan yang disintesis dengan Web Audio: tanpa berkas audio, tanpa lisensi pihak ketiga.
 *
 * Setiap stasiun adalah pola deterministik per langkah (seperenam belas ketukan). Posisi lagu dihitung dari
 * jam server (`startedAt`), jadi semua orang yang mendengar speaker yang sama mendengar bagian yang sama.
 */
import type { StationId } from "@/shared/music";

type Ins = "ep" | "bass" | "kick" | "snare" | "hat" | "pad" | "bell" | "square" | "piano" | "sub";

interface Note {
  /** Pergeseran dari awal langkah, dalam detik. */
  at: number;
  ins: Ins;
  midi?: number;
  dur: number;
  vel: number;
}

interface Station {
  bpm: number;
  /** 0..0,5: seberapa terlambat langkah ganjil-kedua (rasa ayun). */
  swing: number;
  step(k: number, stepDur: number): Note[];
}

const freq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Acak deterministik 0..1 dari bilangan bulat (sama di semua browser). */
function rnd(k: number, salt: number): number {
  let h = (k * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

const pick = <T>(list: readonly T[], r: number) => list[Math.floor(r * list.length) % list.length];

// ---------------------------------------------------------------- stasiun

const LOFI_CHORDS = [
  [53, 57, 60, 64], // Fmaj7
  [52, 55, 59, 62], // Em7
  [50, 53, 57, 60], // Dm7
  [48, 52, 55, 59], // Cmaj7
];
const C_PENTA_HI = [72, 74, 76, 79, 81, 84];

const lofi: Station = {
  bpm: 74,
  swing: 0.18,
  step(k, sd) {
    const bar = Math.floor(k / 16);
    const s = k % 16;
    const chord = LOFI_CHORDS[bar % 4];
    const out: Note[] = [];
    if (s === 0) {
      chord.forEach((m, i) => out.push({ at: i * 0.012, ins: "ep", midi: m, dur: sd * 15, vel: 0.11 }));
      out.push({ at: 0, ins: "bass", midi: chord[0] - 12, dur: sd * 6, vel: 0.32 });
    }
    if (s === 10) out.push({ at: 0, ins: "bass", midi: chord[2] - 12, dur: sd * 4, vel: 0.24 });
    if (s === 0 || s === 7 || s === 10) out.push({ at: 0, ins: "kick", dur: 0.3, vel: s === 0 ? 0.5 : 0.36 });
    if (s === 4 || s === 12) out.push({ at: 0, ins: "snare", dur: 0.2, vel: 0.16 });
    if (s % 2 === 0) out.push({ at: 0, ins: "hat", dur: 0.05, vel: s % 4 === 0 ? 0.05 : 0.03 });
    if ([2, 6, 9, 13].includes(s) && rnd(k, 1) < 0.42)
      out.push({ at: 0, ins: "bell", midi: pick(C_PENTA_HI, rnd(k, 2)), dur: 0.9, vel: 0.05 });
    return out;
  },
};

const AMBIENT_CHORDS = [
  [48, 55, 64, 71], // Cmaj7 terbuka
  [45, 52, 60, 67], // Am7
  [41, 48, 57, 64], // Fmaj7
  [43, 50, 59, 62], // G6
];

const ambient: Station = {
  bpm: 60,
  swing: 0,
  step(k, sd) {
    const bar = Math.floor(k / 16);
    const s = k % 16;
    const chord = AMBIENT_CHORDS[Math.floor(bar / 2) % 4];
    const out: Note[] = [];
    if (s === 0 && bar % 2 === 0) {
      chord.forEach((m) => out.push({ at: 0, ins: "pad", midi: m, dur: sd * 32, vel: 0.05 }));
      out.push({ at: 0, ins: "sub", midi: chord[0] - 12, dur: sd * 30, vel: 0.12 });
    }
    if (s % 4 === 0 && rnd(k, 3) < 0.3)
      out.push({
        at: rnd(k, 4) * sd,
        ins: "bell",
        midi: pick([76, 79, 81, 83, 86, 88], rnd(k, 5)),
        dur: 3,
        vel: 0.04,
      });
    return out;
  },
};

const PIANO_CHORDS = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
];

const piano: Station = {
  bpm: 84,
  swing: 0.08,
  step(k, sd) {
    const bar = Math.floor(k / 16);
    const s = k % 16;
    const c = PIANO_CHORDS[bar % 4];
    const out: Note[] = [];
    if (s === 0) out.push({ at: 0, ins: "piano", midi: c[0] - 12, dur: sd * 14, vel: 0.2 });
    if (s % 2 === 0) {
      const pattern = [c[0], c[1], c[2], c[1] + 12, c[2], c[1], c[0] + 12, c[2]];
      out.push({ at: 0, ins: "piano", midi: pattern[(s / 2) % 8], dur: sd * 6, vel: 0.1 });
    }
    if ((s === 4 || s === 12) && rnd(k, 6) < 0.55)
      out.push({ at: 0, ins: "piano", midi: pick([72, 74, 76, 79, 81], rnd(k, 7)), dur: sd * 8, vel: 0.09 });
    return out;
  },
};

const RETRO_CHORDS = [
  [60, 64, 67], // C
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [55, 59, 62], // G
];

const retro: Station = {
  bpm: 112,
  swing: 0,
  step(k, sd) {
    const bar = Math.floor(k / 16);
    const s = k % 16;
    const c = RETRO_CHORDS[bar % 4];
    const out: Note[] = [];
    out.push({ at: 0, ins: "square", midi: c[s % 3] + (s % 6 < 3 ? 0 : 12), dur: sd * 0.8, vel: 0.028 });
    if (s % 4 === 0) out.push({ at: 0, ins: "bass", midi: c[0] - 24, dur: sd * 2.5, vel: 0.26 });
    if (s % 8 === 0) out.push({ at: 0, ins: "kick", dur: 0.2, vel: 0.36 });
    if (s % 8 === 4) out.push({ at: 0, ins: "snare", dur: 0.14, vel: 0.11 });
    if (s % 4 === 2) out.push({ at: 0, ins: "hat", dur: 0.04, vel: 0.035 });
    if (s % 2 === 0 && rnd(k, 8) < 0.45)
      out.push({
        at: 0,
        ins: "square",
        midi: pick([72, 74, 76, 79, 81], rnd(k, 9)),
        dur: sd * 1.6,
        vel: 0.022,
      });
    return out;
  },
};

export const STATION_DEFS: Record<StationId, Station> = { lofi, ambient, piano, retro };

// ---------------------------------------------------------------- instrumen

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBuffers.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, b);
  }
  return b;
}

function env(ctx: BaseAudioContext, when: number, attack: number, dur: number, vel: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(vel, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + dur);
  return g;
}

function osc(
  ctx: BaseAudioContext,
  type: OscillatorType,
  f: number,
  when: number,
  end: number,
  dest: AudioNode,
) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.connect(dest);
  o.start(when);
  o.stop(end + 0.05);
  return o;
}

function play(ctx: BaseAudioContext, out: AudioNode, n: Note, when: number) {
  const f = n.midi !== undefined ? freq(n.midi) : 0;
  switch (n.ins) {
    case "ep": {
      const g = env(ctx, when, 0.015, n.dur, n.vel);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1800;
      g.connect(lp).connect(out);
      osc(ctx, "sine", f, when, when + n.dur, g);
      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      g2.connect(g);
      osc(ctx, "triangle", f * 2, when, when + n.dur, g2);
      return;
    }
    case "piano": {
      const g = env(ctx, when, 0.006, n.dur, n.vel);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(3200, when);
      lp.frequency.exponentialRampToValueAtTime(900, when + n.dur);
      g.connect(lp).connect(out);
      osc(ctx, "triangle", f, when, when + n.dur, g);
      const g2 = ctx.createGain();
      g2.gain.value = 0.18;
      g2.connect(g);
      osc(ctx, "sine", f * 2.01, when, when + n.dur, g2);
      return;
    }
    case "bell": {
      const g = env(ctx, when, 0.004, n.dur, n.vel);
      g.connect(out);
      osc(ctx, "sine", f, when, when + n.dur, g);
      const g2 = ctx.createGain();
      g2.gain.value = 0.22;
      g2.connect(g);
      osc(ctx, "sine", f * 2.76, when, when + n.dur * 0.5, g2);
      return;
    }
    case "pad": {
      const g = ctx.createGain();
      const atk = Math.min(2, n.dur * 0.3);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(n.vel, when + atk);
      g.gain.setValueAtTime(n.vel, when + n.dur - atk);
      g.gain.linearRampToValueAtTime(0.0001, when + n.dur);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      g.connect(lp).connect(out);
      for (const det of [-7, 7]) {
        const o = osc(ctx, "sawtooth", f, when, when + n.dur, g);
        o.detune.value = det;
      }
      return;
    }
    case "sub":
    case "bass": {
      const g = n.ins === "sub" ? ctx.createGain() : env(ctx, when, 0.01, n.dur, n.vel);
      if (n.ins === "sub") {
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(n.vel, when + 1.5);
        g.gain.linearRampToValueAtTime(0.0001, when + n.dur);
      }
      g.connect(out);
      osc(ctx, n.ins === "sub" ? "sine" : "triangle", f, when, when + n.dur, g);
      return;
    }
    case "square": {
      const g = env(ctx, when, 0.004, n.dur, n.vel);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2600;
      g.connect(lp).connect(out);
      osc(ctx, "square", f, when, when + n.dur, g);
      return;
    }
    case "kick": {
      const g = env(ctx, when, 0.003, n.dur, n.vel);
      g.connect(out);
      const o = osc(ctx, "sine", 140, when, when + n.dur, g);
      o.frequency.setValueAtTime(140, when);
      o.frequency.exponentialRampToValueAtTime(42, when + 0.14);
      return;
    }
    case "snare":
    case "hat": {
      const src = ctx.createBufferSource();
      src.buffer = noise(ctx);
      const f2 = ctx.createBiquadFilter();
      f2.type = n.ins === "hat" ? "highpass" : "bandpass";
      f2.frequency.value = n.ins === "hat" ? 7000 : 1800;
      const g = env(ctx, when, 0.002, n.dur, n.vel);
      src.connect(f2).connect(g).connect(out);
      src.start(when, Math.random() * 0.5);
      src.stop(when + n.dur + 0.05);
      return;
    }
  }
}

/**
 * Memutar satu stasiun ke `out`, sinkron dengan jam: `songTime()` mengembalikan posisi lagu (detik).
 * Penjadwal melihat ~0,6 detik ke depan, dipanggil tiap 150 ms.
 */
export class StationPlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastStep = -1;
  private def: Station;
  private stepDur: number;

  constructor(
    private ctx: AudioContext,
    private out: AudioNode,
    station: StationId,
    private songTime: () => number,
  ) {
    this.def = STATION_DEFS[station];
    this.stepDur = 60 / this.def.bpm / 4;
  }

  start() {
    if (this.timer) return;
    this.lastStep = Math.floor(this.songTime() / this.stepDur) - 1;
    this.resumeHeldNotes();
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 150);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Saat mulai mendengar di tengah lagu, nada panjang yang seharusnya masih berbunyi (pad, akord)
   * dimainkan sekarang dengan sisa durasinya, agar musik langsung terdengar utuh.
   */
  private resumeHeldNotes() {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const song = this.songTime();
    const cur = this.lastStep + 1;
    for (let k = Math.max(0, cur - 64); k < cur; k++) {
      const swing = k % 2 === 1 ? this.def.swing * this.stepDur : 0;
      const t0 = k * this.stepDur + swing;
      for (const n of this.def.step(k, this.stepDur)) {
        const remaining = t0 + n.at + n.dur - song;
        if (n.dur < 1 || remaining < 0.5) continue;
        play(this.ctx, this.out, { ...n, at: 0, dur: remaining, vel: n.vel * 0.8 }, now + 0.02);
      }
    }
  }

  private schedule() {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const song = this.songTime();
    const horizon = song + 0.6;
    // Setelah tab tertidur lama, lewati langkah yang sudah lewat agar tidak menumpuk.
    if (song - (this.lastStep + 1) * this.stepDur > 1) this.lastStep = Math.floor(song / this.stepDur) - 1;
    while ((this.lastStep + 1) * this.stepDur < horizon) {
      const k = ++this.lastStep;
      if (k < 0) continue;
      const swing = k % 2 === 1 ? this.def.swing * this.stepDur : 0;
      const t0 = k * this.stepDur + swing;
      for (const n of this.def.step(k, this.stepDur)) {
        const when = now + (t0 + n.at - song);
        // Sedikit terlambat (mis. jeda jaringan/penjadwal): tetap mainkan sekarang daripada hilang.
        if (when < now - 0.25) continue;
        play(this.ctx, this.out, n, Math.max(now, when));
      }
    }
  }
}
