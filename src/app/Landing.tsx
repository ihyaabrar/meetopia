"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { PublicShell } from "@/components/PublicShell";
import { Icon, type IconName } from "@/components/Icon";
import { useT } from "@/i18n/client";
import { Scene, type PersonView } from "@/client/scene";
import { OFFICE_TEMPLATE, TILE, buildWalkable } from "@/shared/map";
import { EMOTES, type Presence } from "@/shared/protocol";
import { findPath, type Point } from "@/shared/pathfinding";
import { randomAvatar, DEFAULT_AVATAR } from "@/shared/avatar";

/** Pratinjau hidup: karakter berjalan acak di kantor template, lengkap dengan emote dan balon chat. */
function HeroMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const t = useT();
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const map = OFFICE_TEMPLATE;
    const scene = new Scene(map, (k) => t(k));
    const grid = buildWalkable(map);
    const free: Point[] = [];
    grid.forEach((row, y) => row.forEach((ok, x) => ok && y > 11 && free.push({ x, y })));
    const names = ["Rani", "Dito", "Ayu", "Bima", "Sari", "Joko", "Lala", "Tegar"];
    const lines = [t("landing.bubble1"), t("landing.bubble2"), t("landing.bubble3")];
    const statuses = ["active", "active", "busy", "active", "meeting", "active", "away", "active"] as const;
    const bots = names.map((name, i) => {
      const p = free[(i * 53 + 17) % free.length];
      const presence: Presence = {
        id: `bot-${i}`,
        conn: "",
        name,
        avatar: i === 0 ? DEFAULT_AVATAR : randomAvatar(),
        role: "member",
        x: p.x + 0.5,
        y: p.y + 0.5,
        dir: "down",
        moving: false,
        sitting: false,
        status: statuses[i],
        manualStatus: false,
        statusText: null,
        media: { mic: i % 3 !== 2, cam: false, screen: false },
        allowedZone: null,
        allowedPeers: [],
        lastActive: 0,
      };
      return { presence, path: [] as Point[], phase: 0, wait: 30 + i * 40, lastPuff: 0 };
    });
    let raf = 0;
    let nextFx = 1;
    const frame = (ms: number) => {
      const time = ms / 1000;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      for (const b of bots) {
        const p = b.presence;
        if (!b.path.length) {
          p.moving = false;
          if (b.wait-- <= 0) {
            const target = free[Math.floor(Math.random() * free.length)];
            b.path = findPath(grid, p, target) ?? [];
            b.wait = 90 + Math.random() * 200;
          }
        } else {
          const n = b.path[0];
          const dx = n.x + 0.5 - p.x;
          const dy = n.y + 0.5 - p.y;
          const d = Math.hypot(dx, dy);
          const step = 0.045;
          if (d < step) {
            p.x = n.x + 0.5;
            p.y = n.y + 0.5;
            b.path.shift();
          } else {
            p.x += (dx / d) * step;
            p.y += (dy / d) * step;
            p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
          }
          p.moving = true;
          b.phase += 0.22;
          if (time - b.lastPuff > 0.25) {
            b.lastPuff = time;
            scene.puff(p.x, p.y, time);
          }
        }
      }
      if (time > nextFx) {
        const b = bots[Math.floor(Math.random() * bots.length)];
        if (Math.random() < 0.5)
          scene.emote(b.presence.id, EMOTES[Math.floor(Math.random() * EMOTES.length)], time);
        else scene.bubble(b.presence.id, lines[Math.floor(Math.random() * lines.length)], time);
        nextFx = time + 1.6 + Math.random() * 1.5;
      }
      // Kamera menyapu pelan lobi dan lounge
      const zoom = Math.max(0.8, w / (15 * TILE));
      const viewW = w / zoom;
      const viewH = h / zoom;
      const span = map.width * TILE - viewW;
      const cx = span / 2 + (Math.sin(time * 0.06) * span) / 2;
      const cy = Math.min(map.height * TILE - viewH, 15 * TILE);
      const people: PersonView[] = bots.map((b, i) => ({
        p: b.presence,
        x: b.presence.x,
        y: b.presence.y,
        phase: b.presence.moving ? b.phase : 0,
        speaking: i === 1 || i === 3 ? (Math.sin(time * 9 + i) + 1) / 2 : 0,
        isSelf: i === 0,
        seed: i * 0.13,
      }));
      scene.draw(ctx, {
        w,
        h,
        dpr,
        cam: { x: cx, y: cy, zoom },
        time,
        people,
        self: null,
        target: null,
        hoverTile: null,
        focusObj: null,
        links: [],
        privateZone: null,
        showRadius: false,
        speakers: map.objects.filter((o) => o.kind === "speaker").map((obj) => ({ obj, level: 0.7 })),
        reducedMotion: false,
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [t]);
  return <canvas ref={ref} aria-label={t("landing.previewAlt")} role="img" />;
}

export function Landing() {
  const t = useT();
  const features: Array<[IconName, string, string]> = [
    ["mic", t("landing.f1.title"), t("landing.f1.body")],
    ["screen", t("landing.f2.title"), t("landing.f2.body")],
    ["notes", t("landing.f3.title"), t("landing.f3.body")],
  ];
  return (
    <PublicShell>
      <section className="hero">
        <div>
          <h1 dangerouslySetInnerHTML={{ __html: t("landing.title") }} />
          <p className="lead">{t("landing.lead")}</p>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <Link className="btn" href="/register" style={{ minHeight: 48, padding: "10px 22px" }}>
              {t("landing.cta")}
            </Link>
            <Link className="btn secondary" href="/login" style={{ minHeight: 48 }}>
              {t("auth.login")}
            </Link>
          </div>
        </div>
        <div className="hero-art">
          <HeroMap />
        </div>
      </section>
      {/* Tiga fungsi inti PRD sebagai daftar biasa (bukan kartu seragam), ikon sesuai fungsinya. */}
      <section className="how" aria-labelledby="how-title">
        <h2 id="how-title">{t("landing.howTitle")}</h2>
        <ul className="how-list">
          {features.map(([icon, title, body]) => (
            <li key={title}>
              <Icon name={icon} size={22} />
              <div>
                <b>{title}</b>
                <span>{body}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </PublicShell>
  );
}
