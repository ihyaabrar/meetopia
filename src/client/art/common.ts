/** Palet dan utilitas gambar bersama untuk semua aset in-game (dibuat sendiri, prosedural). */
export const INK = "#2b2623";
export const C = {
  ink: INK,
  green: "#3f9a55",
  greenLight: "#7cc48a",
  greenDark: "#2c7442",
  cream: "#f7f5ec",
  wood: "#c99a66",
  woodLight: "#ddb684",
  woodDark: "#9a6d43",
  shadow: "rgba(30,24,20,0.20)",
  wallCap: "#28343b",
  wallCapLight: "#43515a",
  wallFace: "#ece7df",
  wallFaceDark: "#e2dcd2",
  baseboard: "#a89478",
  glass: "#bfe0ea",
  terracotta: "#c97a52",
};

/** Hash deterministik 0..1 untuk variasi (warna papan, jenis tanaman, dll.). */
export function hash(...n: number[]): number {
  let h = 2166136261;
  for (const v of n) {
    h ^= Math.floor(v * 1000) | 0;
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967295;
}

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return hash(h);
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}

/** Isi + garis tepi tinta, gaya kartun. */
export function fillStroke(
  ctx: CanvasRenderingContext2D,
  fill: string | CanvasGradient,
  lw = 2,
  stroke: string = INK,
) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/** Bayangan lunak elips di lantai. */
export function groundShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha = 0.2,
) {
  // Dua elips bertumpuk: tepi lembut tanpa gradien (murah untuk digambar tiap frame).
  ctx.fillStyle = `rgba(30,24,20,${alpha * 0.5})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.7, ry * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Bayangan kotak lembut di bawah perabot (offset ke kanan bawah). */
export function boxShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 6) {
  ctx.save();
  ctx.fillStyle = "rgba(30,24,20,0.16)";
  rr(ctx, x + 3, y + 5, w, h, r);
  ctx.fill();
  ctx.restore();
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
