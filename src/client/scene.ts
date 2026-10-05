/**
 * Renderer adegan ruangan: lantai, sprite + avatar diurutkan kedalamannya, efek (riak klik, debu langkah,
 * emote, balon chat), garis koneksi suara, sorotan ruang privat, cahaya lampu, dan label nama.
 * Terpisah dari React agar loop gambar ringan dan mudah dirawat.
 */
import { TILE, type MapData, type MapObject, type Zone } from "@/shared/map";
import type { Presence } from "@/shared/protocol";
import { drawAvatar } from "./art/avatar";
import { renderWorld, type WorldLayers } from "./art/world";
import { C, INK } from "./art/common";

export interface PersonView {
  p: Presence;
  x: number;
  y: number;
  phase: number;
  /** 0..1, level suara terhalus. */
  speaking: number;
  isSelf: boolean;
  seed: number;
}

export interface SceneFrame {
  w: number;
  h: number;
  dpr: number;
  cam: { x: number; y: number; zoom: number };
  time: number;
  people: PersonView[];
  self: PersonView | null;
  target: { x: number; y: number } | null;
  hoverTile: { x: number; y: number } | null;
  focusObj: MapObject | null;
  links: Array<{ x: number; y: number; volume: number }>;
  privateZone: Zone | null;
  showRadius: boolean;
}

const T = TILE;
const STATUS_COLOR = { active: "#4fae63", busy: "#d2554a", meeting: "#8a63c9", away: "#e0a33a" } as const;
const FOOT = 8; // offset kaki avatar dari pusat tile (px)

interface Timed {
  x: number;
  y: number;
  t0: number;
}

export class Scene {
  layers: WorldLayers;
  private ripples: Timed[] = [];
  private puffs: Timed[] = [];
  private emotes = new Map<string, { emoji: string; t0: number }>();
  private bubbles = new Map<string, { lines: string[]; t0: number }>();
  private measure: CanvasRenderingContext2D;
  private lightSprites = new Map<string, HTMLCanvasElement>();
  private vignette: { w: number; h: number; c: HTMLCanvasElement } | null = null;

  /** Gradien cahaya dirender sekali lalu dipakai ulang (lebih ringan daripada gradien per frame). */
  private lightSprite(color: string, r: number): HTMLCanvasElement {
    const key = `${color}|${r}`;
    let c = this.lightSprites.get(key);
    if (!c) {
      c = document.createElement("canvas");
      c.width = c.height = r * 2;
      const x = c.getContext("2d")!;
      const g = x.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, `rgba(${color},0.16)`);
      g.addColorStop(1, `rgba(${color},0)`);
      x.fillStyle = g;
      x.fillRect(0, 0, r * 2, r * 2);
      this.lightSprites.set(key, c);
    }
    return c;
  }

  constructor(
    public map: MapData,
    zoneLabel: (k: string) => string,
  ) {
    this.layers = renderWorld(map, zoneLabel);
    this.measure = document.createElement("canvas").getContext("2d")!;
  }

  ripple(x: number, y: number, t: number) {
    this.ripples.push({ x, y, t0: t });
  }
  puff(x: number, y: number, t: number) {
    if (this.puffs.length < 60) this.puffs.push({ x, y, t0: t });
  }
  emote(id: string, emoji: string, t: number) {
    this.emotes.set(id, { emoji, t0: t });
  }
  bubble(id: string, text: string, t: number) {
    this.measure.font = "500 12px Outfit, system-ui, sans-serif";
    const words = text.replace(/\s+/g, " ").trim().split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (this.measure.measureText(next).width > 150 && cur) {
        lines.push(cur);
        cur = w;
      } else cur = next;
      if (lines.length === 3) break;
    }
    if (lines.length < 3 && cur) lines.push(cur);
    if (lines.length === 3 && words.join(" ").length > lines.join(" ").length)
      lines[2] = lines[2].slice(0, 18) + "…";
    this.bubbles.set(id, { lines: lines.map((l) => (l.length > 28 ? l.slice(0, 27) + "…" : l)), t0: t });
  }

  draw(ctx: CanvasRenderingContext2D, f: SceneFrame) {
    const { dpr, cam, time } = f;
    const scale = cam.zoom * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#16301f";
    ctx.fillRect(0, 0, f.w * dpr, f.h * dpr);
    ctx.setTransform(scale, 0, 0, scale, -cam.x * scale, -cam.y * scale);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.layers.floor, 0, 0);

    // Sorot tile di bawah kursor
    if (f.hoverTile && !f.focusObj) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(f.hoverTile.x * T + 2, f.hoverTile.y * T + 2, T - 4, T - 4, 6);
      ctx.fill();
      ctx.stroke();
    }

    // Radius suara di sekitar diri sendiri
    const me = f.self;
    if (me && !f.privateZone) {
      const r = this.map.audio.radius * T;
      const g = ctx.createRadialGradient(me.x * T, me.y * T, r * 0.2, me.x * T, me.y * T, r);
      const a = f.showRadius ? 0.14 : 0.05;
      g.addColorStop(0, `rgba(124,196,138,${a})`);
      g.addColorStop(0.85, `rgba(124,196,138,${a * 0.8})`);
      g.addColorStop(1, "rgba(124,196,138,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(me.x * T, me.y * T, r, 0, Math.PI * 2);
      ctx.fill();
      if (f.showRadius) {
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -time * 12;
        ctx.strokeStyle = "rgba(63,154,85,0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Garis koneksi suara ke orang yang terdengar
    if (me) {
      for (const l of f.links) {
        ctx.strokeStyle = `rgba(63,154,85,${0.25 + l.volume * 0.5})`;
        ctx.lineWidth = 1.5 + l.volume * 1.5;
        ctx.setLineDash([3, 6]);
        ctx.lineDashOffset = -time * 18;
        ctx.beginPath();
        ctx.moveTo(me.x * T, me.y * T + FOOT - 4);
        ctx.lineTo(l.x * T, l.y * T + FOOT - 4);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Penanda tujuan & riak klik
    if (f.target) {
      const tx = (f.target.x + 0.5) * T;
      const ty = (f.target.y + 0.5) * T + 6;
      const p = (Math.sin(time * 6) + 1) / 2;
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(tx, ty, 8 + p * 3, 3.5 + p * 1.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(63,154,85,0.25)";
      ctx.fill();
    }
    this.ripples = this.ripples.filter((r) => time - r.t0 < 0.6);
    for (const r of this.ripples) {
      const k = (time - r.t0) / 0.6;
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.ellipse(r.x * T, r.y * T, 6 + k * 18, 3 + k * 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Debu langkah
    this.puffs = this.puffs.filter((p) => time - p.t0 < 0.5);
    for (const p of this.puffs) {
      const k = (time - p.t0) / 0.5;
      ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(p.x * T, p.y * T + FOOT - 2 - k * 4, 2 + k * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sprite tinggi + avatar, diurutkan dari atas ke bawah
    type Item = { y: number; draw: () => void };
    const items: Item[] = this.layers.sprites.map((s) => ({
      y: s.sortY,
      draw: () => ctx.drawImage(s.canvas, s.x, s.y),
    }));
    for (const v of f.people) items.push({ y: v.y * T + FOOT, draw: () => this.drawPerson(ctx, v, time) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // Objek yang sedang disorot (bisa diinteraksi)
    if (f.focusObj) {
      const o = f.focusObj;
      const pulse = (Math.sin(time * 4) + 1) / 2;
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -time * 10;
      ctx.beginPath();
      ctx.roundRect(o.x * T - 2, o.y * T - 2, o.w * T + 4, o.h * T + 4, 10);
      ctx.stroke();
      ctx.restore();
    }

    // Cahaya lampu & layar
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const l of this.layers.lights) {
      ctx.globalAlpha = 0.9 + Math.sin(time * 2 + l.x) * 0.08;
      ctx.drawImage(this.lightSprite(l.color, l.r), l.x - l.r, l.y - l.r);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Sorotan ruang privat: area lain diredupkan
    if (f.privateZone) {
      const z = f.privateZone;
      ctx.save();
      ctx.fillStyle = "rgba(8,20,12,0.55)";
      ctx.beginPath();
      ctx.rect(-T * 4, -T * 4, (this.map.width + 8) * T, (this.map.height + 8) * T);
      ctx.roundRect(z.x * T, z.y * T - 4, z.w * T, z.h * T + 8, 12);
      ctx.fill("evenodd");
      ctx.restore();
    }

    // Label nama, emote, balon chat (selalu di atas). Label yang bertabrakan digeser ke atas.
    ctx.font = "600 11px Outfit, system-ui, sans-serif";
    const placed: Array<{ x0: number; x1: number; y: number }> = [];
    const ordered = [...f.people].sort((a, b) => b.y - a.y);
    for (const v of ordered) {
      const half = (ctx.measureText(v.p.name).width + 42 + (v.p.media.screen ? 14 : 0)) / 2;
      const x0 = v.x * T - half;
      const x1 = v.x * T + half;
      let ly = v.y * T + FOOT - (v.p.sitting ? 4 : 0) - 58;
      for (let guard = 0; guard < 8; guard++) {
        const hit = placed.find((r) => x0 < r.x1 && x1 > r.x0 && Math.abs(ly - r.y) < 22);
        if (!hit) break;
        ly = hit.y - 23;
      }
      placed.push({ x0, x1, y: ly });
      this.drawLabels(ctx, v, time, ly);
    }

    // Vignette layar
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const W = Math.round(f.w * dpr);
    const H = Math.round(f.h * dpr);
    if (!this.vignette || this.vignette.w !== W || this.vignette.h !== H) {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const x = c.getContext("2d")!;
      const vg = x.createRadialGradient(
        W / 2,
        H / 2,
        Math.min(W, H) * 0.45,
        W / 2,
        H / 2,
        Math.max(W, H) * 0.75,
      );
      vg.addColorStop(0, "rgba(10,25,15,0)");
      vg.addColorStop(1, "rgba(10,25,15,0.28)");
      x.fillStyle = vg;
      x.fillRect(0, 0, W, H);
      this.vignette = { w: W, h: H, c };
    }
    ctx.drawImage(this.vignette.c, 0, 0);
  }

  private drawPerson(ctx: CanvasRenderingContext2D, v: PersonView, time: number) {
    const px = v.x * T;
    const py = v.y * T + FOOT;
    const p = v.p;
    // Cincin sedang bicara
    if (v.speaking > 0.08 && p.media.mic) {
      const k = Math.min(1, v.speaking);
      ctx.save();
      ctx.strokeStyle = `rgba(79,174,99,${0.5 + k * 0.5})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(px, py, 14 + k * 4, 5.5 + k * 1.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (p.status === "busy") {
      ctx.strokeStyle = "rgba(210,85,74,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(px, py, 14, 5.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (v.isSelf) {
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(px, py, 14, 5.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = p.status === "away" ? 0.55 : 1;
    drawAvatar(ctx, p.avatar, px, py, 1.08, {
      dir: p.dir,
      walk: v.phase,
      sitting: p.sitting,
      time,
      seed: v.seed,
    });
    ctx.globalAlpha = 1;
    if (p.status === "away") {
      // "zzz" melayang
      ctx.fillStyle = "rgba(27,58,42,0.7)";
      ctx.font = "700 10px Outfit, system-ui, sans-serif";
      const k = (time * 0.6 + v.seed) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.fillText("z", px + 12 + k * 6, py - 40 - k * 10);
      ctx.globalAlpha = 1;
    }
  }

  private drawLabels(ctx: CanvasRenderingContext2D, v: PersonView, time: number, ly: number) {
    const p = v.p;
    const px = v.x * T;
    ctx.save();
    ctx.font = "600 11px Outfit, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(p.name).width;
    const extra = p.media.screen ? 14 : 0;
    const bw = tw + 42 + extra;
    const bx = px - bw / 2;
    ctx.fillStyle = "rgba(10,25,15,0.18)";
    ctx.beginPath();
    ctx.roundRect(bx, ly - 8, bw, 20, 10);
    ctx.fill();
    ctx.fillStyle = v.isSelf ? "rgba(27,58,42,0.95)" : "rgba(255,255,255,0.97)";
    ctx.beginPath();
    ctx.roundRect(bx, ly - 10, bw, 20, 10);
    ctx.fill();
    // status
    ctx.fillStyle = STATUS_COLOR[p.status];
    ctx.beginPath();
    ctx.arc(bx + 10, ly, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = v.isSelf ? "#fff" : INK;
    ctx.textAlign = "left";
    ctx.fillText(p.name, bx + 18, ly + 0.5);
    // ikon mic
    const mx = bx + bw - 12 - extra;
    ctx.strokeStyle = p.media.mic ? "#4fae63" : "#d2554a";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(mx - 2, ly - 5, 4, 6.5, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx, ly - 0.5, 3.6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.moveTo(mx, ly + 3);
    ctx.lineTo(mx, ly + 5);
    ctx.stroke();
    if (!p.media.mic) {
      ctx.beginPath();
      ctx.moveTo(mx - 4.5, ly - 5);
      ctx.lineTo(mx + 4.5, ly + 5);
      ctx.stroke();
    }
    if (p.media.screen) {
      const sx = bx + bw - 12;
      ctx.strokeStyle = v.isSelf ? "#fff" : INK;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(sx - 5, ly - 4, 10, 7);
      ctx.beginPath();
      ctx.moveTo(sx - 2, ly + 5);
      ctx.lineTo(sx + 2, ly + 5);
      ctx.stroke();
    }

    let topY = ly - 14;

    // Emote
    const e = this.emotes.get(p.id);
    if (e) {
      const age = time - e.t0;
      if (age > 2.6) this.emotes.delete(p.id);
      else {
        const pop =
          age < 0.2 ? 0.6 + (age / 0.2) * 0.55 : age < 0.35 ? 1.15 - ((age - 0.2) / 0.15) * 0.15 : 1;
        const alpha = age > 2 ? 1 - (age - 2) / 0.6 : 1;
        const ey = topY - 18 - age * 6;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(10,25,15,0.18)";
        ctx.beginPath();
        ctx.arc(px, ey + 2, 16 * pop, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(px, ey, 16 * pop, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `${Math.round(20 * pop)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(e.emoji, px, ey + 1);
        ctx.globalAlpha = 1;
        topY = ey - 18;
      }
    }

    // Balon chat sekitar
    const b = this.bubbles.get(p.id);
    if (b) {
      const age = time - b.t0;
      if (age > 6) this.bubbles.delete(p.id);
      else {
        ctx.font = "500 12px Outfit, system-ui, sans-serif";
        const w = Math.max(...b.lines.map((l) => ctx.measureText(l).width)) + 18;
        const h = b.lines.length * 15 + 10;
        const by = topY - h - 4;
        ctx.globalAlpha = age > 5.4 ? 1 - (age - 5.4) / 0.6 : Math.min(1, age / 0.15);
        ctx.fillStyle = "rgba(10,25,15,0.16)";
        ctx.beginPath();
        ctx.roundRect(px - w / 2, by + 2, w, h, 10);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.roundRect(px - w / 2, by, w, h, 10);
        ctx.moveTo(px - 5, by + h);
        ctx.lineTo(px, by + h + 6);
        ctx.lineTo(px + 5, by + h);
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.textAlign = "center";
        b.lines.forEach((l, i) => ctx.fillText(l, px, by + 12 + i * 15));
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }
}
