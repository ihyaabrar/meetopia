/**
 * Renderer adegan ruangan: lantai, sprite + avatar diurutkan kedalamannya, efek (riak klik, debu langkah,
 * emote, balon chat), garis koneksi suara, sorotan ruang privat, cahaya lampu, dan label nama.
 * Terpisah dari React agar loop gambar ringan dan mudah dirawat.
 */
import { TILE, isLockable, tileAt, type MapData, type MapObject, type Zone } from "@/shared/map";
import type { Presence } from "@/shared/protocol";
import type { AvatarCondition } from "@/shared/avatar";
import { AVATAR_MAP_SCALE, drawAvatar, avatarNameOffset } from "./art/avatar";
import { renderWorld, type Sprite, type WorldLayers } from "./art/world";
import { INK } from "./art/common";
import { drawFurniture } from "./art/environment-assets";
import { AVATAR_RENDER_METRICS } from "@/shared/avatar-metrics";
import { attachedSurface } from "@/shared/workstation";
import { workstationHandTargets, workstationLayout } from "./art/workstation-assets";
import { paintedAvatarReady } from "./art/avatar-assets";

export interface PersonView {
  p: Presence;
  x: number;
  y: number;
  phase: number;
  /** 0..1, level suara terhalus. */
  speaking: number;
  isSelf: boolean;
  seed: number;
  /** Owner-only cosmetic needs; never written to Presence or sent to peers. */
  condition?: AvatarCondition;
}

export interface SceneFrame {
  w: number;
  h: number;
  dpr: number;
  cam: { x: number; y: number; zoom: number };
  time: number;
  serverTime?: number;
  people: PersonView[];
  self: PersonView | null;
  target: { x: number; y: number } | null;
  hoverTile: { x: number; y: number } | null;
  focusObj: MapObject | null;
  links: Array<{ x: number; y: number; volume: number }>;
  privateZone: Zone | null;
  showRadius: boolean;
  /** Speaker yang sedang memutar musik; `level` 0..1 = seberapa keras terdengar oleh diri sendiri. */
  speakers: Array<{ obj: MapObject; level: number }>;
  reducedMotion: boolean;
  /** Ruangan yang sedang dikunci: gembok digambar di pintunya. */
  lockedZones?: Record<string, unknown>;
  /** TV yang sedang memutar video. */
  playingTvs?: MapObject[];
  /** Label nama di atas avatar (bawaan tampil). */
  showNames?: boolean;
}

const T = TILE;
const STATUS_COLOR = { active: "#00d69b", busy: "#d9584c", meeting: "#8f6fd1", away: "#d99a2b" } as const;
const FOOT = AVATAR_RENDER_METRICS.footOffset;

/** Alpha piksel sprite statis untuk uji oklusi (dibaca sekali per kanvas). */
const spriteAlpha = new WeakMap<HTMLCanvasElement, Uint8ClampedArray>();
function alphaAt(c: HTMLCanvasElement, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return 0;
  let a = spriteAlpha.get(c);
  if (!a) {
    a = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    spriteAlpha.set(c, a);
  }
  return a[(Math.floor(y) * c.width + Math.floor(x)) * 4 + 3];
}

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

  /** Pintu tiap ruangan yang bisa dikunci (pusat pintu dalam tile). */
  private doors = new Map<string, Array<{ x: number; y: number }>>();

  constructor(
    public map: MapData,
    zoneLabel: (k: string) => string,
  ) {
    this.layers = renderWorld(map, zoneLabel);
    for (const z of map.zones) {
      if (!isLockable(z)) continue;
      const tiles: Array<{ x: number; y: number }> = [];
      for (let ty = z.y - 1; ty <= z.y + z.h; ty++)
        for (let tx = z.x - 1; tx <= z.x + z.w; tx++) {
          const inside = tx >= z.x && tx < z.x + z.w && ty >= z.y && ty < z.y + z.h;
          if (!inside && tileAt(map, tx, ty) === "door") tiles.push({ x: tx, y: ty });
        }
      // Kelompokkan tile pintu yang bersebelahan menjadi satu pintu.
      const groups: Array<Array<{ x: number; y: number }>> = [];
      for (const t of tiles) {
        const g = groups.find((gr) => gr.some((o) => Math.abs(o.x - t.x) + Math.abs(o.y - t.y) === 1));
        if (g) g.push(t);
        else groups.push([t]);
      }
      this.doors.set(
        z.id,
        groups.map((g) => ({
          x: g.reduce((a, t) => a + t.x, 0) / g.length + 0.5,
          y: g.reduce((a, t) => a + t.y, 0) / g.length + 0.5,
        })),
      );
    }
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
    if (f.w <= 0 || f.h <= 0) return;
    const { dpr, cam, time } = f;
    const scale = cam.zoom * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#09151c";
    ctx.fillRect(0, 0, f.w * dpr, f.h * dpr);
    ctx.setTransform(scale, 0, 0, scale, -cam.x * scale, -cam.y * scale);
    ctx.imageSmoothingQuality = "high";
    ctx.canvas.dataset.renderer = this.layers.illustrated ? "illustrated" : "native";
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
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(tx, ty, 8 + p * 3, 3.5 + p * 1.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fill();
    }
    this.ripples = this.ripples.filter((r) => time - r.t0 < 0.6);
    for (const r of this.ripples) {
      // A click can arrive after the timestamp of this queued animation frame.
      const k = Math.max(0, time - r.t0) / 0.6;
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.ellipse(r.x * T, r.y * T, 6 + k * 18, 3 + k * 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Debu langkah
    this.puffs = this.puffs.filter((p) => time - p.t0 < 0.5);
    for (const p of this.puffs) {
      const k = Math.max(0, time - p.t0) / 0.5;
      ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(p.x * T, p.y * T + FOOT - 2 - k * 4, 2 + k * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Label area menempel di lantai: digambar sebelum avatar supaya tidak menutupi orang yang berdiri di atasnya.
    ctx.drawImage(this.layers.labels, 0, 0);

    // Sprite tinggi + avatar, diurutkan dari atas ke bawah
    type Item = { y: number; draw: () => void };
    // Kepala & badan atas tiap orang: objek tinggi di depannya (tiang pergola, payung, tanaman rambat,
    // rak) yang menutupi bagian ini digambar transparan, supaya orang tidak hilang di belakangnya.
    const bodies = f.people.map((v) => {
      const foot = v.y * T + FOOT;
      const top = foot - avatarNameOffset(v.p.avatar, v.p.dir, v.p.sitting) + 14;
      return {
        sortY: v.y * T + (v.p.sitting ? 0 : FOOT),
        x: v.x * T,
        top,
        bottom: top + (foot - top) * 0.6,
        seat: v.p.sitting ? v.p.seatId : undefined,
      };
    });
    const hides = (s: Sprite, y: number) =>
      bodies.some((b) => {
        if (b.sortY >= y || b.seat === s.obj.id) return false;
        const hw = 9 * AVATAR_MAP_SCALE;
        if (b.x + hw < s.x || b.x - hw > s.x + s.canvas.width || b.bottom < s.y || b.top > s.y + s.canvas.height)
          return false;
        let hit = 0;
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 4; j++)
            if (
              alphaAt(
                s.canvas,
                b.x - hw + (hw * 2 * (i + 0.5)) / 3 - s.x,
                b.top + ((b.bottom - b.top) * (j + 0.5)) / 4 - s.y,
              ) > 128
            )
              hit++;
        return hit >= 4;
      });
    const items: Item[] = this.layers.sprites.map((s) => {
      const seated = f.people.find((v) => v.p.sitting && v.p.seatId === s.obj.id);
      const y = seated ? seated.y * T - 12 : s.sortY;
      const faded = hides(s, y);
      return {
        y,
        draw: () => {
          if (faded) ctx.globalAlpha = 0.42;
          ctx.drawImage(s.canvas, s.x, s.y);
          ctx.globalAlpha = 1;
        },
      };
    });
    for (const v of f.people) {
      // Sort seated people at the physical seat, before the front edge of their desk/chair.
      items.push({
        y: v.y * T + (v.p.sitting ? 0 : FOOT),
        draw: () => this.drawPerson(ctx, v, f.reducedMotion ? 0 : time, f.serverTime),
      });
      const seat = v.p.sitting && this.map.objects.find((o) => o.id === v.p.seatId);
      if (seat) items.push({ y: v.y * T + FOOT + 0.1, draw: () => drawFurniture(ctx, seat, this.map, true) });
      const workstation = seat ? attachedSurface(this.map, seat) : null;
      if (
        workstation?.surface.kind === "desk" &&
        workstation.dir !== "up" &&
        paintedAvatarReady() &&
        workstationLayout(workstation.surface, this.map)
      )
        items.push({
          y: (workstation.surface.y + workstation.surface.h) * T + 0.2,
          draw: () => this.drawPerson(ctx, v, f.reducedMotion ? 0 : time, f.serverTime, "upper"),
        });
    }
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

    // Layar TV yang sedang memutar video
    for (const o of f.playingTvs ?? []) this.drawTvPlaying(ctx, o, time);

    // Gembok di pintu ruangan yang dikunci
    for (const id of Object.keys(f.lockedZones ?? {}))
      for (const d of this.doors.get(id) ?? []) this.drawPadlock(ctx, d.x * T, d.y * T);

    // Speaker yang sedang memutar: lampu indikator dan not musik melayang
    for (const sp of f.speakers) this.drawSpeakerFx(ctx, sp.obj, sp.level, time, f.reducedMotion);

    // Cahaya lampu & layar
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const l of this.layers.lights) {
      ctx.globalAlpha = 0.9 + Math.sin(time * 2 + l.x) * 0.08;
      ctx.drawImage(this.lightSprite(l.color, l.r), l.x - l.r, l.y - l.r);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    const ambience = this.map.appearance?.ambience;
    if (ambience && ambience !== "normal") {
      ctx.fillStyle =
        ambience === "night"
          ? "rgba(14,22,58,.32)"
          : ambience === "dim"
            ? "rgba(9,23,28,.18)"
            : "rgba(255,239,186,.07)";
      ctx.fillRect(0, 0, this.map.width * T, this.map.height * T);
    }

    // Sorotan ruang privat: area lain diredupkan
    if (f.privateZone) {
      const z = f.privateZone;
      ctx.save();
      ctx.fillStyle = "rgba(12,10,8,0.55)";
      ctx.beginPath();
      ctx.rect(-T * 4, -T * 4, (this.map.width + 8) * T, (this.map.height + 8) * T);
      ctx.roundRect(z.x * T, z.y * T - 4, z.w * T, z.h * T + 8, 12);
      ctx.fill("evenodd");
      ctx.restore();
    }

    // Label nama, emote, balon chat (selalu di atas). Label yang bertabrakan digeser ke atas.
    ctx.font = "600 11px Outfit, system-ui, sans-serif";
    // Label digambar di ruang dunia, jadi ikut mengecil saat peta diperkecil. Saat zoom di bawah 1,
    // label diperbesar balik (maks. 1,4x) agar nama tetap terbaca (~11px di layar).
    const ls = Math.min(1.4, Math.max(1, 1 / (f.cam.zoom || 1)));
    const placed: Array<{ x0: number; x1: number; y: number }> = [];
    const ordered = [...f.people].sort((a, b) => b.y - a.y);
    for (const v of ordered) {
      const half = ((ctx.measureText(v.p.name).width + 42 + (v.p.media.screen ? 14 : 0)) / 2) * ls;
      const x0 = v.x * T - half;
      const x1 = v.x * T + half;
      let ly = v.y * T + FOOT - avatarNameOffset(v.p.avatar, v.p.dir, v.p.sitting) - (ls - 1) * 10;
      for (let guard = 0; guard < 8; guard++) {
        const hit = placed.find((r) => x0 < r.x1 && x1 > r.x0 && Math.abs(ly - r.y) < 22 * ls);
        if (!hit) break;
        ly = hit.y - 23 * ls;
      }
      placed.push({ x0, x1, y: ly });
      ctx.save();
      const ax = v.x * T;
      ctx.translate(ax, ly);
      ctx.scale(ls, ls);
      ctx.translate(-ax, -ly);
      this.drawLabels(ctx, v, time, ly, f.showNames !== false || v.isSelf);
      ctx.restore();
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
      vg.addColorStop(0, "rgba(15,12,10,0)");
      vg.addColorStop(1, "rgba(15,12,10,0.28)");
      x.fillStyle = vg;
      x.fillRect(0, 0, W, H);
      this.vignette = { w: W, h: H, c };
    }
    ctx.drawImage(this.vignette.c, 0, 0);
  }

  private drawSpeakerFx(
    ctx: CanvasRenderingContext2D,
    o: MapObject,
    level: number,
    time: number,
    still: boolean,
  ) {
    const cx = (o.x + 0.5) * T;
    const top = o.y * T - 22;
    ctx.save();
    ctx.fillStyle = "#7cc48a";
    ctx.beginPath();
    ctx.arc(cx + 7, top + 41, 1.8, 0, Math.PI * 2);
    ctx.fill();
    if (!still) {
      // Woofer bergetar mengikuti ketukan
      const beat = Math.pow(Math.max(0, Math.sin(time * Math.PI * 2.4)), 6);
      ctx.strokeStyle = `rgba(124,196,138,${0.25 + beat * 0.45})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, top + 30, 9 + beat * 2.5, 0, Math.PI * 2);
      ctx.stroke();
      // Tiga not melayang bergiliran; lebih jelas bila terdengar lebih keras
      for (let i = 0; i < 3; i++) {
        const k = (time * 0.45 + i / 3) % 1;
        const nx = cx + Math.sin((k + i) * Math.PI * 2) * 8 + (i - 1) * 7;
        const ny = top - 6 - k * 34;
        ctx.globalAlpha = Math.min(1, (1 - k) * 1.6) * (0.45 + Math.min(1, level) * 0.55);
        this.drawNote(ctx, nx, ny, i % 2 === 0);
      }
    }
    ctx.restore();
  }

  private drawTvPlaying(ctx: CanvasRenderingContext2D, o: MapObject, time: number) {
    const x = o.x * T + 6;
    const y = o.y * T - 22;
    const w = o.w * T - 12;
    const h = 22;
    ctx.save();
    ctx.fillStyle = "#1d2a33";
    ctx.fillRect(x, y, w, h);
    // kilasan warna adegan video
    const k = (Math.sin(time * 1.3) + 1) / 2;
    ctx.fillStyle = `rgba(${Math.round(80 + k * 60)},${Math.round(120 + k * 40)},170,0.55)`;
    ctx.fillRect(x, y, w, h - 4);
    // tombol putar
    ctx.fillStyle = "#d9584c";
    ctx.beginPath();
    ctx.roundRect(x + w / 2 - 8, y + 4, 16, 11, 3);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 2.5, y + 6.5);
    ctx.lineTo(x + w / 2 + 3.5, y + 9.5);
    ctx.lineTo(x + w / 2 - 2.5, y + 12.5);
    ctx.fill();
    // bilah kemajuan
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(x + 3, y + h - 3, w - 6, 1.5);
    ctx.fillStyle = "#d9584c";
    ctx.fillRect(x + 3, y + h - 3, (w - 6) * ((time / 40) % 1), 1.5);
    ctx.restore();
  }

  private drawPadlock(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.fillStyle = "rgba(15,12,10,0.22)";
    ctx.beginPath();
    ctx.arc(x, y + 2, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2623";
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ede8e1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y - 2.5, 3.6, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = "#e3b25c";
    ctx.beginPath();
    ctx.roundRect(x - 5.5, y - 2.5, 11, 8.5, 2);
    ctx.fill();
    ctx.fillStyle = "#2b2623";
    ctx.fillRect(x - 0.8, y + 0.3, 1.6, 3);
    ctx.restore();
  }

  /** Not musik digambar sebagai bentuk (bukan karakter emoji). */
  private drawNote(ctx: CanvasRenderingContext2D, x: number, y: number, double: boolean) {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    const heads = double ? [x - 4, x + 4] : [x];
    for (const hx of heads) {
      ctx.beginPath();
      ctx.ellipse(hx, y, 3.2, 2.4, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx + 2.8, y - 0.5);
      ctx.lineTo(hx + 2.8, y - 10);
      ctx.stroke();
    }
    ctx.beginPath();
    if (double) {
      ctx.moveTo(x - 1.2, y - 10);
      ctx.lineTo(x + 6.8, y - 11.5);
    } else {
      ctx.moveTo(x + 2.8, y - 10);
      ctx.quadraticCurveTo(x + 7, y - 7, x + 5.5, y - 3.5);
    }
    ctx.stroke();
  }

  private drawPerson(
    ctx: CanvasRenderingContext2D,
    v: PersonView,
    time: number,
    serverTime = Date.now(),
    layer?: "upper",
  ) {
    const px = v.x * T;
    const py = v.y * T + FOOT;
    const p = v.p;
    const seat = p.sitting && this.map.objects.find((o) => o.id === p.seatId);
    const surface = seat ? attachedSurface(this.map, seat)?.surface : undefined;
    const targets = surface?.kind === "desk" ? workstationHandTargets(surface, this.map) : null;
    const workstationHands =
      targets && p.avatarAction === "type"
        ? {
            left: [
              (targets.left[0] - px) / AVATAR_MAP_SCALE,
              (targets.left[1] - py) / AVATAR_MAP_SCALE,
            ] as const,
            right: [
              (targets.right[0] - px) / AVATAR_MAP_SCALE,
              (targets.right[1] - py) / AVATAR_MAP_SCALE,
            ] as const,
          }
        : undefined;
    // Cincin sedang bicara
    if (!layer && v.speaking > 0.08 && p.media.mic) {
      const k = Math.min(1, v.speaking);
      ctx.save();
      ctx.strokeStyle = `rgba(79,174,99,${0.5 + k * 0.5})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(px, py, 17 + k * 4, 6.5 + k * 1.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (!layer && p.status === "busy") {
      ctx.strokeStyle = "rgba(210,85,74,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(px, py, 17, 6.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (!layer && v.isSelf) {
      ctx.strokeStyle = "rgba(38,235,174,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(px, py, 17, 6.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = p.status === "away" ? 0.55 : 1;
    drawAvatar(ctx, p.avatar, px, py, AVATAR_MAP_SCALE, {
      dir: p.dir,
      layer,
      workstationHands,
      walk: v.phase,
      sitting: p.sitting,
      time: p.pairedAction && time !== 0 ? Math.max(0, (serverTime - p.pairedAction.startedAt) / 1000) : time,
      seed: v.seed,
      condition: v.condition,
      staticPose: time === 0,
      activity: v.phase
        ? "walk"
        : p.avatarAction && p.avatarAction !== "idle"
          ? p.avatarAction
          : this.emotes.get(p.id)?.emoji === "👋"
            ? "wave"
            : this.emotes.get(p.id)?.emoji === "☕"
              ? "coffee"
              : this.emotes.get(p.id)?.emoji === "👍"
                ? "thumbs-up"
                : this.emotes.get(p.id)?.emoji === "👏"
                  ? "clap"
                  : this.emotes.get(p.id)?.emoji === "😂"
                    ? "laugh"
                    : this.emotes.get(p.id)?.emoji === "🤔"
                      ? "think"
                      : this.emotes.get(p.id)?.emoji === "🎉"
                        ? "dance"
                        : v.speaking > 0.08 && p.media.mic
                          ? "talk"
                          : p.sitting
                            ? "sit"
                            : "idle",
    });
    ctx.globalAlpha = 1;
    if (!layer && p.status === "away") {
      // "zzz" melayang
      ctx.fillStyle = "rgba(43,38,35,0.7)";
      ctx.font = "700 10px Outfit, system-ui, sans-serif";
      const k = (time * 0.6 + v.seed) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.fillText("z", px + 12 + k * 6, py - 40 - k * 10);
      ctx.globalAlpha = 1;
    }
  }

  private drawLabels(
    ctx: CanvasRenderingContext2D,
    v: PersonView,
    time: number,
    ly: number,
    showName: boolean,
  ) {
    ctx.save();
    if (showName) this.drawNamePill(ctx, v, ly);
    this.drawOverhead(ctx, v, time, ly);
    ctx.restore();
  }

  private drawNamePill(ctx: CanvasRenderingContext2D, v: PersonView, ly: number) {
    const p = v.p;
    const px = v.x * T;
    ctx.font = "600 11px Outfit, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(p.name).width;
    const extra = p.media.screen ? 14 : 0;
    const bw = tw + 42 + extra;
    const bx = px - bw / 2;
    ctx.fillStyle = "rgba(15,12,10,0.18)";
    ctx.beginPath();
    ctx.roundRect(bx, ly - 8, bw, 20, 10);
    ctx.fill();
    ctx.fillStyle = v.isSelf ? "rgba(26,25,23,0.95)" : "rgba(255,255,255,0.97)";
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
  }

  /** Emote dan balon chat di atas kepala (tetap tampil walau label nama disembunyikan). */
  private drawOverhead(ctx: CanvasRenderingContext2D, v: PersonView, time: number, ly: number) {
    const p = v.p;
    const px = v.x * T;
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
        ctx.fillStyle = "rgba(15,12,10,0.18)";
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
        ctx.fillStyle = "rgba(15,12,10,0.16)";
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
  }
}
