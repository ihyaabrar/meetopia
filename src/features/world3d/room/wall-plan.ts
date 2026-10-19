/**
 * How the wall tiles of a map become 3D walls. Pure grid logic (no Three.js), shared by the world
 * builder and the tests.
 *
 * - Wall tiles with no floor around them are empty space (the rooftop's sky, filled corners): no wall.
 * - Outer back walls (floor in front, outside behind) stand tall with windows; every other wall is cut
 *   low, like a dollhouse, so the tilted camera always sees into every room.
 * - Walls are thin bodies through the tile centre with arms toward neighbouring walls and doors, so
 *   rooms keep their floor right up to the wall and door openings are exactly the door tiles.
 * - On the rooftop the outer edge is a glass railing and inner walls are glass partitions.
 */
import { tileAt, type MapData } from "@/shared/map";

export type WallStyle = "wall" | "rail" | "glass";

export interface WallCell {
  x: number;
  y: number;
  style: WallStyle;
  tall: boolean;
  /** Connections to the neighbouring wall or door tile (north, east, south, west). */
  arms: { n: boolean; e: boolean; s: boolean; w: boolean };
}

export interface WallPlan {
  cells: WallCell[];
  /** Wall tiles that are not drawn at all (no floor anywhere around them). */
  isVoid(x: number, y: number): boolean;
  /** Tile that people can stand on or pass through (floor or door). */
  isFloor(x: number, y: number): boolean;
}

export function planWalls(map: MapData): WallPlan {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height;
  const isFloor = (x: number, y: number) => inside(x, y) && tileAt(map, x, y) !== "wall";
  const isWall = (x: number, y: number) => inside(x, y) && tileAt(map, x, y) === "wall";
  const voids = new Set<number>();
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      if (!isWall(x, y)) continue;
      let floorNear = false;
      for (let dy = -1; dy <= 1 && !floorNear; dy++)
        for (let dx = -1; dx <= 1; dx++) if (isFloor(x + dx, y + dy)) floorNear = true;
      if (!floorNear) voids.add(y * map.width + x);
    }
  const isVoid = (x: number, y: number) => !inside(x, y) || voids.has(y * map.width + x);
  const isSolid = (x: number, y: number) => isWall(x, y) && !isVoid(x, y);
  const isOpen = (x: number, y: number) => isFloor(x, y) && tileAt(map, x, y) !== "door";
  const rooftop = map.template === "rooftop";

  const cells: WallCell[] = [];
  const byKey = new Map<number, WallCell>();
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      if (!isSolid(x, y)) continue;
      let style: WallStyle = "wall";
      if (rooftop) {
        let edge = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
        for (let dy = -1; dy <= 1 && !edge; dy++)
          for (let dx = -1; dx <= 1; dx++) if (isVoid(x + dx, y + dy)) edge = true;
        style = edge ? "rail" : "glass";
      }
      const link = (nx: number, ny: number) =>
        isSolid(nx, ny) || (inside(nx, ny) && tileAt(map, nx, ny) === "door");
      const cell: WallCell = {
        x,
        y,
        style,
        // Tall only for the outer back wall: open floor in front, the outside behind.
        tall: style === "wall" && isOpen(x, y + 1) && isVoid(x, y - 1),
        arms: { n: link(x, y - 1), e: link(x + 1, y), s: link(x, y + 1), w: link(x - 1, y) },
      };
      cells.push(cell);
      byKey.set(y * map.width + x, cell);
    }
  // Corners and wall ends behind the back wall keep its height, so the back wall reads as one piece.
  for (let pass = 0; pass < 2; pass++)
    for (const c of cells) {
      if (c.tall || c.style !== "wall" || !isVoid(c.x, c.y - 1) || isFloor(c.x, c.y + 1)) continue;
      const side = (dx: number) => byKey.get(c.y * map.width + c.x + dx);
      if (side(-1)?.tall || side(1)?.tall) c.tall = true;
    }
  return { cells, isVoid, isFloor };
}
