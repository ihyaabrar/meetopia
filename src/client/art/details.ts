/** World-specific furniture, rendered locally so it stays crisp at every zoom level. */
import { TILE, type MapObject } from "@/shared/map";
import { C, INK, fillStroke, rr, groundShadow, shade } from "./common";

export function drawDetail(ctx: CanvasRenderingContext2D, o: MapObject): boolean {
  const x = o.x * TILE,
    y = o.y * TILE,
    w = o.w * TILE,
    h = o.h * TILE;
  const cx = x + w / 2;
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  switch (o.kind) {
    case "palm": {
      groundShadow(ctx, cx, y + 27, 23, 7);
      rr(ctx, x + 4, y + 10, w - 8, 19, 5);
      fillStroke(ctx, "#d7c6a5");
      ctx.strokeStyle = "#73553a";
      ctx.lineWidth = 5;
      line(cx, y + 17, cx - 3, y - 26);
      for (let i = 0; i < 9; i++) {
        const a = (i * Math.PI * 2) / 9,
          ex = cx + Math.cos(a) * 32,
          ey = y - 27 + Math.sin(a) * 21;
        ctx.beginPath();
        ctx.moveTo(cx, y - 27);
        ctx.quadraticCurveTo(ex, ey - 17, ex, ey + 10);
        ctx.quadraticCurveTo(ex - 8, ey - 7, cx, y - 27);
        ctx.fillStyle = i % 2 ? "#668840" : "#3f6b38";
        ctx.fill();
        ctx.strokeStyle = "#2e4f2f";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      break;
    }
    case "parasol": {
      // Pole + canopy at the back of the table, leaving the walkable foreground visible.
      groundShadow(ctx, cx, y + h - 5, w * 0.4, 12, 0.13);
      ctx.strokeStyle = "#88704b";
      ctx.lineWidth = 4;
      line(cx, y + h - 9, cx, y + 9);
      const cy = y + 8,
        rx = w * 0.47,
        ry = Math.min(h * 0.45, 44);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          b = ((i + 1) * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 7);
        ctx.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
        ctx.ellipse(cx, cy, rx, ry, 0, a, b);
        ctx.closePath();
        fillStroke(ctx, i % 2 ? "#e8dfcc" : "#fff2dc", 1.2);
      }
      break;
    }
    case "pergola": {
      // Open beams, foliage and lights: no opaque roof covering the room.
      ctx.strokeStyle = "#6b4730";
      ctx.lineWidth = 8;
      line(x + 7, y + 8, x + 7, y + h - 8);
      line(x + w - 7, y + 8, x + w - 7, y + h - 8);
      for (let xx = x; xx < x + w; xx += 24) {
        ctx.strokeStyle = "#b5834d";
        ctx.lineWidth = 5;
        line(xx, y + 3, xx, y + 24);
      }
      ctx.strokeStyle = "#745034";
      ctx.lineWidth = 7;
      line(x, y + 12, x + w, y + 12);
      ctx.strokeStyle = "#403629";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 18);
      ctx.quadraticCurveTo(cx, y + 54, x + w - 5, y + 18);
      ctx.stroke();
      for (let xx = x + 16; xx < x + w - 10; xx += 26) {
        const ly = y + 21 + Math.sin(((xx - x) / w) * Math.PI) * 17;
        const glow = ctx.createRadialGradient(xx, ly, 0, xx, ly, 17);
        glow.addColorStop(0, "rgba(255,213,123,.55)");
        glow.addColorStop(1, "rgba(255,213,123,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(xx - 17, ly - 17, 34, 34);
        ctx.fillStyle = "#ffe2a0";
        ctx.beginPath();
        ctx.ellipse(xx, ly, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "greenscreen": {
      ctx.strokeStyle = "#343c3a";
      ctx.lineWidth = 4;
      line(x + 7, y + h, x + 7, y - 18);
      line(x + w - 7, y + h, x + w - 7, y - 18);
      rr(ctx, x + 10, y - 16, w - 20, h + 7, 3);
      fillStroke(ctx, "#71c747");
      const g = ctx.createLinearGradient(0, y - 16, 0, y + h);
      g.addColorStop(0, "rgba(255,255,255,.26)");
      g.addColorStop(1, "rgba(0,40,0,.10)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "#26312c";
      line(x, y - 18, x + w, y - 18);
      break;
    }
    case "camera":
    case "softbox": {
      const top = y - 26;
      ctx.strokeStyle = "#333c40";
      ctx.lineWidth = 3;
      line(cx, top + 12, cx, y + 24);
      line(cx, y + 13, x + 3, y + 30);
      line(cx, y + 13, x + w - 3, y + 30);
      if (o.kind === "camera") {
        rr(ctx, x + 1, top, w - 2, 17, 3);
        fillStroke(ctx, "#353f47");
        ctx.beginPath();
        ctx.arc(cx + 5, top + 9, 7, 0, Math.PI * 2);
        fillStroke(ctx, "#72999d");
        rr(ctx, cx - 8, top - 5, 11, 5, 1);
        fillStroke(ctx, "#29353c");
      } else {
        ctx.beginPath();
        ctx.moveTo(x + 2, top);
        ctx.lineTo(x + w - 2, top - 7);
        ctx.lineTo(x + w + 2, top + 15);
        ctx.lineTo(x + 5, top + 21);
        ctx.closePath();
        fillStroke(ctx, "#fff3d8");
      }
      break;
    }
    case "bbq": {
      groundShadow(ctx, cx, y + h - 4, w / 2, 9);
      rr(ctx, x + 6, y + 7, w - 12, h - 12, 7);
      fillStroke(ctx, "#353e40");
      rr(ctx, x + 10, y - 14, w - 20, 21, 5);
      fillStroke(ctx, "#212b30");
      rr(ctx, x + 13, y + 10, w - 26, h * 0.5, 3);
      fillStroke(ctx, "#171f22");
      ctx.strokeStyle = "#999d95";
      ctx.lineWidth = 1;
      for (let xx = x + 18; xx < x + w - 16; xx += 8) line(xx, y + 12, xx, y + h * 0.55);
      for (let i = 0; i < 5; i++) {
        rr(ctx, x + 21 + (i * (w - 45)) / 5, y + 18, 13, 9, 3);
        fillStroke(ctx, i % 2 ? "#a7ac5e" : "#c97d50", 1);
      }
      break;
    }
    case "firepit": {
      groundShadow(ctx, cx, y + h - 4, w / 2, 8);
      ctx.beginPath();
      ctx.ellipse(cx, y + h * 0.55, w * 0.44, h * 0.31, 0, 0, Math.PI * 2);
      fillStroke(ctx, "#786d61");
      ctx.beginPath();
      ctx.ellipse(cx, y + h * 0.48, w * 0.32, h * 0.23, 0, 0, Math.PI * 2);
      fillStroke(ctx, "#34312e");
      const glow = ctx.createRadialGradient(cx, y + 23, 1, cx, y + 23, 42);
      glow.addColorStop(0, "rgba(255,176,65,.5)");
      glow.addColorStop(1, "rgba(255,176,65,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 42, y - 19, 84, 84);
      for (const dx of [-8, 0, 8]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx - 6, y + 34);
        ctx.quadraticCurveTo(cx + dx - 8, y + 21, cx + dx, y + 7);
        ctx.quadraticCurveTo(cx + dx + 10, y + 30, cx + dx + 6, y + 34);
        ctx.fillStyle = dx ? "#f6a34b" : "#ffe6a2";
        ctx.fill();
      }
      break;
    }
    case "foosball": {
      rr(ctx, x + 4, y + 5, w - 8, h - 10, 6);
      fillStroke(ctx, C.woodDark);
      rr(ctx, x + 10, y + 10, w - 20, h - 24, 2);
      fillStroke(ctx, "#467550");
      ctx.strokeStyle = "#dce5c5";
      ctx.lineWidth = 1;
      line(cx, y + 10, cx, y + h - 14);
      for (let i = 1; i < 6; i++) {
        const xx = x + (i * w) / 6;
        ctx.strokeStyle = "#bdc4bf";
        ctx.lineWidth = 2;
        line(xx, y + 3, xx, y + h - 3);
        for (let j = 0; j < 3; j++) {
          rr(ctx, xx - 3, y + 16 + j * 10, 6, 7, 1);
          fillStroke(ctx, i % 2 ? "#dfc98c" : "#384661", 1);
        }
      }
      break;
    }
    case "bath":
    case "sink": {
      rr(ctx, x + 3, y + 3, w - 6, h - 6, o.kind === "bath" ? 18 : 8);
      fillStroke(ctx, "#efeee8");
      rr(ctx, x + 10, y + 9, w - 20, h - 18, 7);
      fillStroke(ctx, shade("#d9e2e0", 0.05), 1);
      ctx.strokeStyle = "#7e9496";
      ctx.lineWidth = 3;
      line(cx, y + 3, cx, y + 12);
      break;
    }
    default:
      ctx.restore();
      return false;
  }
  ctx.restore();
  return true;
}
