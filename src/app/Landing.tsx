"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { PublicShell } from "@/components/PublicShell";
import { Icon, type IconName } from "@/components/Icon";
import { useT } from "@/i18n/client";
import { drawAvatar, renderStaticMap } from "@/client/draw";
import { OFFICE_TEMPLATE, TILE, buildWalkable } from "@/shared/map";
import { findPath, type Point } from "@/shared/pathfinding";
import { randomAvatar, DEFAULT_AVATAR } from "@/shared/avatar";

/** Pratinjau hidup: beberapa karakter berjalan acak di peta template. */
function HeroMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const t = useT();
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const map = OFFICE_TEMPLATE;
    const bg = renderStaticMap(map, (k) => t(k));
    const grid = buildWalkable(map);
    const free: Point[] = [];
    grid.forEach((row, y) => row.forEach((ok, x) => ok && y > 11 && free.push({ x, y })));
    const bots = Array.from({ length: 9 }, (_, i) => {
      const p = free[(i * 37) % free.length];
      return {
        avatar: i === 0 ? DEFAULT_AVATAR : randomAvatar(),
        x: p.x + 0.5,
        y: p.y + 0.5,
        path: [] as Point[],
        dir: "down" as const as "down" | "up" | "left" | "right",
        phase: 0,
        wait: i * 30,
      };
    });
    let raf = 0;
    const frame = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== w * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      // Tampilkan seluruh kantor (mode "cover"), dipusatkan.
      const W = map.width * TILE;
      const H = map.height * TILE;
      const scale = Math.max(w / W, h / H) * dpr;
      ctx.setTransform(scale, 0, 0, scale, (w * dpr - W * scale) / 2, (h * dpr - H * scale) / 2);
      ctx.drawImage(bg, 0, 0);
      for (const b of bots) {
        if (!b.path.length) {
          if (b.wait-- <= 0) {
            const target = free[Math.floor(Math.random() * free.length)];
            b.path = findPath(grid, b, target) ?? [];
            b.wait = 60 + Math.random() * 120;
          }
        } else {
          const n = b.path[0];
          const dx = n.x + 0.5 - b.x;
          const dy = n.y + 0.5 - b.y;
          const d = Math.hypot(dx, dy);
          const step = 0.05;
          if (d < step) {
            b.x = n.x + 0.5;
            b.y = n.y + 0.5;
            b.path.shift();
          } else {
            b.x += (dx / d) * step;
            b.y += (dy / d) * step;
            b.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
          }
          b.phase += 0.25;
        }
      }
      [...bots]
        .sort((a, b) => a.y - b.y)
        .forEach((b) =>
          drawAvatar(ctx, b.avatar, b.x * TILE, b.y * TILE + 8, 1, {
            dir: b.dir,
            walk: b.path.length ? b.phase : 0,
          }),
        );
      raf = requestAnimationFrame(frame);
    };
    frame();
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
          <span className="badge">{t("landing.badge")}</span>
          <h1 dangerouslySetInnerHTML={{ __html: t("landing.title") }} />
          <p className="lead">{t("landing.lead")}</p>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <Link className="btn" href="/register" style={{ minHeight: 48, padding: "10px 24px" }}>
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
      <section className="features">
        {features.map(([icon, title, body]) => (
          <div key={title} className="card feature">
            <div className="feature-icon">
              <Icon name={icon} size={22} />
            </div>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      </section>
    </PublicShell>
  );
}
