/**
 * Floor, walls and zone labels of a map in 3D, built as a dollhouse diorama:
 * - a floor slab with a painted floor (see floor-paint.ts), so the world sits on a clean base;
 * - thin walls through the tile centres: tall back walls with windows (LED strips and posters in the
 *   gaming house), every other wall cut low so the tilted camera sees into each room;
 * - glass railings and partitions on the rooftop;
 * - small zone name plates lying on the floor inside each area, never under a wall.
 */
import {
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type BufferGeometry,
  type Material,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { tileAt, type MapData, type MapObject } from "@/shared/map";
import { ICON_PATHS } from "@/shared/icons";
import { zoneIcon } from "@/shared/zone-icons";
import { TILE_M } from "./furniture3d";
import { FLOOR_PX, WALL_SHARE, paintFloor } from "./floor-paint";
import { roomPalette, type RoomPalette } from "./palette3d";
import { planWalls, type WallCell, type WallPlan } from "./wall-plan";

/** Height of the cut (low) walls and of the back walls, in metres. */
export const WALL_LOW = 0.5;
export const WALL_TALL = 1.5;
const WALL_T = TILE_M * WALL_SHARE;
const SLAB = 0.34;

export interface WorldModel {
  group: Group;
  /** Resolves once fonts are loaded and the zone plates are drawn. */
  ready: Promise<void>;
  dispose(): void;
}

/** Collects boxes with per-vertex colours (top face, sides, darker feet) into one geometry. */
class BoxBatch {
  private parts: BufferGeometry[] = [];
  add(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    side: string,
    top = side,
    foot = 0.84,
  ) {
    const g = new BoxGeometry(sx, sy, sz).toNonIndexed();
    g.translate(x, y, z);
    const pos = g.getAttribute("position"),
      nor = g.getAttribute("normal");
    const colors = new Float32Array(pos.count * 3);
    const s = new Color(side),
      t = new Color(top),
      c = new Color();
    const bottom = y - sy / 2;
    for (let i = 0; i < pos.count; i++) {
      if (nor.getY(i) > 0.5) c.copy(t);
      else {
        c.copy(s);
        // Slightly darker toward the floor: cheap ambient occlusion on tall surfaces.
        if (pos.getY(i) <= bottom + 1e-4 && sy > 0.2) c.multiplyScalar(foot);
      }
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new BufferAttribute(colors, 3));
    this.parts.push(g);
  }
  build(material: Material, shadows = true): Mesh | null {
    if (!this.parts.length) return null;
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach((g) => g.dispose());
    this.parts = [];
    const mesh = new Mesh(merged, material);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    return mesh;
  }
}

/** Thin body through the tile centre plus arms toward linked neighbours. */
function wallBody(batch: BoxBatch, c: WallCell, y0: number, h: number, t: number, side: string, top: string) {
  const cx = (c.x + 0.5) * TILE_M,
    cz = (c.y + 0.5) * TILE_M,
    half = TILE_M / 2;
  const y = y0 + h / 2;
  batch.add(cx, y, cz, t, h, t, side, top);
  // Arms reach from the body to the tile edge (a little overlap avoids hairline gaps).
  const len = half - t / 2 + 0.002;
  if (c.arms.e) batch.add(cx + t / 2 + len / 2, y, cz, len, h, t, side, top);
  if (c.arms.w) batch.add(cx - t / 2 - len / 2, y, cz, len, h, t, side, top);
  if (c.arms.s) batch.add(cx, y, cz + t / 2 + len / 2, t, h, len, side, top);
  if (c.arms.n) batch.add(cx, y, cz - t / 2 - len / 2, t, h, len, side, top);
}

/** Objects that stand against a wall and would hide a window or poster behind them. */
const TALL_KINDS = new Set<MapObject["kind"]>([
  "bookshelf",
  "whiteboard",
  "noticeboard",
  "tv",
  "vending",
  "fridge",
  "arcade",
  "greenscreen",
  "cabinet",
  "art",
  "coffee",
  "softbox",
  "speaker",
  "camera",
  "palm",
]);

function blocked(map: MapData, x0: number, x1: number, wallY: number) {
  return map.objects.some(
    (o) => TALL_KINDS.has(o.kind) && o.y <= wallY + 2 && o.y + o.h > wallY && o.x < x1 && o.x + o.w > x0,
  );
}

/** Windows (or LED strips and posters in the gaming house) along tall back walls. */
function backWallDetails(map: MapData, plan: WallPlan, pal: RoomPalette, solid: BoxBatch, glow: BoxBatch) {
  const gaming = map.template === "gaming";
  const tall = new Set(plan.cells.filter((c) => c.tall).map((c) => `${c.x},${c.y}`));
  const front = (x: number, y: number) => tall.has(`${x},${y}`) && plan.isFloor(x, y + 1);
  for (let y = 0; y < map.height; y++) {
    let x = 0;
    while (x < map.width) {
      if (!front(x, y)) {
        x++;
        continue;
      }
      let end = x;
      while (front(end + 1, y)) end++;
      const z = (y + 0.5) * TILE_M + WALL_T / 2;
      // Skirting board along the whole run.
      const run0 = x * TILE_M,
        run1 = (end + 1) * TILE_M;
      solid.add((run0 + run1) / 2, 0.05, z + 0.008, run1 - run0, 0.1, 0.02, pal.baseboard);
      if (gaming)
        glow.add((run0 + run1) / 2, WALL_TALL - 0.14, z + 0.01, run1 - run0 - 0.1, 0.035, 0.02, pal.accent);
      const posters = ["#8b6cff", "#4fd1c5", "#f06292", "#f2c94c"];
      for (let wx = x + 1; wx + 1 <= end - 1; wx += gaming ? 5 : 4) {
        if (blocked(map, wx, wx + 2, y)) continue;
        const cx = (wx + 1) * TILE_M;
        if (gaming) {
          const color = posters[(wx + y) % posters.length];
          solid.add(cx, 0.95, z + 0.012, 0.56, 0.74, 0.02, "#1b1a26");
          glow.add(cx, 0.95, z + 0.024, 0.46, 0.64, 0.01, color);
          continue;
        }
        const w = TILE_M * 2 - 0.22,
          h = 0.8,
          wy = 0.98;
        // Frame, glass, mullion and sill.
        solid.add(cx, wy, z - WALL_T / 2, w + 0.08, h + 0.08, WALL_T + 0.04, "#fbfaf6");
        glow.add(cx, wy, z - WALL_T / 2, w - 0.04, h - 0.04, WALL_T + 0.06, "#bfe2ee");
        solid.add(cx, wy, z + 0.035, 0.035, h - 0.04, 0.02, "#fbfaf6");
        solid.add(cx, wy - h / 2 - 0.03, z + 0.05, w + 0.14, 0.04, 0.1, "#fbfaf6");
      }
      x = end + 1;
    }
  }
}

function railings(plan: WallPlan, pal: RoomPalette, solid: BoxBatch, glass: BoxBatch) {
  for (const c of plan.cells) {
    if (c.style === "wall") continue;
    const rail = c.style === "rail";
    const h = rail ? 1.0 : 1.25;
    const base = rail ? 0.16 : 0.06;
    // Low curb, glass panel, top rail; a post at every tile centre.
    wallBody(solid, c, 0, base, WALL_T, rail ? pal.wall : "#3b4447", rail ? pal.wallTop : "#2a3134");
    wallBody(glass, c, base, h - base - 0.05, 0.03, "#cdebf2", "#cdebf2");
    wallBody(
      solid,
      c,
      h - 0.05,
      0.06,
      rail ? 0.07 : 0.05,
      rail ? pal.wood : "#3b4447",
      rail ? pal.woodLight : "#2a3134",
    );
    const cx = (c.x + 0.5) * TILE_M,
      cz = (c.y + 0.5) * TILE_M;
    solid.add(cx, h / 2, cz, 0.05, h, 0.05, rail ? pal.metal : "#3b4447");
  }
}

function slab(map: MapData, plan: WallPlan, pal: RoomPalette, batch: BoxBatch) {
  for (let y = 0; y < map.height; y++) {
    let x = 0;
    while (x < map.width) {
      if (plan.isVoid(x, y)) {
        x++;
        continue;
      }
      let end = x;
      while (end + 1 < map.width && !plan.isVoid(end + 1, y)) end++;
      const len = (end - x + 1) * TILE_M;
      batch.add(
        x * TILE_M + len / 2,
        -SLAB / 2 - 0.004,
        (y + 0.5) * TILE_M,
        len,
        SLAB,
        TILE_M,
        pal.slab,
        pal.slab,
        1,
      );
      x = end + 1;
    }
  }
}

const iconPaths = new Map<string, Path2D>();
/** A name plate texture: icon + label on a dark rounded pill (2x resolution for crisp text). */
function plateCanvas(label: string, icon: string, locked: boolean) {
  const scale = 2,
    h = 30,
    font = "600 15px Outfit, system-ui, sans-serif";
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = font;
  const w = Math.ceil(probe.measureText(label).width) + 46;
  const c = document.createElement("canvas");
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(14,27,33,0.86)";
  ctx.beginPath();
  ctx.roundRect(1, 1, w - 2, h - 2, 9);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (!iconPaths.has(icon)) iconPaths.set(icon, new Path2D(ICON_PATHS[icon]));
  ctx.save();
  ctx.translate(11, 8);
  ctx.scale(14 / 24, 14 / 24);
  ctx.strokeStyle = locked ? "#63e9bd" : "#d2e4e0";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(iconPaths.get(icon)!);
  ctx.restore();
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f2f7f5";
  ctx.fillText(label, 32, h / 2 + 1);
  return { canvas: c, w, h };
}

/** Lowest row of a zone where a plate fits on free floor (no wall, door or furniture). */
function plateSpot(map: MapData, plan: WallPlan, z: MapData["zones"][number], tilesWide: number) {
  const cx = Math.floor(z.x + z.w / 2);
  const span = Math.ceil(tilesWide / 2);
  const covered = (x: number, y: number) =>
    map.objects.some((o) => o.kind !== "rug" && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
  for (let y = z.y + z.h - 1; y >= z.y; y--) {
    let ok = true;
    for (let x = cx - span; x <= cx + span && ok; x++)
      // The row in front must be free too, or the low wall there would hide the plate.
      for (const yy of [y, y + 1])
        if (!plan.isFloor(x, yy) || tileAt(map, x, yy) === "door" || covered(x, yy)) ok = false;
    // Railings are taller than cut walls: keep one more row of distance from them.
    if (ok && map.template === "rooftop" && !plan.isFloor(cx, y + 2)) ok = false;
    if (ok) return { x: z.x + z.w / 2, y: y + 0.5 };
  }
  return { x: z.x + z.w / 2, y: z.y + z.h / 2 };
}

export function buildWorld(map: MapData, zoneLabel: (key: string) => string): WorldModel {
  const pal = roomPalette(map);
  const plan = planWalls(map);
  const W = map.width * TILE_M,
    D = map.height * TILE_M;
  const group = new Group();
  group.name = "World floor and walls";
  const disposables: Array<{ dispose(): void }> = [];

  // Floor: one painted plane; empty space (rooftop sky) is transparent and cut out.
  const floorTexture = new CanvasTexture(paintFloor(map, plan, pal));
  floorTexture.colorSpace = SRGBColorSpace;
  floorTexture.anisotropy = 8;
  disposables.push(floorTexture);
  const floor = new Mesh(
    new PlaneGeometry(W, D),
    new MeshStandardMaterial({ map: floorTexture, roughness: 0.9, alphaTest: 0.5 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0, D / 2);
  floor.receiveShadow = true;
  floor.name = "floor";
  group.add(floor);

  const solid = new BoxBatch(),
    glow = new BoxBatch(),
    glass = new BoxBatch(),
    base = new BoxBatch();
  slab(map, plan, pal, base);
  for (const c of plan.cells)
    if (c.style === "wall")
      wallBody(solid, c, 0, c.tall ? WALL_TALL : WALL_LOW, WALL_T, pal.wall, pal.wallTop);
  backWallDetails(map, plan, pal, solid, glow);
  railings(plan, pal, solid, glass);

  const solidMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.86 });
  // Window glass, LED strips and posters are unlit: they read as light sources in every ambience.
  const glowMat = new MeshBasicMaterial({ vertexColors: true });
  const glassMat = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const baseMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  disposables.push(solidMat, glowMat, glassMat, baseMat);
  const meshes = [
    base.build(baseMat, false),
    solid.build(solidMat),
    glow.build(glowMat, false),
    glass.build(glassMat, false),
  ];
  for (const m of meshes) if (m) group.add(m);

  // Zone plates: drawn once fonts are ready so the label font is right.
  const plates = new Group();
  plates.name = "zone plates";
  group.add(plates);
  const fonts = typeof document !== "undefined" && document.fonts ? document.fonts.ready : Promise.resolve();
  const ready = fonts
    .catch(() => undefined)
    .then(() => {
      for (const z of map.zones) {
        const { canvas, w, h } = plateCanvas(zoneLabel(z.label), zoneIcon(z.label), z.private);
        const pw = (w / FLOOR_PX) * TILE_M * 1.3,
          ph = (h / FLOOR_PX) * TILE_M * 1.3;
        const spot = plateSpot(map, plan, z, pw / TILE_M);
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = 4;
        const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
        const plate = new Mesh(new PlaneGeometry(pw, ph), mat);
        plate.rotation.x = -Math.PI / 2;
        plate.position.set(spot.x * TILE_M, 0.012, spot.y * TILE_M);
        plate.renderOrder = 1;
        plates.add(plate);
        disposables.push(tex);
      }
    });

  return {
    group,
    ready,
    dispose() {
      group.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      disposables.forEach((d) => d.dispose());
    },
  };
}
