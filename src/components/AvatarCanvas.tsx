"use client";

import { useEffect, useRef } from "react";
import type { AvatarConfig } from "@/shared/avatar";
import { drawAvatar } from "@/client/draw";
import { avatarHeadY } from "@/client/art/avatar";

/** Pratinjau avatar statis. `face` = hanya kepala untuk daftar anggota/chat. */
export function AvatarCanvas({
  avatar,
  size = 96,
  face = false,
  animate = false,
}: {
  avatar: AvatarConfig;
  size?: number;
  face?: boolean;
  animate?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const render = (time: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      if (face) {
        // Kepala (dengan rambut) mengisi lingkaran, sedikit menyisakan bahu di bawah.
        const s = size / 30;
        drawAvatar(ctx, avatar, size / 2, size / 2 + (avatarHeadY(avatar) - 1.5) * s, s, {
          dir: "down",
          walk: 0,
          time: animate ? time / 1000 : 0,
        });
      } else {
        const s = size / 54;
        drawAvatar(ctx, avatar, size / 2, size * 0.93, s, { dir: "down", walk: 0, time: time / 1000 });
      }
      if (animate) raf = requestAnimationFrame(render);
    };
    render(0);
    return () => cancelAnimationFrame(raf);
  }, [avatar, size, face, animate]);
  return (
    <canvas
      ref={ref}
      className={face ? "avatar-face" : undefined}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
