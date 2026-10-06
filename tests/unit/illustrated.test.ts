import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ILLUSTRATED_MAPS, illustrationFor } from "@/client/art/illustrated";
import { buildTemplate, TEMPLATE_IDS } from "@/shared/templates";

describe("illustrated map asset contract", () => {
  it.each(TEMPLATE_IDS)("uses a real versioned asset for %s", (id) => {
    const map = buildTemplate(id);
    const url = illustrationFor(map)!;
    expect(url).toBe(ILLUSTRATED_MAPS[id]);
    expect(existsSync(resolve("public", url.slice(1)))).toBe(true);
  });

  it("keeps art for audio changes and JSONB object/property reordering", () => {
    const map = buildTemplate("office");
    map.audio.radius = 8;
    map.objects = map.objects.reverse().map((o) => ({
      h: o.h,
      w: o.w,
      y: o.y,
      x: o.x,
      kind: o.kind,
      id: o.id,
      solid: o.solid,
      facing: o.facing,
    }));
    expect(illustrationFor(map)).toBe(ILLUSTRATED_MAPS.office);
  });

  it("does not draw official art behind edited or stale collision geometry", () => {
    const moved = buildTemplate("office");
    moved.objects[0].x += 1;
    expect(illustrationFor(moved)).toBeNull();
    const stale = buildTemplate("office");
    stale.templateRev = 1;
    expect(illustrationFor(stale)).toBeNull();
    const unknown = buildTemplate("office");
    unknown.template = "custom";
    expect(illustrationFor(unknown)).toBeNull();
  });
});
