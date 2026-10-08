import type { MapData, MapObject } from "./map";

export const WORKSTATION_DIRECTIONS = ["up", "right", "down", "left"] as const;
export type WorkstationDirection = (typeof WORKSTATION_DIRECTIONS)[number];
const WORK_SURFACES = new Set<MapObject["kind"]>(["desk", "gamingDesk", "table", "counter"]);

/** A workstation direction is the OPERATOR'S gaze, not the monitor's front. */
export function directionToSurface(seat: MapObject, surface: MapObject): WorkstationDirection | null {
  const overlapX = seat.x < surface.x + surface.w && seat.x + seat.w > surface.x;
  const overlapY = seat.y < surface.y + surface.h && seat.y + seat.h > surface.y;
  const touches = (a: number, b: number) => Math.abs(a - b) < 0.001;
  if (overlapX && touches(surface.y + surface.h, seat.y)) return "up";
  if (overlapX && touches(seat.y + seat.h, surface.y)) return "down";
  if (overlapY && touches(seat.x + seat.w, surface.x)) return "right";
  if (overlapY && touches(surface.x + surface.w, seat.x)) return "left";
  return null;
}

export function attachedSurface(map: MapData, seat: MapObject) {
  if (seat.kind !== "chair") return null;
  const candidates = map.objects.flatMap((surface) => {
    const dir = WORK_SURFACES.has(surface.kind) ? directionToSurface(seat, surface) : null;
    return dir && (!seat.facing || seat.facing === dir) ? [{ surface, dir }] : [];
  });
  // Stable nearest-center selection if two surfaces touch one seat. Never match a diagonal corner.
  return (
    candidates.sort((a, b) => {
      const distance = (o: MapObject) =>
        Math.hypot(o.x + o.w / 2 - seat.x - seat.w / 2, o.y + o.h / 2 - seat.y - seat.h / 2);
      return distance(a.surface) - distance(b.surface) || a.surface.id.localeCompare(b.surface.id);
    })[0] ?? null
  );
}

export function workstationFacing(map: MapData | undefined, object: MapObject): WorkstationDirection {
  if (object.facing) return object.facing;
  if (!map) return object.kind === "chair" ? "down" : "up";
  if (object.kind === "chair") return attachedSurface(map, object)?.dir ?? "down";
  const seat = workstationSeat(map, object);
  return seat ? directionToSurface(seat, object)! : "up";
}

export function workstationSeat(map: MapData, surface: MapObject): MapObject | undefined {
  return map.objects.find((seat) => {
    if (seat.kind !== "chair") return false;
    const dir = directionToSurface(seat, surface);
    return !!dir && (!seat.facing || seat.facing === dir) && (!surface.facing || surface.facing === dir);
  });
}

/** Swap ground dimensions on a 90-degree axis change, never rotate the PNG. */
export function orientWorkstation(object: MapObject, dir: WorkstationDirection): MapObject {
  const vertical = dir === "left" || dir === "right";
  const swap = object.kind === "desk" && object.w !== object.h && vertical !== object.h > object.w;
  return { ...object, facing: dir, w: swap ? object.h : object.w, h: swap ? object.w : object.h };
}
