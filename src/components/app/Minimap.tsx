"use client";

import { useEffect, useRef } from "react";
import type { Scene } from "@/client/scene";
import { TILE } from "@/shared/map";
import type { PresenceStatus } from "@/shared/proximity";

const WIDTH = 168;
const COLORS: Record<PresenceStatus, string> = {
  active: "#4fae63",
  busy: "#d2554a",
  meeting: "#8a63c9",
  away: "#e0a33a",
};

interface Props {
  scene: Scene;
  getPeople: () => Array<{ x: number; y: number; self: boolean; status: PresenceStatus }>;
  getView: () => { x: number; y: number; w: number; h: number };
  onPick: (p: { x: number; y: number }) => void;
  label: string;
}

/** Peta mini: seluruh kantor, posisi semua orang, dan area yang sedang terlihat. Klik untuk berjalan ke sana. */
export function Minimap({ scene, getPeople, getView, onPick, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Callback disimpan di ref agar latar tidak digambar ulang tiap render induk.
  const fns = useRef({ getPeople, getView });
  useEffect(() => {
    fns.current = { getPeople, getView };
  });
  const map = scene.map;
  const scale = WIDTH / (map.width * TILE);
  const height = Math.round(map.height * TILE * scale);

  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = WIDTH * dpr;
    c.height = height * dpr;
    const ctx = c.getContext("2d")!;
    // Latar diperkecil sekali
    const bg = document.createElement("canvas");
    bg.width = c.width;
    bg.height = c.height;
    const bctx = bg.getContext("2d")!;
    bctx.imageSmoothingQuality = "high";
    bctx.drawImage(scene.layers.floor, 0, 0, bg.width, bg.height);
    for (const s of scene.layers.sprites)
      bctx.drawImage(
        s.canvas,
        s.x * scale * dpr,
        s.y * scale * dpr,
        s.canvas.width * scale * dpr,
        s.canvas.height * scale * dpr,
      );

    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 120) return;
      last = t;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(bg, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const v = fns.current.getView();
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(v.x * scale, v.y * scale, v.w * scale, v.h * scale);
      for (const p of fns.current.getPeople()) {
        ctx.beginPath();
        ctx.arc(p.x * TILE * scale, p.y * TILE * scale, p.self ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle = p.self ? "#ffffff" : COLORS[p.status];
        ctx.fill();
        ctx.lineWidth = p.self ? 2 : 1;
        ctx.strokeStyle = p.self ? "#3f9a55" : "#1b3a2a";
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [scene, height, scale]);

  return (
    <canvas
      ref={ref}
      className="minimap"
      style={{ width: WIDTH, height }}
      role="img"
      aria-label={label}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onPick({ x: (e.clientX - r.left) / scale / TILE, y: (e.clientY - r.top) / scale / TILE });
      }}
    />
  );
}
