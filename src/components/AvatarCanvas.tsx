"use client";

import { useEffect, useRef } from "react";
import type { AvatarConfig, AvatarDirection, AvatarActivity, AvatarCondition } from "@/shared/avatar";
import { drawAvatar } from "@/client/draw";
import { avatarHeadY, avatarPartY } from "@/client/art/avatar";
import { loadAvatarAssets, paintedAvatarReady } from "@/client/art/avatar-assets";

/** Pratinjau avatar statis. `face` = hanya kepala untuk daftar anggota/chat. */
export function AvatarCanvas({
  avatar,
  size = 96,
  face = false,
  animate = false,
  part,
  direction = "down",
  activity = "idle",
  condition = "normal",
}: {
  avatar: AvatarConfig;
  size?: number;
  face?: boolean;
  animate?: boolean;
  part?: "body" | "legs";
  direction?: AvatarDirection;
  activity?: AvatarActivity;
  condition?: AvatarCondition;
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
    let disposed = false;
    let startedAt: number | null = null;
    const animated =
      animate &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      document.documentElement.dataset.motion !== "reduced";
    const render = (time: number) => {
      if (disposed) return;
      if (animated && time > 0 && startedAt === null) startedAt = time;
      const elapsed = animated ? Math.max(0, time - (startedAt ?? time)) : 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      if (part) {
        const s = size / (part === "body" ? 22 : 13);
        drawAvatar(ctx, avatar, size / 2, size / 2 + avatarPartY(avatar, part) * s, s, {
          dir: direction,
          walk: 0,
          part,
          staticPose: !animated,
        });
      } else if (face) {
        // Kepala (dengan rambut) mengisi lingkaran, sedikit menyisakan bahu di bawah.
        const s = size / 30;
        drawAvatar(ctx, avatar, size / 2, size / 2 + (avatarHeadY(avatar) - 1.5) * s, s, {
          dir: direction,
          walk: 0,
          time: elapsed / 1000,
        });
      } else {
        const s = size / (["present", "brainstorm"].includes(activity) ? 76 : 64);
        drawAvatar(ctx, avatar, size / 2, size * 0.93, s, {
          dir: direction,
          walk: activity === "walk" ? (animated ? elapsed / 80 : 0.8) : 0,
          time: elapsed / 1000,
          activity,
          condition,
          staticPose: !animated,
        });
      }
      c.dataset.renderer = paintedAvatarReady() ? "painted" : "native";
      if (animated) raf = requestAnimationFrame(render);
    };
    render(0);
    void loadAvatarAssets().then(() => {
      if (!animated) render(0);
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [avatar, size, face, animate, part, direction, activity, condition]);
  return (
    <canvas
      ref={ref}
      className={face ? "avatar-face" : undefined}
      data-direction={direction}
      data-activity={activity}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
