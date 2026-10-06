"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { PublicShell } from "@/components/PublicShell";
import { Icon, type IconName } from "@/components/Icon";
import { useT } from "@/i18n/client";
import { Scene, type PersonView } from "@/client/scene";
import { TILE, buildWalkable, privateZoneAt } from "@/shared/map";
import { OFFICE_TEMPLATE, TEMPLATE_IDS, type TemplateId } from "@/shared/templates";
import { EMOTES, type Presence } from "@/shared/protocol";
import { findPath, type Point } from "@/shared/pathfinding";
import { randomAvatar, DEFAULT_AVATAR } from "@/shared/avatar";
import { MapPreview } from "@/components/MapPreview";
import { loadAvatarAssets } from "@/client/art/avatar-assets";

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
    grid.forEach((row, y) =>
      row.forEach((ok, x) => ok && !privateZoneAt(map, x + 0.5, y + 0.5) && free.push({ x, y })),
    );
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
    let disposed = false;
    let visible = true;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = motion.matches;
    const frame = (ms: number) => {
      raf = 0;
      if (disposed) return;
      const time = reduce ? 0 : ms / 1000;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      if (!reduce)
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
      if (!reduce && time > nextFx) {
        const b = bots[Math.floor(Math.random() * bots.length)];
        if (Math.random() < 0.5)
          scene.emote(b.presence.id, EMOTES[Math.floor(Math.random() * EMOTES.length)], time);
        else scene.bubble(b.presence.id, lines[Math.floor(Math.random() * lines.length)], time);
        nextFx = time + 1.6 + Math.random() * 1.5;
      }
      // Kamera menyapu pelan seluruh kantor (area kerja, lobi, lounge)
      const zoom = Math.max(0.6, w / (24 * TILE));
      const viewW = w / zoom;
      const viewH = h / zoom;
      const spanX = Math.max(0, map.width * TILE - viewW);
      const spanY = Math.max(0, map.height * TILE - viewH);
      const cx = spanX / 2 + (Math.sin(time * 0.05) * spanX) / 2;
      const cy = spanY / 2 + (Math.sin(time * 0.037 + 1.2) * spanY) / 2;
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
        reducedMotion: reduce,
      });
      if (!reduce && visible && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    };
    const resume = () => {
      if (!disposed && !raf) raf = requestAnimationFrame(frame);
    };
    void loadAvatarAssets().then(resume);
    const onMotion = () => {
      reduce = motion.matches;
      resume();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        cancelAnimationFrame(raf);
        raf = 0;
      } else resume();
    };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) resume();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    const resize = new ResizeObserver(resume);
    intersection.observe(canvas);
    resize.observe(canvas);
    motion.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    void scene.layers.ready.then(resume);
    resume();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      intersection.disconnect();
      resize.disconnect();
      motion.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [t]);
  return <canvas ref={ref} aria-label={t("landing.previewAlt")} role="img" />;
}

export function Landing() {
  const t = useT();
  const roomIcons: Record<TemplateId, IconName> = {
    office: "briefcase",
    home: "home",
    gaming: "play",
    studio: "palette",
    rooftop: "leaf",
  };
  const features: Array<[IconName, string, string]> = [
    ["door", t("landing.f1.title"), t("landing.f1.body")],
    ["chat", t("landing.f2.title"), t("landing.f2.body")],
    ["check", t("landing.f3.title"), t("landing.f3.body")],
    ["smile", t("landing.f4.title"), t("landing.f4.body")],
  ];
  return (
    <PublicShell>
      <section className="hero-card">
        <div className="hero">
          <div>
            <span className="hero-eyebrow">
              <i /> {t("landing.eyebrow")}
            </span>
            <h1 dangerouslySetInnerHTML={{ __html: t("landing.title") }} />
            <p className="lead">{t("landing.lead")}</p>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <Link className="btn" href="/login" style={{ minHeight: 48, padding: "10px 22px" }}>
                {t("landing.ctaEnter")} <Icon name="send" size={16} />
              </Link>
              <Link className="btn secondary" href="/register" style={{ minHeight: 48 }}>
                {t("landing.ctaCreate")}
              </Link>
            </div>
            <div className="hero-proof" aria-label={t("landing.proof.live")}>
              <span className="proof-faces" aria-hidden>
                {["#d9605a", "#4a7fc1", "#e0a33a"].map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </span>
              <span>
                <b>{t("landing.proof.live")}</b>
                <small>{t("landing.proof.rooms")}</small>
              </span>
            </div>
          </div>
          <div className="hero-art">
            <HeroMap />
          </div>
        </div>
        <section className="room-showcase" aria-labelledby="room-showcase-title">
          <div className="room-showcase-head">
            <div>
              <span className="section-no">02 / DUNIA</span>
              <h2 id="room-showcase-title">{t("landing.spacesTitle")}</h2>
            </div>
            <p>{t("landing.spacesSub")}</p>
          </div>
          <div className="room-showcase-grid">
            {TEMPLATE_IDS.map((id, index) => (
              <article className={`room-mini room-${id}`} key={id}>
                <span className="room-mini-art" aria-hidden>
                  <MapPreview id={id} />
                </span>
                <span className="room-mini-copy">
                  <small>0{index + 1}</small>
                  <b>
                    <Icon name={roomIcons[id]} size={16} /> {t(`tpl.${id}`)}
                  </b>
                  <span>{t(`landing.space.${id}`)}</span>
                </span>
              </article>
            ))}
          </div>
        </section>
        <ul className="feature-row">
          {features.map(([icon, title, body]) => (
            <li key={title}>
              <span className="feature-icon" aria-hidden>
                <Icon name={icon} size={20} />
              </span>
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
