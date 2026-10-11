"use client";

/**
 * A self-running preview of a 3D world for public pages: the same renderer as the room, with a few
 * sample avatars walking between free tiles. It is a labelled preview, not live presence.
 */
import { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { buildTemplate, type TemplateId } from "@/shared/templates";
import { buildWalkable, privateZoneAt } from "@/shared/map";
import { findPath, type Point } from "@/shared/pathfinding";
import { directionFrom } from "@/shared/avatar-animation";
import { DEFAULT_AVATAR, randomAvatar } from "@/shared/avatar";
import type { Presence } from "@/shared/protocol";
import type { Room3DApi, Room3DFrame, Person3D } from "./Room3D";

const Room3D = dynamic(() => import("./Room3D"), { ssr: false });

export default function Diorama3D({
  template = "office",
  names,
  zoom = 1.6,
  zoneLabel,
  label,
}: {
  template?: TemplateId;
  names: string[];
  /** Same unit as the room zoom (screen px per 2D px). */
  zoom?: number;
  zoneLabel: (key: string) => string;
  label: string;
}) {
  const map = useMemo(() => buildTemplate(template), [template]);
  const frameRef = useRef<Room3DFrame | null>(null);
  const apiRef = useRef<Room3DApi | null>(null);
  const namesKey = names.join("|");

  useEffect(() => {
    const grid = buildWalkable(map);
    const free: Point[] = [];
    grid.forEach((row, y) =>
      row.forEach((ok, x) => ok && !privateZoneAt(map, x + 0.5, y + 0.5) && free.push({ x, y })),
    );
    // Start near the spawn so the first view is full of people.
    free.sort(
      (a, b) =>
        Math.hypot(a.x - map.spawn.x, a.y - map.spawn.y) - Math.hypot(b.x - map.spawn.x, b.y - map.spawn.y),
    );
    const near = free.slice(0, Math.min(free.length, 160));
    const statuses = ["active", "active", "busy", "active", "meeting", "active"] as const;
    const bots = namesKey.split("|").map((name, i) => {
      const p = near[(i * 37 + 5) % near.length];
      const presence: Presence = {
        id: `preview-${i}`,
        conn: "",
        name,
        avatar: i === 0 ? DEFAULT_AVATAR : randomAvatar(),
        role: "member",
        x: p.x + 0.5,
        y: p.y + 0.5,
        dir: "down",
        moving: false,
        sitting: false,
        status: statuses[i % statuses.length],
        manualStatus: false,
        statusText: null,
        media: { mic: i % 3 !== 2, cam: false, screen: false },
        allowedZone: null,
        allowedPeers: [],
        lastActive: 0,
      };
      return { presence, path: [] as Point[], phase: 0, wait: 0.5 + i * 0.9, actionAt: 0 };
    });
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0,
      last = performance.now(),
      nextWave = 3;
    const frame = (ms: number) => {
      const dt = Math.min(0.05, (ms - last) / 1000);
      last = ms;
      const time = ms / 1000;
      const reduce = motion.matches;
      for (const b of bots) {
        const p = b.presence;
        if (reduce) {
          p.moving = false;
          b.phase = 0;
          continue;
        }
        if (!b.path.length) {
          p.moving = false;
          b.phase = 0;
          b.wait -= dt;
          if (b.wait <= 0) {
            const goal = near[Math.floor(Math.random() * near.length)];
            b.path = findPath(grid, { x: p.x, y: p.y }, goal)?.slice(0, 14) ?? [];
            b.wait = 1.5 + Math.random() * 3;
          }
          continue;
        }
        const n = b.path[0];
        const dx = n.x + 0.5 - p.x,
          dy = n.y + 0.5 - p.y,
          d = Math.hypot(dx, dy),
          step = 2.4 * dt;
        if (d <= step) {
          p.x = n.x + 0.5;
          p.y = n.y + 0.5;
          b.path.shift();
        } else {
          p.x += (dx / d) * step;
          p.y += (dy / d) * step;
        }
        p.dir = directionFrom(dx, dy, p.dir);
        p.moving = true;
        b.phase += dt * 13;
      }
      // Now and then someone waves, so the preview shows more than walking.
      if (!reduce && time > nextWave) {
        nextWave = time + 4 + Math.random() * 3;
        const b = bots.filter((x) => !x.path.length)[0];
        if (b) {
          b.presence.avatarAction = "wave";
          b.actionAt = time;
        }
      }
      for (const b of bots)
        if (b.presence.avatarAction === "wave" && time - b.actionAt > 1.8) b.presence.avatarAction = "idle";
      const people: Person3D[] = bots.map((b, i) => ({
        p: b.presence,
        x: b.presence.x,
        y: b.presence.y,
        phase: b.phase,
        actionAt: b.actionAt,
        speaking: 0,
        isSelf: i === 0,
      }));
      frameRef.current = {
        people,
        zoom,
        insetTop: 0,
        insetBottom: 0,
        target: null,
        focusObj: null,
        reducedMotion: reduce,
        showNames: true,
        time,
      };
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [map, namesKey, zoom]);

  return (
    <Room3D
      map={map}
      frameRef={frameRef}
      apiRef={apiRef}
      zoneLabel={zoneLabel}
      canvasLabel={label}
      className="diorama"
      interactive={false}
      handlers={{}}
    />
  );
}
