/**
 * Perabot kantor bergaya kartun 3/4 (tampak atas sedikit miring) dengan garis tinta dan bayangan.
 * Semua digambar di koordinat dunia; benda tinggi boleh menjulang sampai SPRITE_PAD_TOP px di atas tapaknya.
 */
import { TILE, type MapObject, type ObjectKind } from "@/shared/map";
import { C, INK, boxShadow, fillStroke, groundShadow, hashStr, rr, shade } from "./common";

const T = TILE;
export const SPRITE_PAD_TOP = 52;
export const SPRITE_PAD_X = 10;

const TALL: ObjectKind[] = [
  "plant",
  "lamp",
  "bookshelf",
  "vending",
  "coffee",
  "cooler",
  "whiteboard",
  "noticeboard",
  "tv",
  "desk",
  "welcome",
];
export const isTall = (k: ObjectKind) => TALL.includes(k);

function woodGrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, base = C.wood) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(base, 0.18));
  g.addColorStop(1, base);
  return g;
}

/** Permukaan meja 3/4: atas terang + muka depan gelap. */
function counter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  topH: number,
  faceH: number,
  base: string,
  r = 6,
) {
  boxShadow(ctx, x, y, w, topH + faceH, r);
  rr(ctx, x, y, w, topH + faceH, r);
  fillStroke(ctx, shade(base, -0.22));
  rr(ctx, x, y, w, topH, r);
  fillStroke(ctx, woodGrad(ctx, y, y + topH, base));
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  rr(ctx, x + 4, y + 2, w - 8, 2, 1);
  ctx.fill();
}

function mug(ctx: CanvasRenderingContext2D, x: number, y: number, color = "#fff") {
  rr(ctx, x - 3.5, y - 4, 7, 7, 2);
  fillStroke(ctx, color, 1.3);
  ctx.beginPath();
  ctx.arc(x + 4.5, y - 0.5, 2, -Math.PI / 2, Math.PI / 2);
  ctx.lineWidth = 1.3;
  ctx.stroke();
}

function leaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(0, -ry, 0, ry);
  g.addColorStop(0, shade(color, 0.2));
  g.addColorStop(1, color);
  fillStroke(ctx, g, 1.5);
  ctx.strokeStyle = "rgba(27,58,42,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-rx * 0.8, 0);
  ctx.lineTo(rx * 0.8, 0);
  ctx.stroke();
  ctx.restore();
}

export function drawObject(ctx: CanvasRenderingContext2D, o: MapObject) {
  const x = o.x * T;
  const y = o.y * T;
  const w = o.w * T;
  const h = o.h * T;
  const v = hashStr(o.id);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  switch (o.kind) {
    case "rug": {
      const colors = ["#9fc7a4", "#e7c39a", "#c9d8e6", "#e8b8a8"];
      const base = colors[Math.floor(v * colors.length)];
      rr(ctx, x + 4, y + 4, w - 8, h - 8, 10);
      ctx.fillStyle = base;
      ctx.fill();
      rr(ctx, x + 10, y + 10, w - 20, h - 20, 7);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = shade(base, -0.12);
      for (let i = 0; i < o.w * 2 - 1; i++) {
        const cx = x + 16 + i * 16;
        if (cx > x + w - 16) break;
        ctx.beginPath();
        ctx.moveTo(cx, y + h / 2 - 7);
        ctx.lineTo(cx + 6, y + h / 2);
        ctx.lineTo(cx, y + h / 2 + 7);
        ctx.lineTo(cx - 6, y + h / 2);
        ctx.fill();
      }
      ctx.strokeStyle = shade(base, -0.2);
      ctx.lineWidth = 1;
      for (let yy = y + 8; yy < y + h - 8; yy += 4) {
        ctx.beginPath();
        ctx.moveTo(x + 1, yy);
        ctx.lineTo(x + 4, yy);
        ctx.moveTo(x + w - 4, yy);
        ctx.lineTo(x + w - 1, yy);
        ctx.stroke();
      }
      break;
    }

    case "desk": {
      counter(ctx, x + 2, y + 2, w - 4, 20, 8, C.wood, 5);
      // Monitor
      const mx = x + w / 2;
      ctx.fillStyle = "#3a403c";
      rr(ctx, mx - 3, y + 2, 6, 10, 2);
      ctx.fill();
      rr(ctx, mx - 8, y + 10, 16, 4, 2);
      fillStroke(ctx, "#4b524d", 1.3);
      rr(ctx, mx - 17, y - 18, 34, 22, 3);
      fillStroke(ctx, "#2b322e", 2);
      const sg = ctx.createLinearGradient(mx - 15, y - 16, mx + 15, y + 2);
      sg.addColorStop(0, "#1f5a3a");
      sg.addColorStop(1, "#2e7f8f");
      ctx.fillStyle = sg;
      ctx.fillRect(mx - 14, y - 15, 28, 16);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      for (let i = 0; i < 4; i++)
        ctx.fillRect(mx - 11 + (i % 2) * 3, y - 12 + i * 3.4, 6 + ((v * 10 + i * 5) % 12), 1.5);
      // Keyboard
      rr(ctx, mx - 10, y + 15, 20, 5, 1.5);
      fillStroke(ctx, "#eef0ec", 1.2);
      // Barang di meja
      mug(ctx, x + 14, y + 13, v > 0.5 ? "#fff" : "#f2c46d");
      if (v > 0.35) {
        ctx.fillStyle = "#fff";
        ctx.save();
        ctx.translate(x + w - 18, y + 10);
        ctx.rotate(0.15);
        ctx.fillRect(-6, -5, 12, 9);
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.strokeRect(-6, -5, 12, 9);
        ctx.restore();
      } else {
        rr(ctx, x + w - 22, y + 8, 8, 7, 2);
        fillStroke(ctx, C.terracotta, 1.2);
        leaf(ctx, x + w - 20, y + 5, 4, 2, -0.6, C.green);
        leaf(ctx, x + w - 15, y + 5, 4, 2, 0.6, C.green);
      }
      break;
    }

    case "chair": {
      const cx = x + T / 2;
      const facingUp = o.facing !== "down";
      groundShadow(ctx, cx, y + T - 4, 11, 4, 0.22);
      // kaki beroda
      ctx.strokeStyle = "#3a403c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 8, y + T - 5);
      ctx.lineTo(cx + 8, y + T - 5);
      ctx.moveTo(cx, y + T - 9);
      ctx.lineTo(cx, y + T - 4);
      ctx.stroke();
      const seat = "#3f7a59";
      const backY = facingUp ? y + 18 : y + 2;
      if (!facingUp) {
        rr(ctx, cx - 10, backY, 20, 9, 4);
        fillStroke(ctx, shade(seat, -0.15), 1.6);
      }
      rr(ctx, cx - 9, y + 8, 18, 14, 5);
      fillStroke(ctx, seat, 1.6);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      rr(ctx, cx - 6, y + 10, 12, 3, 1.5);
      ctx.fill();
      if (facingUp) {
        rr(ctx, cx - 10, backY, 20, 9, 4);
        fillStroke(ctx, shade(seat, -0.15), 1.6);
      }
      break;
    }

    case "table": {
      const big = o.w > 4;
      counter(ctx, x + 4, y + 4, w - 8, h - 14, 8, big ? "#b98a5a" : C.woodLight, big ? 20 : 12);
      if (big) {
        // laptop, kertas, cangkir di sepanjang meja
        for (let i = 0; i < o.w - 2; i += 2) {
          const lx = x + 30 + i * T;
          rr(ctx, lx, y + 18, 18, 12, 2);
          fillStroke(ctx, "#d7dcd8", 1.3);
          ctx.fillStyle = "#2e7f8f";
          ctx.fillRect(lx + 3, y + 20, 12, 7);
          ctx.fillStyle = "#fff";
          ctx.save();
          ctx.translate(lx + 10, y + h - 30);
          ctx.rotate(-0.12 + i * 0.05);
          ctx.fillRect(-7, -5, 14, 10);
          ctx.restore();
          mug(ctx, lx + 34, y + h - 30, i % 4 === 0 ? "#f2c46d" : "#fff");
        }
        ctx.fillStyle = C.greenLight;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2 - 4, 8, 0, Math.PI * 2);
        fillStroke(ctx, C.greenLight, 1.4);
      } else {
        // meja kopi: majalah + tanaman kecil
        ctx.fillStyle = "#e9605a";
        ctx.save();
        ctx.translate(x + 26, y + 22);
        ctx.rotate(-0.2);
        ctx.fillRect(-9, -6, 18, 12);
        ctx.fillStyle = "#fff";
        ctx.fillRect(-6, -3, 10, 2);
        ctx.restore();
        mug(ctx, x + w - 26, y + 20);
        rr(ctx, x + w / 2 - 5, y + 14, 10, 8, 2);
        fillStroke(ctx, C.terracotta, 1.2);
        leaf(ctx, x + w / 2 - 3, y + 11, 5, 2.5, -0.7, C.green);
        leaf(ctx, x + w / 2 + 3, y + 11, 5, 2.5, 0.7, C.green);
      }
      break;
    }

    case "sofa": {
      const base = v > 0.5 ? "#4f9a6a" : "#5d8fb5";
      boxShadow(ctx, x + 2, y - 6, w - 4, T + 2, 10);
      // sandaran
      rr(ctx, x + 2, y - 8, w - 4, 16, 8);
      fillStroke(ctx, shade(base, -0.12));
      // dudukan
      rr(ctx, x + 6, y + 4, w - 12, 20, 6);
      fillStroke(ctx, base);
      for (let i = 0; i < o.w; i++) {
        rr(ctx, x + 8 + i * ((w - 16) / o.w), y + 6, (w - 16) / o.w - 3, 14, 5);
        fillStroke(ctx, shade(base, 0.15), 1.2);
      }
      // lengan
      for (const ax of [x + 1, x + w - 11]) {
        rr(ctx, ax, y - 2, 10, 26, 5);
        fillStroke(ctx, shade(base, -0.05));
      }
      // bantal
      rr(ctx, x + 12, y - 4, 12, 10, 4);
      fillStroke(ctx, "#f2c46d", 1.3);
      break;
    }

    case "beanbag": {
      const colors = ["#e0a33a", "#d9605a", "#3aa6a0", "#8a63c9"];
      const base = colors[Math.floor(v * colors.length)];
      groundShadow(ctx, x + T / 2, y + T - 4, 15, 5, 0.25);
      ctx.beginPath();
      ctx.moveTo(x + 3, y + T - 6);
      ctx.bezierCurveTo(x, y + 8, x + 10, y + 1, x + T / 2, y + 2);
      ctx.bezierCurveTo(x + T - 8, y + 1, x + T, y + 10, x + T - 3, y + T - 6);
      ctx.quadraticCurveTo(x + T / 2, y + T + 1, x + 3, y + T - 6);
      const g = ctx.createRadialGradient(x + 12, y + 10, 2, x + T / 2, y + T / 2, T * 0.7);
      g.addColorStop(0, shade(base, 0.3));
      g.addColorStop(1, base);
      fillStroke(ctx, g, 1.8);
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x + T / 2, y + T / 2 + 2, 7, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      break;
    }

    case "plant": {
      const cx = x + T / 2;
      groundShadow(ctx, cx + 2, y + T - 3, 12, 4, 0.25);
      const type = Math.floor(v * 3);
      // daun
      if (type === 0) {
        // semak bulat
        for (const [dx, dy, r, c] of [
          [-7, -6, 8, C.greenDark],
          [7, -6, 8, C.greenDark],
          [0, -14, 9, C.green],
          [-6, -2, 7, C.green],
          [6, -2, 7, C.green],
          [0, -4, 8, C.greenLight],
        ] as const) {
          ctx.beginPath();
          ctx.arc(cx + dx, y + 8 + dy, r, 0, Math.PI * 2);
          fillStroke(ctx, c, 1.5);
        }
      } else if (type === 1) {
        // monstera
        for (const [dx, dy, rot, c] of [
          [-9, -6, -0.9, C.greenDark],
          [9, -6, 0.9, C.greenDark],
          [-6, -16, -0.4, C.green],
          [6, -16, 0.4, C.green],
          [0, -22, 0, C.greenLight],
        ] as const) {
          leaf(ctx, cx + dx, y + 6 + dy, 9, 5.5, rot + Math.PI / 2, c);
        }
      } else {
        // lidah mertua
        for (const [dx, hgt, c] of [
          [-6, 26, C.greenDark],
          [6, 24, C.greenDark],
          [-2, 34, C.green],
          [3, 30, C.greenLight],
        ] as const) {
          ctx.beginPath();
          ctx.moveTo(cx + dx - 4, y + 14);
          ctx.quadraticCurveTo(cx + dx - 3, y + 14 - hgt * 0.6, cx + dx, y + 14 - hgt);
          ctx.quadraticCurveTo(cx + dx + 3, y + 14 - hgt * 0.6, cx + dx + 4, y + 14);
          ctx.closePath();
          fillStroke(ctx, c, 1.4);
          ctx.strokeStyle = "rgba(240,230,140,0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx + dx - 3, y + 12);
          ctx.quadraticCurveTo(cx + dx - 2, y + 12 - hgt * 0.5, cx + dx, y + 14 - hgt + 2);
          ctx.stroke();
        }
      }
      // pot
      ctx.beginPath();
      ctx.moveTo(cx - 9, y + 12);
      ctx.lineTo(cx + 9, y + 12);
      ctx.lineTo(cx + 7, y + T - 3);
      ctx.lineTo(cx - 7, y + T - 3);
      ctx.closePath();
      const pg = ctx.createLinearGradient(cx - 9, 0, cx + 9, 0);
      pg.addColorStop(0, shade(C.terracotta, 0.12));
      pg.addColorStop(1, shade(C.terracotta, -0.15));
      fillStroke(ctx, pg, 1.6);
      rr(ctx, cx - 10.5, y + 10, 21, 5, 2);
      fillStroke(ctx, shade(C.terracotta, 0.05), 1.6);
      break;
    }

    case "lamp": {
      const cx = x + T / 2;
      groundShadow(ctx, cx, y + T - 5, 9, 3.5, 0.25);
      ctx.beginPath();
      ctx.ellipse(cx, y + T - 6, 7, 3, 0, 0, Math.PI * 2);
      fillStroke(ctx, "#3a403c", 1.4);
      ctx.strokeStyle = "#3a403c";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, y + T - 7);
      ctx.lineTo(cx, y - 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 6, y - 30);
      ctx.lineTo(cx + 6, y - 30);
      ctx.lineTo(cx + 11, y - 14);
      ctx.lineTo(cx - 11, y - 14);
      ctx.closePath();
      const lg = ctx.createLinearGradient(0, y - 30, 0, y - 14);
      lg.addColorStop(0, "#fff5d8");
      lg.addColorStop(1, "#f3d79b");
      fillStroke(ctx, lg, 1.6);
      break;
    }

    case "bookshelf": {
      const top = y - 26;
      const H = T + 26 - 2;
      boxShadow(ctx, x + 2, top, w - 4, H, 4);
      rr(ctx, x + 2, top, w - 4, H, 4);
      fillStroke(ctx, woodGrad(ctx, top, top + H, C.woodDark));
      const shelves = 3;
      const sh = (H - 8) / shelves;
      const bookColors = ["#d9605a", "#4a7fc1", "#e0a33a", "#3f9a55", "#8a63c9", "#3aa6a0", "#f2efe6"];
      for (let s = 0; s < shelves; s++) {
        const sy = top + 4 + s * sh;
        ctx.fillStyle = shade(C.woodDark, -0.35);
        ctx.fillRect(x + 6, sy, w - 12, sh - 3);
        let bx = x + 7;
        let i = 0;
        while (bx < x + w - 10) {
          const bw = 4 + ((v * 97 + s * 13 + i * 7) % 4);
          const bh = sh - 6 - ((v * 31 + i * 11 + s) % 5);
          ctx.fillStyle = bookColors[(Math.floor(v * 10) + i + s * 2) % bookColors.length];
          ctx.fillRect(bx, sy + sh - 3 - bh, bw, bh);
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillRect(bx + 1, sy + sh - bh, 1, bh - 6);
          bx += bw + 1;
          i++;
        }
        ctx.fillStyle = shade(C.woodDark, 0.1);
        ctx.fillRect(x + 5, sy + sh - 3, w - 10, 3);
      }
      break;
    }

    case "whiteboard":
    case "noticeboard": {
      const top = y - 22;
      ctx.strokeStyle = "#5a615c";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 10, top + 26);
      ctx.lineTo(x + 8, y + T - 4);
      ctx.moveTo(x + w - 10, top + 26);
      ctx.lineTo(x + w - 8, y + T - 4);
      ctx.stroke();
      groundShadow(ctx, x + w / 2, y + T - 4, w / 2 - 4, 4, 0.18);
      rr(ctx, x + 2, top, w - 4, 32, 4);
      fillStroke(ctx, o.kind === "whiteboard" ? "#b9c0bb" : C.woodDark, 2);
      if (o.kind === "whiteboard") {
        rr(ctx, x + 5, top + 3, w - 10, 26, 2);
        ctx.fillStyle = "#fbfdfb";
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = C.green;
        ctx.beginPath();
        ctx.moveTo(x + 12, top + 10);
        ctx.lineTo(x + 40, top + 10);
        ctx.moveTo(x + 12, top + 16);
        ctx.lineTo(x + 54, top + 16);
        ctx.stroke();
        ctx.strokeStyle = "#d9605a";
        ctx.beginPath();
        ctx.arc(x + w - 22, top + 15, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#4a7fc1";
        ctx.beginPath();
        ctx.moveTo(x + 12, top + 23);
        ctx.lineTo(x + 22, top + 21);
        ctx.lineTo(x + 30, top + 24);
        ctx.lineTo(x + 40, top + 20);
        ctx.stroke();
        ctx.fillStyle = "#fff6a8";
        ctx.fillRect(x + w - 40, top + 6, 9, 9);
        ctx.fillStyle = "#888";
        ctx.fillRect(x + 8, top + 30, w - 16, 3);
      } else {
        rr(ctx, x + 5, top + 3, w - 10, 26, 2);
        ctx.fillStyle = "#d8b07c";
        ctx.fill();
        for (const [dx, dy, c, rot] of [
          [10, 6, "#fff6a8", -0.1],
          [34, 8, "#bfe6c6", 0.08],
          [58, 5, "#ffd3c4", -0.05],
          [22, 16, "#d6e4ff", 0.1],
          [48, 17, "#fff", -0.06],
        ] as const) {
          if (x + dx + 14 > x + w - 5) continue;
          ctx.save();
          ctx.translate(x + dx + 7, top + dy + 5);
          ctx.rotate(rot);
          ctx.fillStyle = c;
          ctx.fillRect(-7, -5, 14, 11);
          ctx.fillStyle = "#d9605a";
          ctx.beginPath();
          ctx.arc(0, -4, 1.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      break;
    }

    case "vending": {
      const top = y - 28;
      const H = T + 28 - 2;
      boxShadow(ctx, x + 3, top, w - 6, H, 6);
      rr(ctx, x + 3, top, w - 6, H, 6);
      const bg = ctx.createLinearGradient(x, 0, x + w, 0);
      bg.addColorStop(0, "#e2675f");
      bg.addColorStop(1, "#c24c45");
      fillStroke(ctx, bg);
      rr(ctx, x + 7, top + 5, w - 26, H - 16, 3);
      fillStroke(ctx, "#20302a", 1.5);
      const cols = ["#f2c46d", "#7cc48a", "#6fb6e0", "#ffd3c4", "#fff"];
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 3; c++) {
          ctx.fillStyle = cols[(r * 3 + c) % cols.length];
          rr(ctx, x + 10 + c * 10, top + 9 + r * 10, 7, 7, 2);
          ctx.fill();
        }
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(x + 9, top + 6, 4, H - 20);
      rr(ctx, x + w - 17, top + 10, 10, 18, 2);
      fillStroke(ctx, "#f6f0ea", 1.3);
      ctx.fillStyle = "#20302a";
      ctx.fillRect(x + w - 15, top + 14, 6, 3);
      rr(ctx, x + 10, y + T - 12, w - 30, 6, 2);
      fillStroke(ctx, "#20302a", 1.2);
      break;
    }

    case "coffee": {
      counter(ctx, x + 2, y + 2, w - 4, 16, 12, "#cfd6d2", 4);
      const mx = x + w / 2 - 6;
      rr(ctx, mx - 10, y - 22, 22, 30, 4);
      fillStroke(ctx, "#4b524d");
      rr(ctx, mx - 6, y - 18, 14, 8, 2);
      fillStroke(ctx, "#2e7f8f", 1.2);
      ctx.fillStyle = "#e9605a";
      ctx.beginPath();
      ctx.arc(mx + 7, y - 4, 2, 0, Math.PI * 2);
      ctx.fill();
      mug(ctx, mx + 1, y + 6, "#fff");
      mug(ctx, x + w - 14, y + 10, "#f2c46d");
      mug(ctx, x + w - 24, y + 12, "#fff");
      // uap
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mx + 1, y);
      ctx.bezierCurveTo(mx - 3, y - 4, mx + 5, y - 7, mx + 1, y - 11);
      ctx.stroke();
      break;
    }

    case "cooler": {
      const cx = x + T / 2;
      groundShadow(ctx, cx, y + T - 4, 11, 4, 0.25);
      rr(ctx, cx - 9, y - 6, 18, T + 3, 4);
      fillStroke(ctx, "#eef1ee");
      ctx.fillStyle = "#5a615c";
      ctx.fillRect(cx - 5, y + 8, 10, 4);
      ctx.fillStyle = "#4a7fc1";
      ctx.fillRect(cx - 4, y + 2, 3, 4);
      ctx.fillStyle = "#d9605a";
      ctx.fillRect(cx + 1, y + 2, 3, 4);
      // galon
      rr(ctx, cx - 8, y - 28, 16, 22, 6);
      const gg = ctx.createLinearGradient(cx - 8, 0, cx + 8, 0);
      gg.addColorStop(0, "rgba(160,215,240,0.95)");
      gg.addColorStop(1, "rgba(100,170,215,0.95)");
      fillStroke(ctx, gg, 1.6);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(cx - 5, y - 24, 2, 14);
      break;
    }

    case "tv": {
      const cab = y + 10;
      counter(ctx, x + 6, cab, w - 12, 8, 10, C.woodDark, 4);
      ctx.fillStyle = "#3a403c";
      ctx.fillRect(x + w / 2 - 3, y + 2, 6, 10);
      rr(ctx, x + 2, y - 26, w - 4, 30, 4);
      fillStroke(ctx, "#232a26", 2);
      const sg = ctx.createLinearGradient(x, y - 24, x + w, y + 2);
      sg.addColorStop(0, "#2a6f8a");
      sg.addColorStop(1, "#1f5a3a");
      ctx.fillStyle = sg;
      ctx.fillRect(x + 6, y - 22, w - 12, 22);
      // logo pintu Meetopia di layar
      const lx = x + w / 2;
      ctx.fillStyle = C.greenLight;
      ctx.beginPath();
      ctx.moveTo(lx - 9, y - 16);
      ctx.lineTo(lx - 2, y - 18);
      ctx.lineTo(lx - 2, y - 4);
      ctx.lineTo(lx - 9, y - 6);
      ctx.fill();
      ctx.fillStyle = "#eef5ea";
      ctx.fillRect(lx, y - 18, 8, 14);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.moveTo(x + 6, y - 22);
      ctx.lineTo(x + 30, y - 22);
      ctx.lineTo(x + 14, y);
      ctx.lineTo(x + 6, y);
      ctx.fill();
      break;
    }

    case "welcome": {
      // Meja resepsionis dengan logo
      boxShadow(ctx, x + 2, y - 8, w - 4, T + 4, 12);
      rr(ctx, x + 2, y - 8, w - 4, 14, 8);
      fillStroke(ctx, "#f4efe2");
      rr(ctx, x + 2, y + 2, w - 4, T - 6, 6);
      const fg = ctx.createLinearGradient(0, y, 0, y + T);
      fg.addColorStop(0, C.green);
      fg.addColorStop(1, C.greenDark);
      fillStroke(ctx, fg);
      // logo pintu
      const lx = x + 18;
      const ly = y + 7;
      ctx.fillStyle = C.greenLight;
      ctx.beginPath();
      ctx.moveTo(lx, ly + 2);
      ctx.lineTo(lx + 6, ly);
      ctx.lineTo(lx + 6, ly + 16);
      ctx.lineTo(lx, ly + 14);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(lx + 8, ly, 7, 16);
      ctx.fillStyle = C.green;
      ctx.beginPath();
      ctx.arc(lx + 10, ly + 8, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 12px Outfit, system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("Meetopia", lx + 21, ly + 9);
      // barang di meja
      mug(ctx, x + w - 16, y - 2, "#f2c46d");
      break;
    }

    case "art": {
      // lukisan di muka dinding
      const fx = x + 6;
      const fy = y + 11;
      const fw = w - 12;
      const fh = T - 18;
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(fx + 2, fy + 2, fw, fh);
      rr(ctx, fx, fy, fw, fh, 1);
      fillStroke(ctx, "#fff", 1.5);
      const ix = fx + 2;
      const iy = fy + 2;
      const iw = fw - 4;
      const ih = fh - 4;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ix, iy, iw, ih);
      ctx.clip();
      if (v > 0.5) {
        const sky = ctx.createLinearGradient(0, iy, 0, iy + ih);
        sky.addColorStop(0, "#f7e3b5");
        sky.addColorStop(1, "#f2c9a0");
        ctx.fillStyle = sky;
        ctx.fillRect(ix, iy, iw, ih);
        ctx.fillStyle = "#e9905a";
        ctx.beginPath();
        ctx.arc(ix + iw * 0.7, iy + ih * 0.45, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.green;
        ctx.beginPath();
        ctx.ellipse(ix + iw * 0.3, iy + ih, iw * 0.5, ih * 0.55, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = C.greenDark;
        ctx.beginPath();
        ctx.ellipse(ix + iw * 0.85, iy + ih, iw * 0.4, ih * 0.4, 0, Math.PI, 0);
        ctx.fill();
      } else {
        ctx.fillStyle = "#eef5ea";
        ctx.fillRect(ix, iy, iw, ih);
        ctx.fillStyle = "#4a7fc1";
        ctx.fillRect(ix + 4, iy + 2, iw * 0.3, ih - 4);
        ctx.fillStyle = "#e0a33a";
        ctx.beginPath();
        ctx.arc(ix + iw * 0.65, iy + ih * 0.5, ih * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#d9605a";
        ctx.fillRect(ix + iw * 0.78, iy + ih * 0.2, iw * 0.15, ih * 0.6);
      }
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(fx, fy, fw, fh);
      break;
    }
  }
  ctx.restore();
}
