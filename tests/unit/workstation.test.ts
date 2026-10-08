import { describe, expect, it } from "vitest";
import { workstationFixture } from "@/shared/workstation-fixtures";
import {
  directionToSurface,
  attachedSurface,
  orientWorkstation,
  workstationFacing,
  WORKSTATION_DIRECTIONS,
} from "@/shared/workstation";
import { seatPose, canSitAt } from "@/shared/seats";
import { layoutError } from "@/shared/map-edit";

describe("master workstation direction and footprint contract", () => {
  for (const dir of WORKSTATION_DIRECTIONS)
    it(`${dir}: chair, operator and desk agree without an explicit chair override`, () => {
      const map = workstationFixture(dir),
        [desk, chair] = map.objects;
      expect(directionToSurface(chair, desk)).toBe(dir);
      expect(attachedSurface(map, chair)?.surface.id).toBe(desk.id);
      expect(workstationFacing(map, desk)).toBe(dir);
      expect(seatPose(map, chair).dir).toBe(dir);
      const p = seatPose(map, chair);
      expect(canSitAt(map, chair, p.x, p.y)).toBe(true);
      expect(layoutError(map)).toBeNull();
    });
  it("four rotations preserve size, position, id and actions", () => {
    const original = workstationFixture("up").objects[0];
    let o = original;
    for (const dir of ["right", "down", "left", "up"] as const) {
      o = orientWorkstation(o, dir);
      expect(o.w * o.h).toBe(original.w * original.h);
      expect(o.w).toBe(dir === "up" || dir === "down" ? 4 : 1);
    }
    expect(o).toEqual(original);
  });
  it("does not attach a corner, distant surface, or a chair explicitly looking away", () => {
    const m = workstationFixture("up"),
      [desk, chair] = m.objects;
    expect(directionToSurface({ ...chair, x: desk.x + desk.w }, desk)).toBeNull();
    expect(directionToSurface({ ...chair, y: chair.y + 1 }, desk)).toBeNull();
    expect(attachedSurface(m, { ...chair, facing: "down" })).toBeNull();
    expect(seatPose(m, { ...chair, facing: "down" }).dir).toBe("down");
  });
});
