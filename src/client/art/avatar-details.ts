import type { AvatarConfig, AvatarActivity, AvatarCondition } from "@/shared/avatar";
import { INK, rr, shade } from "./common";

export function drawClothingDetail(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  x: number,
  y: number,
  w: number,
  h: number,
  s: number,
  back: boolean,
) {
  ctx.save();
  ctx.strokeStyle = shade(a.bodyColor, -0.35);
  ctx.lineWidth = 0.7 * s;
  if (a.outfit === "striped" || a.outfit === "sweater") {
    ctx.strokeStyle = a.outfit === "striped" ? "#f4eee2" : shade(a.bodyColor, 0.18);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - w * 0.4, y + h * (0.3 + i * 0.17));
      ctx.lineTo(x + w * 0.4, y + h * (0.3 + i * 0.17));
      ctx.stroke();
    }
  }
  if (!back && ["shirt", "polo", "blazer"].includes(a.outfit)) {
    ctx.fillStyle = a.outfit === "blazer" ? "#f5f0e6" : shade(a.bodyColor, 0.32);
    ctx.beginPath();
    ctx.moveTo(x - 3 * s, y);
    ctx.lineTo(x, y + 5 * s);
    ctx.lineTo(x + 3 * s, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + 3 * s);
    ctx.lineTo(x, y + h * (a.outfit === "polo" ? 0.6 : 1));
    ctx.stroke();
    for (let i = 0; i < (a.outfit === "polo" ? 2 : 3); i++) {
      ctx.beginPath();
      ctx.arc(x + s, y + (5 + i * 2) * s, 0.45 * s, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
    if (a.outfit === "blazer") {
      ctx.beginPath();
      ctx.moveTo(x - 4 * s, y);
      ctx.lineTo(x - 2 * s, y + 4 * s);
      ctx.lineTo(x, y + 8 * s);
      ctx.lineTo(x + 2 * s, y + 4 * s);
      ctx.lineTo(x + 4 * s, y);
      ctx.stroke();
    }
  }
  if (a.accessory === "backpack" && back) {
    ctx.fillStyle = a.accessoryColor;
    rr(ctx, x - w * 0.43, y + 2 * s, w * 0.86, h, 2 * s);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.stroke();
    rr(ctx, x - w * 0.3, y + h * 0.55, w * 0.6, h * 0.35, s);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHeldProp(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  activity: AvatarActivity,
  x: number,
  y: number,
  s: number,
  t: number,
) {
  const prop =
    activity === "type" ? "laptop" : activity === "read" ? "book" : activity === "coffee" ? "coffee" : a.prop;
  if (!prop || prop === "none") return;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = s;
  if (prop === "laptop") {
    ctx.fillStyle = "#637990";
    rr(ctx, x - 7 * s, y - 5 * s, 14 * s, 9 * s, s);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#b6c4d0";
    ctx.beginPath();
    ctx.arc(x, y - s, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#354453";
    rr(ctx, x - 8 * s, y + 3 * s, 16 * s, 1.5 * s, s);
    ctx.fill();
    ctx.stroke();
    for (const sd of [-1, 1]) {
      ctx.fillStyle = a.skin;
      ctx.beginPath();
      ctx.ellipse(x + sd * 6 * s, y + 4 * s + Math.sin(t * 9 + sd) * 0.3 * s, 2 * s, s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (prop === "book") {
    ctx.fillStyle = "#f7e8ce";
    rr(ctx, x - 7 * s, y - 4 * s, 14 * s, 8 * s, s);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - 4 * s);
    ctx.lineTo(x, y + 4 * s);
    ctx.stroke();
    ctx.strokeStyle = "#a49781";
    ctx.lineWidth = 0.45 * s;
    for (let i = 0; i < 3; i++)
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + sd * s, y + (-2 + i * 2) * s);
        ctx.lineTo(x + sd * 5 * s, y + (-2 + i * 2) * s);
        ctx.stroke();
      }
  } else if (prop === "coffee") {
    ctx.translate(0, activity === "coffee" ? -2 * s - Math.max(0, Math.sin(t * 2)) * 4 * s : 0);
    ctx.fillStyle = "#fbf2df";
    rr(ctx, x + 2 * s, y - 4 * s, 5 * s, 6 * s, s);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 7 * s, y - s, 1.7 * s, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = "#794633";
    ctx.beginPath();
    ctx.ellipse(x + 4.5 * s, y - 4 * s, 2.2 * s, 0.7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(240,240,230,0.6)";
    ctx.beginPath();
    ctx.moveTo(x + 4 * s, y - 6 * s);
    ctx.quadraticCurveTo(x + 6 * s, y - 8 * s, x + 4 * s, y - 10 * s);
    ctx.stroke();
  } else if (prop === "phone") {
    ctx.fillStyle = "#24343f";
    rr(ctx, x + 2 * s, y - 5 * s, 4.5 * s, 8 * s, s);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#8dcbd7";
    rr(ctx, x + 2.7 * s, y - 3.8 * s, 3 * s, 5 * s, 0.5 * s);
    ctx.fill();
  }
  ctx.restore();
}

export function drawCondition(
  ctx: CanvasRenderingContext2D,
  c: AvatarCondition,
  x: number,
  y: number,
  s: number,
) {
  ctx.save();
  ctx.fillStyle = "#f7faf8";
  ctx.strokeStyle = "#344a55";
  ctx.lineWidth = 0.7 * s;
  ctx.beginPath();
  ctx.arc(x, y, 4.8 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (c === "thirsty") {
    ctx.fillStyle = "#56bdf0";
    ctx.beginPath();
    ctx.moveTo(x, y - 3 * s);
    ctx.bezierCurveTo(x - 5 * s, y + 3 * s, x + 5 * s, y + 3 * s, x, y - 3 * s);
    ctx.fill();
    ctx.stroke();
  } else if (c === "hungry") {
    ctx.fillStyle = "#e3ac51";
    ctx.beginPath();
    ctx.ellipse(x, y - s, 3 * s, 2 * s, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7f4834";
    rr(ctx, x - 3 * s, y - s, 6 * s, 1.4 * s, s);
    ctx.fill();
    ctx.fillStyle = "#64ad64";
    rr(ctx, x - 3 * s, y + 0.5 * s, 6 * s, s, s);
    ctx.fill();
    ctx.fillStyle = "#e3ac51";
    rr(ctx, x - 3 * s, y + 1.5 * s, 6 * s, s, s);
    ctx.fill();
  } else if (c === "sleepy") {
    ctx.fillStyle = "#5366a0";
    ctx.font = `bold ${6 * s}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText("zz", x, y + 2 * s);
  } else {
    ctx.fillStyle = "#dc7263";
    rr(ctx, x - 3 * s, y - 1.8 * s, 6 * s, 3.6 * s, 0.7 * s);
    ctx.stroke();
    ctx.fillRect(x - 2.3 * s, y - s, s, 2 * s);
  }
  ctx.restore();
}
