import { DEFAULT_AVATAR, type AvatarConfig } from "@/shared/avatar";
import { TILE } from "@/shared/map";
import { seatPose } from "@/shared/seats";
import type { Presence } from "@/shared/protocol";
import { workstationFixture } from "@/shared/workstation-fixtures";
import type { WorkstationDirection } from "@/shared/workstation";
import { Scene } from "@/client/scene";
import { avatarNameOffset } from "./avatar";
import { loadAvatarAssets } from "./avatar-assets";
import { loadEnvironmentAssets } from "./environment-assets";
import { workstationLayout, workstationReady } from "./workstation-assets";

export async function workstationPreview(dir: WorkstationDirection, avatar: AvatarConfig = DEFAULT_AVATAR) {
  await Promise.all([loadAvatarAssets(), loadEnvironmentAssets()]);
  if (!workstationReady()) throw Error("Kit workstation belum berhasil dimuat.");
  const map = workstationFixture(dir),
    seat = map.objects[1],
    position = seatPose(map, seat);
  const p: Presence = {
    id: "asset-lab",
    conn: "asset-lab",
    name: "Prototype",
    avatar,
    role: "owner",
    ...position,
    sitting: true,
    moving: false,
    status: "active",
    manualStatus: false,
    statusText: null,
    media: { mic: false, cam: false, screen: false },
    allowedZone: null,
    allowedPeers: [],
    lastActive: 0,
  };
  const person = { p, x: p.x, y: p.y, phase: 0, speaking: 0, isSelf: false, seed: 1 };
  const scene = new Scene(map, (k) => k);
  await scene.layers.ready;
  const bounds = map.objects.map((o) => workstationLayout(o, map)!.bounds);
  const center = {
    x:
      (Math.min(...bounds.map((r) => r.x), p.x * TILE - 30) +
        Math.max(...bounds.map((r) => r.x + r.w), p.x * TILE + 30)) /
      2,
    y:
      (Math.min(...bounds.map((r) => r.y), p.y * TILE + 8 - avatarNameOffset(avatar, dir, true)) +
        Math.max(...bounds.map((r) => r.y + r.h), p.y * TILE + 12)) /
      2,
  };
  return {
    map,
    person,
    scene,
    draw(
      canvas: HTMLCanvasElement,
      options: { zoom?: number; time?: number; activity?: "sit" | "type"; guides?: boolean } = {},
    ) {
      const { zoom = 2, time = 0, activity = "sit", guides = false } = options;
      person.p.avatarAction = activity;
      const w = canvas.width,
        h = canvas.height,
        cam = { x: center.x - w / (2 * zoom), y: center.y - h / (2 * zoom), zoom };
      scene.draw(canvas.getContext("2d")!, {
        w,
        h,
        dpr: 1,
        cam,
        time,
        people: [person],
        self: null,
        target: null,
        hoverTile: null,
        focusObj: null,
        links: [],
        privateZone: null,
        showRadius: false,
        speakers: [],
        reducedMotion: time === 0,
        showNames: false,
      });
      if (guides) {
        const ctx = canvas.getContext("2d")!;
        ctx.save();
        ctx.setTransform(zoom, 0, 0, zoom, -cam.x * zoom, -cam.y * zoom);
        ctx.lineWidth = 1 / zoom;
        ctx.strokeStyle = "#e8b65b";
        ctx.setLineDash([3, 3]);
        for (const o of map.objects) ctx.strokeRect(o.x * TILE, o.y * TILE, o.w * TILE, o.h * TILE);
        const chair = workstationLayout(seat, map)!;
        ctx.setLineDash([]);
        ctx.fillStyle = "#ff6969";
        ctx.beginPath();
        ctx.arc(chair.contact!.x, chair.contact!.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
  };
}
