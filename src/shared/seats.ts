import { buildWalkable, distanceToObject, INTERACT_RANGE, type MapData, type MapObject } from "./map";
import { attachedSurface, workstationFacing } from "./workstation";

/**
 * How many people fit: a sofa seats one per tile along its length (a three-tile sofa seats three, a
 * two-tile one two), a bed one per two tiles; chairs and beanbags one.
 */
export function seatCount(obj: MapObject): number {
  const length = Math.max(obj.w, obj.h);
  if (obj.kind === "sofa") return Math.max(1, Math.floor(length));
  if (obj.kind === "bed") return Math.max(1, Math.floor(length / 2));
  return 1;
}

/** These anchors are shared by the art, navigation and authoritative realtime server. */
export function seatPose(map: MapData, obj: MapObject, index = 0) {
  const count = seatCount(obj);
  const slot = Math.max(0, Math.min(count - 1, Math.floor(index)));
  const dir = obj.kind === "chair" ? workstationFacing(map, obj) : (obj.facing ?? "down");
  const attached = attachedSurface(map, obj);
  // Rear-facing feet are forward under a desktop, not at the rear wheelbase of the chair.
  const footY =
    dir === "up" && (attached?.surface.kind === "desk" || attached?.surface.kind === "gamingDesk")
      ? 0.2
      : Math.min(obj.h * 0.6, 0.6);
  // A sofa standing on its end (taller than wide) seats people along its height.
  const vertical = obj.h > obj.w && count > 1;
  return {
    x: vertical ? obj.x + obj.w / 2 : obj.x + obj.w * ((slot + 0.5) / count),
    y: vertical ? obj.y + obj.h * ((slot + 0.5) / count) : obj.y + footY,
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
