import { describe, expect, it } from "vitest";
import { buildWalkable, privateZoneAt, tileAt } from "@/shared/map";
import { OFFICE_TEMPLATE } from "@/shared/templates";
import { findPath, nearestFree } from "@/shared/pathfinding";

const map = OFFICE_TEMPLATE;
const grid = buildWalkable(map);

describe("peta template", () => {
  it("punya ukuran dan baris yang konsisten", () => {
    expect(map.tiles).toHaveLength(map.height);
    for (const row of map.tiles) expect(row).toHaveLength(map.width);
  });

  it("titik muncul bisa dilewati dan berada di lobi", () => {
    expect(grid[map.spawn.y][map.spawn.x]).toBe(true);
    expect(tileAt(map, map.spawn.x, map.spawn.y)).toBe("lobby");
  });

  it("setiap area bisa dicapai dari titik muncul", () => {
    for (const z of map.zones) {
      const target = nearestFree(grid, { x: z.x + Math.floor(z.w / 2), y: z.y + Math.floor(z.h / 2) })!;
      expect(findPath(grid, map.spawn, target), z.id).not.toBeNull();
    }
  });

  it("ruang rapat adalah ruang privat", () => {
    expect(privateZoneAt(map, 30.5, 2.5)?.id).toBe("meeting");
    expect(privateZoneAt(map, map.spawn.x + 0.5, map.spawn.y + 0.5)).toBeNull();
  });
});

describe("pencarian jalur", () => {
  it("tidak menembus dinding atau objek padat", () => {
    const path = findPath(grid, map.spawn, { x: 30, y: 2 })!;
    expect(path.length).toBeGreaterThan(0);
    for (const p of path) expect(grid[p.y][p.x], `${p.x},${p.y}`).toBe(true);
  });

  it("tidak memotong sudut secara diagonal", () => {
    const path = findPath(grid, map.spawn, { x: 30, y: 2 })!;
    let prev = map.spawn;
    for (const p of path) {
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      expect(Math.abs(dx) <= 1 && Math.abs(dy) <= 1).toBe(true);
      if (dx && dy) {
        expect(grid[prev.y][prev.x + dx]).toBe(true);
        expect(grid[prev.y + dy][prev.x]).toBe(true);
      }
      prev = p;
    }
  });

  it("mengembalikan null bila tujuan tertutup dan nearestFree mencari tile terdekat", () => {
    expect(findPath(grid, map.spawn, { x: 0, y: 0 })).toBeNull();
    const n = nearestFree(grid, { x: 0, y: 0 })!;
    expect(grid[n.y][n.x]).toBe(true);
  });

  it("bisa diblokir oleh area tertentu", () => {
    const blocked = (p: { x: number; y: number }) =>
      privateZoneAt(map, p.x + 0.5, p.y + 0.5)?.id === "meeting";
    expect(findPath(grid, map.spawn, { x: 30, y: 2 }, blocked)).toBeNull();
  });
});
