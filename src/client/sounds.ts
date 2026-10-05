/**
 * Bunyi notifikasi pendek yang disintesis dengan Web Audio (tanpa berkas audio).
 * Sengaja lembut dan singkat agar tidak mengganggu percakapan suara.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, freq: number, at: number, dur: number, gain: number, type: OscillatorType) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + at);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + at);
  o.stop(c.currentTime + at + dur + 0.02);
}

export type SoundKind = "knock" | "dm" | "mention";

export function playSound(kind: SoundKind) {
  const c = audio();
  if (!c) return;
  if (kind === "knock") {
    // Dua ketukan kayu.
    tone(c, 180, 0, 0.12, 0.35, "triangle");
    tone(c, 170, 0.16, 0.12, 0.3, "triangle");
  } else if (kind === "dm") {
    tone(c, 660, 0, 0.18, 0.12, "sine");
    tone(c, 880, 0.09, 0.22, 0.1, "sine");
  } else {
    tone(c, 784, 0, 0.14, 0.12, "sine");
    tone(c, 988, 0.08, 0.14, 0.1, "sine");
    tone(c, 1175, 0.16, 0.24, 0.08, "sine");
  }
}

/** Notifikasi sistem saat tab tidak sedang dilihat (bila diizinkan pengguna). */
export function desktopNotify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!document.hidden) return;
  try {
    const n = new Notification(title, { body, icon: "/icon.svg", silent: true });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {}
}
