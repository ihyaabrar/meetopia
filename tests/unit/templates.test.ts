import { describe, expect, it } from "vitest";
import { buildWalkable, isLockable, privateZoneAt, tileAt, zoneAt } from "@/shared/map";
import { findPath, nearestFree } from "@/shared/pathfinding";
import { TEMPLATE_IDS, TEMPLATE_REVS, buildTemplate } from "@/shared/templates";

describe.each(TEMPLATE_IDS)("jenis ruangan %s", (id) => {
  const map = buildTemplate(id);
  const grid = buildWalkable(map);

  it("ukuran konsisten, id objek unik, revisi template tercatat", () => {
    expect(map.template).toBe(id);
    expect(map.templateRev).toBe(TEMPLATE_REVS[id]);
    expect(map.tiles).toHaveLength(map.height);
    for (const row of map.tiles) expect(row).toHaveLength(map.width);
    const ids = map.objects.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("objek berada di dalam lantai, bukan di dinding", () => {
    for (const o of map.objects) {
      if (o.kind === "art") continue; // lukisan menempel di dinding
      for (let y = o.y; y < o.y + o.h; y++)
        for (let x = o.x; x < o.x + o.w; x++)
          expect(tileAt(map, x, y), `${o.id} @${x},${y}`).not.toBe("wall");
    }
  });

  it("titik muncul bisa dilewati dan tidak di ruang privat", () => {
    expect(grid[map.spawn.y][map.spawn.x]).toBe(true);
    expect(privateZoneAt(map, map.spawn.x + 0.5, map.spawn.y + 0.5)).toBeNull();
  });

  it("setiap area dan setiap objek interaktif bisa dicapai dari titik muncul", () => {
    for (const z of map.zones) {
      const target = nearestFree(grid, { x: z.x + Math.floor(z.w / 2), y: z.y + Math.floor(z.h / 2) })!;
      expect(zoneAt(map, target.x, target.y)?.id, z.id).toBe(z.id);
      expect(findPath(grid, map.spawn, target), z.id).not.toBeNull();
    }
    for (const o of map.objects) {
      if (!o.label) continue;
      const near = nearestFree(grid, { x: o.x + Math.floor(o.w / 2), y: o.y + o.h })!;
      expect(findPath(grid, map.spawn, near), o.id).not.toBeNull();
      expect(Math.hypot(near.x - (o.x + o.w / 2), near.y - (o.y + o.h)), o.id).toBeLessThan(2);
    }
  });

  it("ruangan yang bisa dikunci punya pintu", () => {
    for (const z of map.zones.filter(isLockable)) {
      let doors = 0;
      for (let y = z.y - 1; y <= z.y + z.h; y++)
        for (let x = z.x - 1; x <= z.x + z.w; x++) if (tileAt(map, x, y) === "door") doors++;
      expect(doors, z.id).toBeGreaterThan(0);
    }
  });

  it("menghasilkan salinan baru setiap kali (aman diubah)", () => {
    const a = buildTemplate(id);
    a.objects.pop();
    expect(buildTemplate(id).objects.length).toBe(map.objects.length);
  });
});

describe("kelebihan tiap jenis", () => {
  it("kantor punya ruang rapat yang bisa dikunci", () => {
    const z = buildTemplate("office").zones.find((z) => z.id === "meeting")!;
    expect(z.private && isLockable(z)).toBe(true);
  });
  it("rumah punya dua kamar kedap suara yang bisa dikunci dan speaker", () => {
    const m = buildTemplate("home");
    expect(m.zones.filter((z) => z.private && isLockable(z))).toHaveLength(2);
    expect(m.objects.some((o) => o.kind === "speaker")).toBe(true);
  });
  it("gaming house: ruang main kedap suara tapi tidak bisa dikunci (party)", () => {
    const m = buildTemplate("gaming");
    const party = m.zones.find((z) => z.id === "party")!;
    expect(party.private).toBe(true);
    expect(isLockable(party)).toBe(false);
    expect(m.objects.filter((o) => o.kind === "arcade").length).toBeGreaterThan(0);
  });
});
