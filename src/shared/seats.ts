import { buildWalkable, distanceToObject, INTERACT_RANGE, type MapData, type MapObject } from "./map";
import { attachedSurface, workstationFacing } from "./workstation";

/** These anchors are shared by the art, navigation and authoritative realtime server. */
export function seatPose(map: MapData, obj: MapObject, index = 0) {
  const count = obj.kind === "sofa" ? Math.max(1, Math.floor(obj.w / 1.4)) : 1;
  const slot = Math.max(0, Math.min(count - 1, Math.floor(index)));
  const dir = obj.kind === "chair" ? workstationFacing(map, obj) : (obj.facing ?? "down");
  const attached = attachedSurface(map, obj);
  // Rear-facing feet are forward under a desktop, not at the rear wheelbase of the chair.
  const footY = dir === "up" && attached?.surface.kind === "desk" ? 0.2 : Math.min(obj.h * 0.6, 0.6);
  return {
    x: obj.x + obj.w * ((slot + 0.5) / count),
    y: obj.y + footY,
    dir,
    seatId: obj.id,
    seatIndex: slot,
  };
}

export function canSitAt(map: MapData, obj: MapObject | undefined, x: number, y: number, index = 0) {
  if (!obj?.actions?.includes("sit") || distanceToObject(obj, x, y) > INTERACT_RANGE) return false;
  const p = seatPose(map, obj, index);
  return !!buildWalkable(map)[Math.floor(p.y)]?.[Math.floor(p.x)];
}
