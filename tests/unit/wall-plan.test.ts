import { describe, expect, it } from "vitest";
import { tileAt } from "@/shared/map";
import { buildTemplate, TEMPLATE_IDS } from "@/shared/templates";
import { planWalls } from "@/features/world3d/room/wall-plan";

describe("3D wall plan", () => {
  for (const id of TEMPLATE_IDS) {
    it(`${id}: every wall next to floor is built, nothing else`, () => {
      const map = buildTemplate(id);
      const plan = planWalls(map);
      const built = new Set(plan.cells.map((c) => `${c.x},${c.y}`));
      for (let y = 0; y < map.height; y++)
        for (let x = 0; x < map.width; x++) {
          if (tileAt(map, x, y) !== "wall") {
            expect(built.has(`${x},${y}`)).toBe(false);
            continue;
          }
          let nearFloor = false;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) if (plan.isFloor(x + dx, y + dy)) nearFloor = true;
          expect(built.has(`${x},${y}`)).toBe(nearFloor);
          expect(plan.isVoid(x, y)).toBe(!nearFloor);
        }
    });

    it(`${id}: only the outer back wall is tall, and walls reach every door`, () => {
      const map = buildTemplate(id);
      const plan = planWalls(map);
      for (const c of plan.cells) {
        if (c.tall) {
          expect(c.style).toBe("wall");
          expect(plan.isVoid(c.x, c.y - 1)).toBe(true);
        }
        // A wall never stops short of a door next to it.
        if (tileAt(map, c.x + 1, c.y) === "door") expect(c.arms.e).toBe(true);
        if (tileAt(map, c.x, c.y + 1) === "door") expect(c.arms.s).toBe(true);
      }
      if (id !== "rooftop") {
        // The whole top row in front of a room is one tall back wall.
        const top = plan.cells.filter((c) => c.y === 0 && plan.isFloor(c.x, 1));
        expect(top.length).toBeGreaterThan(10);
        expect(top.every((c) => c.tall)).toBe(true);
        // Inner walls are cut low.
        expect(plan.cells.some((c) => c.y > 0 && !c.tall)).toBe(true);
      }
    });
  }

  it("rooftop: railings around the deck, glass partitions inside, no solid walls", () => {
    const plan = planWalls(buildTemplate("rooftop"));
    expect(plan.cells.some((c) => c.style === "rail")).toBe(true);
    expect(plan.cells.some((c) => c.style === "glass")).toBe(true);
    expect(plan.cells.every((c) => c.style !== "wall" && !c.tall)).toBe(true);
  });
});
