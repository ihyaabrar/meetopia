import { describe, it, expect } from "vitest";
import { buildTemplate, TEMPLATE_IDS } from "@/shared/templates";
import { layoutError, resizeMap, objectPlacementError, mapEditSchema } from "@/shared/map-edit";
import { canSitAt, seatPose } from "@/shared/seats";
import { clientMessageSchema } from "@/shared/protocol";
import { ROOM_SIZES } from "@/shared/map";

describe("five layered worlds and authoritative seats", () => {
  for (const id of TEMPLATE_IDS)
    for (const size of ROOM_SIZES)
      it(`${id} / ${size}: every room and seat remains reachable`, () => {
        const m = resizeMap(buildTemplate(id), size);
        expect(layoutError(m)).toBeNull();
        for (const o of m.objects.filter((o) => o.actions?.includes("sit"))) {
          const p = seatPose(m, o);
          expect(canSitAt(m, o, p.x, p.y)).toBe(true);
          expect(["up", "down", "left", "right"]).toContain(p.dir);
        }
      });
  it("desk chair faces its desk and explicit orientation wins", () => {
    const map = buildTemplate("office"),
      chair = map.objects.find((o) => o.kind === "chair" && !o.facing)!;
    expect(seatPose(map, chair).dir).toBe("up");
    expect(seatPose(map, { ...chair, facing: "left" }).dir).toBe("left");
    expect(canSitAt(map, chair, -100, -100)).toBe(false);
    expect(
      canSitAt(
        map,
        map.objects.find((o) => o.kind === "desk"),
        chair.x,
        chair.y,
      ),
    ).toBe(false);
  });
  it("sofa slots are distinct and clamp out-of-range requests", () => {
    const m = buildTemplate("office"),
      s = m.objects.find((o) => o.kind === "sofa")!;
    expect(seatPose(m, s, 0).x).not.toBe(seatPose(m, s, 1).x);
    expect(seatPose(m, s, 999).x).toBeLessThan(s.x + s.w);
  });
  it("rejects walls, doors, blocking furniture, invalid edits and missing version", () => {
    const m = buildTemplate("office"),
      desk = m.objects.find((o) => o.kind === "desk")!;
    expect(objectPlacementError(m, { ...desk, id: "new", x: 0, y: 0 })).toBeTruthy();
    expect(objectPlacementError(m, { ...desk, id: "new" })).toBeTruthy();
    expect(mapEditSchema.safeParse({ objects: [] }).success).toBe(false);
    expect(
      clientMessageSchema.safeParse({ t: "sit", sitting: true, objectId: desk.id, seatIndex: -1 }).success,
    ).toBe(false);
  });
  it("requires explicit partner and accepted reply for paired gestures", () => {
    expect(
      clientMessageSchema.safeParse({ t: "pairInvite", action: "handshake", toUserId: "peer" }).success,
    ).toBe(true);
    expect(clientMessageSchema.safeParse({ t: "pairInvite", action: "wave", toUserId: "peer" }).success).toBe(
      false,
    );
    expect(clientMessageSchema.safeParse({ t: "pairReply", requestId: "a", accept: true }).success).toBe(
      true,
    );
  });
});
