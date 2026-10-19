/**
 * Procedural 3D models for every map object kind, built from the same MapData the 2D renderer uses.
 * Each object is modelled in a local frame (origin at the footprint centre on the floor, metres,
 * the operator/sitter looking toward -Z), rotated by its facing and merged with every other object
 * into one mesh per material, so a whole world costs a few dozen draw calls.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from "three";
import { ModelKit, transformGeometry, type Vec3 } from "../model-kit";
import { seatCount } from "@/shared/seats";
import { attachedSurface, workstationFacing, workstationSeat } from "@/shared/workstation";
import type { MapData, MapObject } from "@/shared/map";
import { roomLight, roomPalette, type RoomPalette } from "./palette3d";

/** Metres per map tile. Shared by the room renderer, picking and avatars. */
export const TILE_M = 0.6;

const C = {
  oak: "#c68a49",
  lightOak: "#dcaa65",
  darkOak: "#875730",
  ink: "#213b3b",
  mint: "#39d4a0",
  screen: "#143d38",
  olive: "#6f7d3f",
  oliveDark: "#56632f",
  cream: "#f1e6cf",
  white: "#f4f1ea",
  metal: "#a7b0b2",
  dark: "#2b3436",
  teal: "#244f43",
  tealLight: "#2c6351",
  terracotta: "#b9683d",
  soil: "#4a3f28",
  leaf: "#3f8f4a",
  leafLight: "#5da34e",
  red: "#c4553f",
  glass: "#9fd3c6",
};

/** Colours of the world being built (set by buildFurniture; builders run synchronously inside it). */
let pal: RoomPalette = roomPalette({ template: "office" } as MapData);

/** Yaw that turns the local -Z gaze toward a map direction (+Z is south on the 2D map). */
export function facingYaw(dir: string | undefined): number {
  return dir === "down" ? Math.PI : dir === "left" ? Math.PI / 2 : dir === "right" ? -Math.PI / 2 : 0;
}

/** A ModelKit whose primitives are placed by one object transform. */
class PlacedKit extends ModelKit {
  matrix = new Matrix4();
  override add(g: BufferGeometry, color: string, metalness = 0, roughness = 0.72, emissive = false) {
    g.applyMatrix4(this.matrix);
    super.add(g, color, metalness, roughness, emissive);
  }
  cyl(p: Vec3, rTop: number, rBottom: number, h: number, color: string, segments = 16, emissive = false) {
    this.add(
      transformGeometry(new CylinderGeometry(rTop, rBottom, h, segments), p),
      color,
      0,
      0.72,
      emissive,
    );
  }
  glow(p: Vec3, s: Vec3, color: string) {
    this.add(transformGeometry(new SphereGeometry(1, 14, 10), p, s), color, 0, 0.4, true);
  }
}

type Builder = (k: PlacedKit, w: number, d: number, o: MapObject, map: MapData) => void;

function legs(k: PlacedKit, w: number, d: number, h: number, color: string, inset = 0.06, r = 0.025) {
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      k.rod(
        [sx * (w / 2 - inset), 0, sz * (d / 2 - inset)],
        [sx * (w / 2 - inset), h, sz * (d / 2 - inset)],
        r,
        color,
      );
}

function plant(k: PlacedKit, scale: number, x = 0, z = 0, y = 0) {
  k.cyl([x, y + 0.14 * scale, z], 0.16 * scale, 0.12 * scale, 0.28 * scale, C.terracotta, 18);
  k.cyl([x, y + 0.27 * scale, z], 0.145 * scale, 0.145 * scale, 0.02, C.soil, 18);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4,
      height = (0.42 + (i % 3) * 0.13) * scale;
    const end: Vec3 = [x + Math.sin(a) * 0.21 * scale, y + height, z + Math.cos(a) * 0.21 * scale];
    k.rod([x, y + 0.24 * scale, z], end, 0.006 * scale, "#315c31");
    k.add(
      transformGeometry(
        new SphereGeometry(1, 10, 7),
        end,
        [0.06 * scale, 0.19 * scale, 0.014 * scale],
        [Math.sin(a) * 0.6, a, Math.cos(a) * 0.8],
      ),
      i % 2 ? C.leaf : C.leafLight,
    );
  }
}

/** A flat lit screen panel facing +Z (thin box, not a squashed sphere). */
function screen(k: PlacedKit, p: Vec3, w: number, h: number, color: string) {
  k.add(transformGeometry(new BoxGeometry(w, h, 0.006), p), color, 0, 0.25, true);
}

function monitor(k: PlacedKit, x: number, z: number, deskTop: number, width = 0.56, dark = C.ink) {
  // Screen faces +Z, toward the operator who sits on the +Z side and looks toward -Z.
  k.box([x, deskTop + 0.015, z], [0.22, 0.03, 0.15], dark, 0.012);
  k.rod([x, deskTop + 0.02, z], [x, deskTop + 0.26, z], 0.016, dark);
  k.box([x, deskTop + 0.3, z], [width, 0.33, 0.045], dark, 0.02);
  screen(k, [x, deskTop + 0.305, z + 0.024], width - 0.05, 0.28, "#2c6f8f");
}

function deskCore(k: PlacedKit, w: number, d: number, top: string, frame: string, gaming = false) {
  const h = 0.72;
  k.box([0, h - 0.03, 0], [w - 0.04, 0.06, d - 0.06], top, 0.03);
  if (gaming) {
    for (const sx of [-1, 1]) k.box([sx * (w / 2 - 0.1), h / 2, 0], [0.06, h - 0.06, d - 0.16], frame, 0.02);
    k.add(
      transformGeometry(new BoxGeometry(w - 0.12, 0.014, 0.012), [0, h - 0.07, d / 2 - 0.05]),
      pal.accent,
      0,
      0.4,
      true,
    );
  } else {
    legs(k, w - 0.04, d - 0.06, h - 0.06, frame, 0.07, 0.028);
    k.box([0, 0.55, -d / 2 + 0.08], [w - 0.24, 0.07, 0.03], frame, 0.01);
  }
  return h;
}

/** Desk props sit where the attached seat's operator can reach them. */
const desk: Builder = (k, w, d, o, map) => {
  const gaming = o.kind === "gamingDesk";
  const h = deskCore(k, w, d, gaming ? "#2b2f3a" : pal.woodLight, gaming ? "#1b1f27" : pal.woodDark, gaming);
  const seat = workstationSeat(map, o);
  // Operator side is +Z in the local frame (the desk is yawed by the operator's gaze); put the
  // monitor and keyboard in front of the attached chair, wherever it sits along the desk.
  const yaw = facingYaw(workstationFacing(map, o));
  const dx = seat ? (seat.x + seat.w / 2 - (o.x + o.w / 2)) * TILE_M : 0,
    dz = seat ? (seat.y + seat.h / 2 - (o.y + o.h / 2)) * TILE_M : 0;
  const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const cx = Math.max(-w / 2 + 0.4, Math.min(w / 2 - 0.4, lx));
  if (gaming) {
    monitor(k, cx - 0.32, -d / 2 + 0.16, h, 0.5, "#16181e");
    monitor(k, cx + 0.32, -d / 2 + 0.16, h, 0.5, "#16181e");
  } else monitor(k, cx, -d / 2 + 0.14, h);
  k.box([cx, h + 0.012, d / 2 - 0.15], [0.39, 0.025, 0.13], "#314942", 0.009);
  k.box([cx, h + 0.027, d / 2 - 0.15], [0.35, 0.006, 0.1], "#d9e4d6", 0.003);
  k.sphere([cx + 0.3, h + 0.02, d / 2 - 0.15], [0.035, 0.022, 0.05], "#e6dfce");
  if (!gaming && w > 1.2) {
    k.cyl([cx - 0.55, h + 0.05, 0], 0.045, 0.04, 0.1, C.cream, 16);
    k.box([cx + 0.62, h + 0.012, -0.02], [0.22, 0.02, 0.28], "#276b50", 0.007);
  }
};

type ChairStyle = "office" | "gaming" | "dining";
function chairStyle(map: MapData, o: MapObject): ChairStyle {
  const surface = attachedSurface(map, o)?.surface;
  if (surface?.kind === "gamingDesk" || map.template === "gaming") return "gaming";
  if (surface?.kind === "desk") return "office";
  return map.template === "office" || map.template === "studio" ? "office" : "dining";
}

function starBase(k: PlacedKit, color: string) {
  k.rod([0, 0.09, 0], [0, 0.375, 0], 0.03, color);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    k.rod([0, 0.11, 0], [Math.sin(a) * 0.26, 0.05, Math.cos(a) * 0.26], 0.02, color);
    k.sphere([Math.sin(a) * 0.26, 0.035, Math.cos(a) * 0.26], [0.035, 0.035, 0.035], "#15191a");
  }
}

const chair: Builder = (k, _w, _d, o, map) => {
  // Sitter looks toward -Z; the backrest is behind them at +Z.
  const style = chairStyle(map, o);
  if (style === "dining") {
    k.box([0, 0.43, 0], [0.42, 0.05, 0.4], pal.wood, 0.02);
    k.box([0, 0.47, -0.01], [0.36, 0.03, 0.32], pal.fabricLight, 0.015);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        k.rod([sx * 0.17, 0, sz * 0.16], [sx * 0.17, 0.42, sz * 0.16], 0.018, pal.woodDark);
    for (const sx of [-1, 1]) k.rod([sx * 0.17, 0.42, 0.17], [sx * 0.17, 0.86, 0.19], 0.018, pal.woodDark);
    k.box([0, 0.78, 0.18], [0.38, 0.12, 0.03], pal.wood, 0.01);
    k.box([0, 0.6, 0.175], [0.3, 0.04, 0.02], pal.wood, 0.008);
    return;
  }
  if (style === "gaming") {
    k.box([0, 0.4, 0], [0.48, 0.07, 0.44], pal.chair, 0.04);
    for (const sx of [-1, 1]) k.box([sx * 0.2, 0.45, 0], [0.08, 0.06, 0.42], pal.accent, 0.03);
    k.box([0, 0.78, 0.21], [0.46, 0.72, 0.08], pal.chair, 0.05, [0.12, 0, 0]);
    for (const sx of [-1, 1])
      k.box([sx * 0.15, 0.8, 0.255], [0.06, 0.6, 0.02], pal.accent, 0.01, [0.12, 0, 0]);
    k.box([0, 1.08, 0.25], [0.24, 0.1, 0.06], pal.accent, 0.03, [0.12, 0, 0]);
    for (const side of [-1, 1]) k.box([side * 0.26, 0.56, 0], [0.05, 0.03, 0.26], pal.chairFrame, 0.014);
    starBase(k, pal.chairFrame);
    return;
  }
  k.box([0, 0.397, 0], [0.44, 0.05, 0.42], pal.chair, 0.045);
  k.box([0, 0.65, 0.2], [0.43, 0.42, 0.065], pal.chair, 0.04, [0.09, 0, 0]);
  k.box([0, 0.66, 0.235], [0.37, 0.32, 0.01], pal.fabricLight, 0.01, [0.09, 0, 0]);
  for (const side of [-1, 1]) k.box([side * 0.235, 0.54, -0.01], [0.045, 0.028, 0.24], pal.chairFrame, 0.014);
  starBase(k, pal.chairFrame);
};

const sofa: Builder = (k, w, d, o) => {
  // Sitters look toward -Z, the back cushion is at +Z. One seat cushion per place.
  const long = Math.max(w, d),
    deep = Math.min(w, d);
  const across = w >= d;
  const L = across ? long : deep,
    D = across ? deep : long;
  void L;
  const W = across ? w : d,
    Dp = across ? d : w;
  k.box([0, 0.2, 0], [W - 0.04, 0.26, Dp - 0.08], pal.fabric, 0.06);
  k.box([0, 0.55, Dp / 2 - 0.12], [W - 0.08, 0.5, 0.2], pal.fabric, 0.08);
  for (const sx of [-1, 1]) k.box([sx * (W / 2 - 0.1), 0.42, 0], [0.18, 0.32, Dp - 0.1], pal.fabric, 0.07);
  const n = seatCount(o);
  const span = W - 0.36;
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + (span * (i + 0.5)) / n;
    k.box([x, 0.38, -0.02], [span / n - 0.03, 0.11, Dp - 0.32], pal.fabricLight, 0.05);
  }
  k.box([-W / 2 + 0.32, 0.55, Dp / 2 - 0.26], [0.26, 0.24, 0.1], pal.pillow, 0.05, [0.2, 0.3, 0]);
  k.box([W / 2 - 0.32, 0.55, Dp / 2 - 0.26], [0.26, 0.24, 0.1], pal.pillow2, 0.05, [0.2, -0.3, 0]);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      k.cyl([sx * (W / 2 - 0.08), 0.04, sz * (Dp / 2 - 0.1)], 0.03, 0.022, 0.08, pal.woodDark, 8);
  void D;
};

const beanbag: Builder = (k, _w, _d, o) => {
  const color = (o.x + o.y) % 2 ? pal.pillow2 : pal.fabricLight;
  k.sphere([0, 0.17, 0.02], [0.3, 0.2, 0.28], color);
  k.sphere([0, 0.33, 0.14], [0.22, 0.16, 0.12], color);
};

const bed: Builder = (k, w, d) => {
  k.box([0, 0.18, 0], [w - 0.06, 0.24, d - 0.06], pal.woodDark, 0.04);
  k.box([0, 0.36, 0.02], [w - 0.14, 0.14, d - 0.14], C.white, 0.06);
  // The sitter faces -Z: blanket toward them, headboard and pillows behind (+Z).
  k.box([0, 0.44, -0.18], [w - 0.18, 0.06, d * 0.55], "#5b7f9c", 0.05);
  k.box([0, 0.55, d / 2 - 0.06], [w - 0.06, 0.6, 0.08], pal.woodDark, 0.03);
  const pillows = Math.max(1, Math.round(w / 1.2));
  for (let i = 0; i < pillows; i++)
    k.box(
      [-w / 2 + (w * (i + 0.5)) / pillows, 0.47, d / 2 - 0.3],
      [Math.min(0.6, w / pillows - 0.12), 0.1, 0.32],
      C.cream,
      0.05,
    );
};

const table: Builder = (k, w, d) => {
  k.box([0, 0.71, 0], [w - 0.04, 0.06, d - 0.04], pal.wood, 0.04);
  legs(k, w - 0.04, d - 0.04, 0.68, pal.woodDark, 0.12, 0.035);
};

const counter: Builder = (k, w, d) => {
  k.box([0, 0.44, 0], [w - 0.02, 0.86, d - 0.06], C.cream, 0.02);
  k.box([0, 0.9, 0], [w, 0.05, d], "#3a4447", 0.015);
  const doors = Math.max(1, Math.round(w / 0.6));
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / doors;
    k.box([x, 0.45, d / 2 - 0.02], [w / doors - 0.04, 0.7, 0.01], "#e6dbc2", 0.01);
    k.box([x, 0.7, d / 2 + 0.005], [0.12, 0.015, 0.015], C.metal, 0.005);
  }
  k.cyl([w / 2 - 0.4, 0.98, -0.05], 0.06, 0.07, 0.12, C.metal, 12);
};

const tall =
  (color: string, h: number): Builder =>
  (k, w, d) => {
    k.box([0, h / 2, 0], [w - 0.08, h, d - 0.08], color, 0.03);
  };

const builders: Partial<Record<MapObject["kind"], Builder>> = {
  desk,
  gamingDesk: desk,
  chair,
  sofa,
  beanbag,
  bed,
  table,
  counter,
  plant: (k, w, d) => plant(k, Math.min(w, d) > 0.9 ? 1.6 : 1.3),
  palm: (k) => {
    k.cyl([0, 0.15, 0], 0.2, 0.16, 0.3, C.terracotta, 16);
    k.rod([0, 0.2, 0], [0.05, 1.7, 0.02], 0.05, "#8a6a45", 0.035);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.add(
        transformGeometry(
          new SphereGeometry(1, 10, 6),
          [0.05 + Math.sin(a) * 0.35, 1.62, 0.02 + Math.cos(a) * 0.35],
          [0.38, 0.03, 0.1],
          [0, a + Math.PI / 2, -0.35],
        ),
        i % 2 ? C.leaf : C.leafLight,
      );
    }
  },
  lamp: (k) => {
    k.cyl([0, 0.015, 0], 0.13, 0.15, 0.03, pal.woodDark, 18);
    k.rod([0, 0.03, 0], [0, 1.25, 0], 0.014, pal.chairFrame);
    k.add(
      transformGeometry(new CylinderGeometry(0.13, 0.19, 0.24, 20, 1, true), [0, 1.32, 0]),
      "#efe0c2",
      0,
      0.6,
      true,
    );
    k.glow([0, 1.28, 0], [0.05, 0.06, 0.05], "#ffd98f");
  },
  bookshelf: (k, w, d) => {
    const h = 1.5;
    k.box([0, h / 2, -0.03], [w - 0.06, h, d - 0.16], pal.woodDark, 0.02);
    for (const sx of [-1, 1]) k.box([sx * (w / 2 - 0.05), h / 2, 0], [0.04, h, d - 0.1], pal.wood, 0.01);
    k.box([0, h - 0.02, 0], [w - 0.06, 0.04, d - 0.1], pal.wood, 0.01);
    const shelves = 4;
    for (let s = 0; s < shelves; s++) {
      const y = 0.1 + s * 0.36;
      k.box([0, y, 0.02], [w - 0.14, 0.025, d - 0.14], pal.woodLight, 0.008);
      const books = Math.floor((w - 0.2) / 0.07);
      for (let i = 0; i < books; i++)
        if ((i * 7 + s * 3) % 5 !== 0)
          k.box(
            [-w / 2 + 0.12 + i * 0.07, y + 0.13, 0.05],
            [0.05, 0.22 + ((i + s) % 3) * 0.03, d - 0.3],
            ["#36795e", "#d7be8c", "#a85235", "#557a93", "#c9a24a"][(i + s) % 5],
            0.004,
          );
    }
  },
  cabinet: (k, w, d) => {
    k.box([0, 0.5, 0], [w - 0.06, 1, d - 0.1], pal.woodDark, 0.02);
    for (let i = 0; i < 3; i++) {
      k.box([0, 0.2 + i * 0.3, d / 2 - 0.04], [w - 0.16, 0.26, 0.02], pal.wood, 0.01);
      k.box([0, 0.28 + i * 0.3, d / 2 - 0.02], [0.14, 0.02, 0.02], C.metal, 0.005);
    }
  },
  tv: (k, w, d) => {
    // Low media console with the screen on a short stand; the screen faces +Z.
    const sw = Math.min(w - 0.2, 1.4);
    k.box([0, 0.2, 0], [w - 0.1, 0.4, Math.min(d - 0.1, 0.42)], pal.woodDark, 0.03);
    for (const sx of [-1, 1])
      k.box([sx * (w / 4), 0.22, Math.min(d - 0.1, 0.42) / 2], [w / 2 - 0.16, 0.28, 0.01], pal.wood, 0.01);
    k.box([0, 0.43, -0.04], [0.3, 0.04, 0.16], "#1a1f22", 0.01);
    k.rod([0, 0.44, -0.06], [0, 0.56, -0.06], 0.03, "#1a1f22");
    k.box([0, 0.86, -0.06], [sw, sw * 0.56 + 0.05, 0.05], "#121618", 0.015);
    screen(k, [0, 0.86, -0.033], sw - 0.06, sw * 0.56 - 0.01, "#2a5d78");
  },
  speaker: (k) => {
    // Floor-standing wooden speaker: two drivers, a tweeter and a small status light.
    k.box([0, 0.47, 0], [0.34, 0.94, 0.3], pal.woodDark, 0.03);
    k.box([0, 0.47, 0.151], [0.28, 0.86, 0.01], "#23272a", 0.01);
    for (const [y, r] of [
      [0.3, 0.1],
      [0.56, 0.1],
      [0.78, 0.045],
    ] as const) {
      k.add(
        transformGeometry(new CylinderGeometry(r, r, 0.02, 20), [0, y, 0.16], [1, 1, 1], [Math.PI / 2, 0, 0]),
        "#3b4246",
      );
      k.add(
        transformGeometry(
          new CylinderGeometry(r * 0.35, r * 0.35, 0.025, 14),
          [0, y, 0.165],
          [1, 1, 1],
          [Math.PI / 2, 0, 0],
        ),
        "#15181a",
      );
    }
    k.glow([0.1, 0.88, 0.16], [0.012, 0.012, 0.006], pal.accent);
  },
  whiteboard: (k, w) => {
    for (const sx of [-1, 1]) k.rod([sx * (w / 2 - 0.1), 0, 0], [sx * (w / 2 - 0.1), 1.6, 0], 0.02, C.metal);
    k.box([0, 1.15, 0], [w - 0.1, 0.8, 0.04], "#f7f7f2", 0.01);
    const notes = ["#f2c94c", "#7bc7e8", "#f28fb0", "#9ad27a"];
    for (let i = 0; i < 6; i++)
      k.box(
        [-w / 2 + 0.25 + (i % 3) * 0.3, 1.32 - Math.floor(i / 3) * 0.28, 0.025],
        [0.2, 0.18, 0.01],
        notes[i % 4],
        0.004,
      );
  },
  noticeboard: (k, w) => {
    k.box([0, 1.2, 0], [w - 0.1, 0.9, 0.05], "#b98a52", 0.02);
    k.box([0, 1.2, 0.03], [w - 0.2, 0.8, 0.01], "#d9b98a", 0.01);
    for (let i = 0; i < 5; i++)
      k.box([-w / 2 + 0.3 + i * 0.28, 1.25 + (i % 2) * 0.15, 0.04], [0.2, 0.24, 0.01], C.white, 0.004);
    for (const sx of [-1, 1])
      k.rod([sx * (w / 2 - 0.12), 0, 0], [sx * (w / 2 - 0.12), 0.76, 0], 0.02, C.darkOak);
  },
  welcome: (k, w, d) => {
    // Reception counter: wood top, panelled front toward the visitor (+Z), a lower desk behind.
    k.box([0, 0.5, 0.06], [w - 0.1, 1.0, d - 0.34], pal.wood, 0.04);
    const panels = Math.max(2, Math.round(w / 0.6));
    for (let i = 0; i < panels; i++)
      k.box(
        [-w / 2 + 0.05 + ((w - 0.1) * (i + 0.5)) / panels, 0.5, d / 2 - 0.1],
        [(w - 0.1) / panels - 0.06, 0.8, 0.02],
        pal.woodLight,
        0.01,
      );
    k.box([0, 1.02, 0.06], [w, 0.05, d - 0.26], "#efe9df", 0.02);
    k.box([0, 0.12, d / 2 - 0.09], [w - 0.12, 0.06, 0.03], pal.accent, 0.01);
    k.box([0, 0.74, -d / 2 + 0.2], [w - 0.3, 0.04, 0.34], pal.wood, 0.02);
    monitor(k, -w / 4, -d / 2 + 0.18, 0.76, 0.42);
    plant(k, 0.45, w / 2 - 0.3, 0.06, 1.045);
  },
  vending: (k, w, d) => {
    k.box([0, 0.85, 0], [w - 0.1, 1.7, d - 0.1], "#2d7a5c", 0.04);
    k.box([-0.1, 1.0, d / 2 - 0.04], [w * 0.55, 1.1, 0.02], C.glass, 0.01);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 3; c++)
        k.box(
          [-0.1 - w * 0.2 + c * w * 0.2, 0.62 + r * 0.25, d / 2 - 0.08],
          [0.12, 0.14, 0.06],
          ["#e05a47", "#f2c94c", "#4aa3df"][(r + c) % 3],
          0.01,
        );
    k.glow([w / 2 - 0.2, 1.2, d / 2 - 0.04], [0.05, 0.05, 0.01], "#7df5c5");
  },
  coffee: (k, w, d) => {
    // Wooden coffee bar cabinet with an espresso machine, cups and a small status light.
    k.box([0, 0.45, 0], [w - 0.08, 0.9, d - 0.1], pal.wood, 0.02);
    k.box([0, 0.915, 0], [w - 0.04, 0.03, d - 0.06], "#e9e4da", 0.01);
    k.box([0, 0.45, d / 2 - 0.05], [w - 0.2, 0.7, 0.02], pal.woodLight, 0.01);
    k.box([-0.12, 1.1, -0.04], [0.36, 0.34, 0.3], "#2b3134", 0.03);
    k.box([-0.12, 1.02, 0.12], [0.24, 0.02, 0.06], C.metal, 0.005);
    k.cyl([-0.12, 0.96, 0.12], 0.04, 0.035, 0.08, C.white, 12);
    for (let i = 0; i < 3; i++)
      k.cyl([0.22 + i * 0.1, 0.96, 0.06], 0.035, 0.03, 0.07, i % 2 ? pal.accent : C.white, 12);
    k.glow([0.0, 1.18, 0.115], [0.015, 0.015, 0.006], "#f59e5b");
  },
  cooler: (k) => {
    k.box([0, 0.5, 0], [0.34, 1.0, 0.34], C.white, 0.03);
    k.cyl([0, 1.2, 0], 0.13, 0.13, 0.4, "#7cc4e0", 16);
  },
  fridge: (k, w, d) => {
    k.box([0, 0.9, 0], [w - 0.08, 1.8, d - 0.1], "#dfe5e3", 0.04);
    k.box([0, 1.2, d / 2 - 0.04], [w - 0.14, 0.01, 0.02], "#b8c1bf", 0.004);
    k.box([w / 2 - 0.15, 1.45, d / 2 - 0.02], [0.03, 0.3, 0.03], C.metal, 0.01);
  },
  arcade: (k, w, d) => {
    k.box([0, 0.85, 0], [w - 0.1, 1.7, d - 0.1], "#3d2a6b", 0.04);
    k.box([0, 1.25, d / 2 - 0.05], [w - 0.24, 0.42, 0.02], "#1d1838", 0.01);
    screen(k, [0, 1.25, d / 2 - 0.035], w - 0.32, 0.34, "#7d6bff");
    k.glow([0, 1.62, d / 2 - 0.06], [(w - 0.2) / 2, 0.04, 0.02], "#f06292");
    k.box([0, 0.95, d / 2], [w - 0.2, 0.06, 0.2], "#2a1d4a", 0.02);
  },
  printer: (k, w, d) => {
    k.box([0, 0.35, 0], [w - 0.1, 0.7, d - 0.12], "#d7dbd9", 0.03);
    k.box([0, 0.72, 0], [w - 0.2, 0.06, d - 0.22], "#3a4447", 0.02);
  },
  art: (k, w) => {
    k.box([0, 1.1, 0], [w - 0.2, 0.7, 0.04], C.darkOak, 0.01);
    k.box([0, 1.1, 0.025], [w - 0.32, 0.58, 0.01], "#e9b44c", 0.005);
    k.sphere([-0.1, 1.15, 0.035], [0.12, 0.12, 0.01], "#3f8f4a");
    for (const sx of [-1, 1]) k.rod([sx * 0.3, 0, 0.2], [sx * 0.15, 1.4, 0], 0.02, C.darkOak);
  },
  parasol: (k, w, d) => {
    const r = Math.min(Math.min(w, d) / 2, 1.1);
    k.rod([0, 0, 0], [0, 1.85, 0], 0.025, pal.woodDark);
    // Eight striped panels.
    for (let i = 0; i < 8; i++)
      k.add(
        transformGeometry(
          new CylinderGeometry(0.03, r, 0.32, 2, 1, true, (i * Math.PI) / 4, Math.PI / 4),
          [0, 1.8, 0],
        ),
        i % 2 ? pal.fabricLight : pal.accent,
      );
    k.cyl([0, 0.05, 0], 0.22, 0.25, 0.1, "#3b4447", 16);
  },
  pergola: (k, w, d) => {
    // Light timber frame: four posts, two beams and sparse slats, with a few hanging lights.
    const h = 1.85;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        k.box([sx * (w / 2 - 0.1), h / 2, sz * (d / 2 - 0.1)], [0.1, h, 0.1], pal.woodDark, 0.02);
    for (const sz of [-1, 1]) k.box([0, h, sz * (d / 2 - 0.1)], [w, 0.08, 0.08], pal.woodDark, 0.015);
    const slats = Math.max(3, Math.round(w / 0.9));
    for (let i = 0; i < slats; i++)
      k.box([-w / 2 + (w * (i + 0.5)) / slats, h + 0.07, 0], [0.05, 0.05, d], pal.wood, 0.008);
    for (let i = 0; i < slats; i++)
      k.glow([-w / 2 + (w * (i + 0.5)) / slats, h - 0.06, d / 2 - 0.1], [0.03, 0.035, 0.03], "#ffd98f");
  },
  camera: (k) => {
    for (const a of [0, 2.1, 4.2])
      k.rod([0, 1.1, 0], [Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25], 0.012, C.ink);
    k.box([0, 1.2, 0], [0.2, 0.16, 0.28], "#1d2326", 0.02);
    k.add(
      transformGeometry(
        new CylinderGeometry(0.06, 0.07, 0.14, 16),
        [0, 1.2, -0.2],
        [1, 1, 1],
        [Math.PI / 2, 0, 0],
      ),
      "#2f383b",
    );
  },
  softbox: (k) => {
    for (const a of [0, 2.1, 4.2])
      k.rod([0, 1.2, 0], [Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25], 0.012, C.ink);
    k.box([0, 1.45, 0], [0.5, 0.5, 0.2], "#2a2f31", 0.02);
    k.box([0, 1.45, -0.11], [0.44, 0.44, 0.02], "#fff6dc", 0.01);
  },
  greenscreen: (k, w) => {
    for (const sx of [-1, 1])
      k.rod([sx * (w / 2 - 0.08), 0, 0], [sx * (w / 2 - 0.08), 2.0, 0], 0.02, C.metal);
    k.box([0, 1.1, 0], [w - 0.16, 1.8, 0.03], "#2fae4f", 0.01);
  },
  bbq: (k, w, d) => {
    // Outdoor kitchen: stone base with wooden doors, a grill with glowing coals and a raised hood.
    k.box([0, 0.43, 0], [w - 0.1, 0.86, d - 0.2], "#a3968a", 0.03);
    const doors = Math.max(2, Math.round(w / 0.7));
    for (let i = 0; i < doors; i++)
      k.box(
        [-w / 2 + 0.05 + ((w - 0.1) * (i + 0.5)) / doors, 0.42, d / 2 - 0.1],
        [(w - 0.1) / doors - 0.08, 0.62, 0.02],
        pal.wood,
        0.01,
      );
    k.box([0, 0.885, 0], [w - 0.04, 0.05, d - 0.14], "#d8d0c4", 0.015);
    const gw = Math.min(1.1, w * 0.45);
    k.box([-w / 4, 0.92, 0], [gw, 0.04, d - 0.4], "#24282a", 0.01);
    for (let i = 0; i < 5; i++)
      k.glow(
        [-w / 4 - gw / 2 + 0.12 + (i * (gw - 0.24)) / 4, 0.95, 0],
        [0.05, 0.015, (d - 0.5) / 2],
        "#f08a3c",
      );
    k.box([-w / 4, 1.12, -(d - 0.4) / 2 + 0.05], [gw + 0.06, 0.4, 0.06], "#3a3f42", 0.02);
    k.cyl([w / 4, 0.95, 0], 0.16, 0.14, 0.06, "#e9e4da", 18);
    k.cyl([w / 4 + 0.35, 0.95, 0.05], 0.06, 0.05, 0.12, pal.accent, 12);
  },
  firepit: (k, w, d) => {
    const r = Math.min(w, d) / 2 - 0.1;
    k.add(
      transformGeometry(
        new TorusGeometry(r * 0.8, 0.12, 8, 20),
        [0, 0.15, 0],
        [1, 1, 1],
        [Math.PI / 2, 0, 0],
      ),
      "#9c8f84",
    );
    k.glow([0, 0.35, 0], [0.18, 0.28, 0.18], "#f2913b");
  },
  foosball: (k, w, d) => {
    k.box([0, 0.75, 0], [w - 0.1, 0.18, d - 0.2], "#2f6b46", 0.03);
    legs(k, w - 0.1, d - 0.2, 0.68, C.dark, 0.08, 0.035);
    for (let i = 0; i < 4; i++)
      k.rod(
        [-w / 2 + 0.3 + i * ((w - 0.6) / 3), 0.85, -d / 2],
        [-w / 2 + 0.3 + i * ((w - 0.6) / 3), 0.85, d / 2],
        0.012,
        C.metal,
      );
  },
  bath: (k, w, d) => {
    k.box([0, 0.28, 0], [w - 0.08, 0.56, d - 0.08], C.white, 0.12);
    k.box([0, 0.52, 0], [w - 0.3, 0.06, d - 0.3], "#9cd3e3", 0.06);
  },
  sink: (k, w, d) => {
    k.box([0, 0.42, 0], [w - 0.1, 0.84, d - 0.12], "#e4dccb", 0.03);
    k.box([0, 0.86, 0], [0.42, 0.06, 0.32], C.white, 0.05);
    k.rod([0, 0.88, -0.14], [0, 1.02, -0.06], 0.012, C.metal);
    k.box([0, 1.35, -d / 2 + 0.05], [0.5, 0.6, 0.02], C.glass, 0.01);
  },
};

/**
 * Where a TV's screen points: toward a sofa or beanbag whose sitters actually look at it (templates
 * never said which way a screen faced). Returned as the viewers' gaze; the TV builder puts the
 * screen on the opposite side. Without such a seat the screen faces the camera.
 */
function tvFacing(map: MapData, tv: MapObject): string {
  const cx = tv.x + tv.w / 2,
    cy = tv.y + tv.h / 2;
  const GAZE: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  let best: { dir: string; d: number } | null = null;
  for (const o of map.objects) {
    if (o.kind !== "sofa" && o.kind !== "beanbag") continue;
    const dir = o.facing ?? "down";
    const [gx, gy] = GAZE[dir];
    const dx = cx - (o.x + o.w / 2),
      dy = cy - (o.y + o.h / 2),
      d = Math.hypot(dx, dy);
    // The TV must be in front of the seat (within a 45 degree cone) and not across the house.
    if (d > 10 || (dx * gx + dy * gy) / d < 0.7) continue;
    if (!best || d < best.d) best = { dir, d };
  }
  return best?.dir ?? "up";
}

/** Fallback for kinds without a dedicated model: a neutral block of the right footprint. */
const fallback = tall("#b8a98f", 0.8);

/** Build all furniture of a map into one static group (one mesh per material). */
export function buildFurniture(map: MapData): Group {
  pal = roomPalette(map);
  const k = new PlacedKit();
  for (const o of map.objects) {
    if (o.kind === "rug") continue;
    const w = o.w * TILE_M,
      d = o.h * TILE_M;
    const dir =
      o.kind === "chair" || o.kind === "desk" || o.kind === "gamingDesk"
        ? workstationFacing(map, o)
        : o.kind === "tv" && !o.facing
          ? tvFacing(map, o)
          : (o.facing ?? (o.kind === "sofa" || o.kind === "beanbag" || o.kind === "bed" ? "down" : "up"));
    const yaw = facingYaw(dir);
    // Model in a local frame whose width runs across the gaze; a sideways object swaps footprint axes.
    const sideways = dir === "left" || dir === "right";
    k.matrix.makeRotationY(yaw).setPosition((o.x + o.w / 2) * TILE_M, 0, (o.y + o.h / 2) * TILE_M);
    (builders[o.kind] ?? fallback)(k, sideways ? d : w, sideways ? w : d, o, map);
  }
  const group = k.build();
  // Screens, lamps and LEDs glow more in dim or night ambience.
  const glow = roomLight(map).glow;
  group.traverse((o) => {
    if (o instanceof Mesh) {
      const m = o.material as MeshStandardMaterial;
      if (m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) m.emissiveIntensity = glow * 2;
    }
  });
  return group;
}
