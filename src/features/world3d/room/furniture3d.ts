/**
 * Procedural 3D models for every map object kind, built from the same MapData the 2D renderer uses.
 * Each object is modelled in a local frame (origin at the footprint centre on the floor, metres,
 * the operator/sitter looking toward -Z), rotated by its facing and merged with every other object
 * into one mesh per material, so a whole world costs a few dozen draw calls.
 */
import { BufferGeometry, CylinderGeometry, Group, Matrix4, SphereGeometry, TorusGeometry } from "three";
import { ModelKit, transformGeometry, type Vec3 } from "../model-kit";
import { seatCount } from "@/shared/seats";
import { workstationFacing, workstationSeat } from "@/shared/workstation";
import type { MapData, MapObject } from "@/shared/map";

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

function monitor(k: PlacedKit, x: number, z: number, deskTop: number, width = 0.56, dark = C.ink) {
  // Screen faces +Z, toward the operator who sits on the +Z side and looks toward -Z.
  k.box([x, deskTop + 0.015, z], [0.22, 0.03, 0.15], dark, 0.012);
  k.rod([x, deskTop + 0.02, z], [x, deskTop + 0.26, z], 0.016, dark);
  k.box([x, deskTop + 0.3, z], [width, 0.33, 0.045], dark, 0.02);
  k.add(
    transformGeometry(
      new SphereGeometry(1, 8, 6),
      [x, deskTop + 0.3, z + 0.025],
      [width * 0.46, 0.14, 0.004],
    ),
    C.screen,
    0,
    0.3,
    true,
  );
}

function deskCore(k: PlacedKit, w: number, d: number, top: string, frame: string, gaming = false) {
  const h = 0.72;
  k.box([0, h - 0.03, 0], [w - 0.04, 0.06, d - 0.06], top, 0.03);
  if (gaming) {
    for (const sx of [-1, 1]) k.box([sx * (w / 2 - 0.1), h / 2, 0], [0.06, h - 0.06, d - 0.16], frame, 0.02);
    k.box([0, h - 0.07, d / 2 - 0.05], [w - 0.12, 0.012, 0.01], C.mint, 0.004);
  } else {
    legs(k, w - 0.04, d - 0.06, h - 0.06, frame, 0.07, 0.028);
    k.box([0, 0.55, -d / 2 + 0.08], [w - 0.24, 0.07, 0.03], frame, 0.01);
  }
  return h;
}

/** Desk props sit where the attached seat's operator can reach them. */
const desk: Builder = (k, w, d, o, map) => {
  const gaming = o.kind === "gamingDesk";
  const h = deskCore(k, w, d, gaming ? "#2b2f3a" : C.lightOak, gaming ? "#1b1f27" : C.darkOak, gaming);
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

const chair: Builder = (k, w, d) => {
  // Sitter looks toward -Z; the backrest is behind them at +Z.
  const z = 0;
  k.box([0, 0.397, z], [0.44, 0.05, 0.42], C.teal, 0.045);
  k.box([0, 0.65, z + 0.2], [0.43, 0.42, 0.065], C.tealLight, 0.04, [0.09, 0, 0]);
  k.rod([0, 0.09, z], [0, 0.375, z], 0.03, C.ink);
  for (const side of [-1, 1]) k.box([side * 0.235, 0.54, z - 0.01], [0.045, 0.028, 0.24], C.ink, 0.014);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    k.rod([0, 0.11, z], [Math.sin(a) * 0.26, 0.05, z + Math.cos(a) * 0.26], 0.02, C.ink);
    k.sphere([Math.sin(a) * 0.26, 0.035, z + Math.cos(a) * 0.26], [0.035, 0.035, 0.035], "#122b2c");
  }
  void w;
  void d;
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
  k.box([0, 0.2, 0], [W - 0.04, 0.26, Dp - 0.08], C.oliveDark, 0.06);
  k.box([0, 0.55, Dp / 2 - 0.12], [W - 0.08, 0.5, 0.2], C.olive, 0.08);
  for (const sx of [-1, 1]) k.box([sx * (W / 2 - 0.1), 0.42, 0], [0.18, 0.32, Dp - 0.1], C.olive, 0.07);
  const n = seatCount(o);
  const span = W - 0.36;
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + (span * (i + 0.5)) / n;
    k.box([x, 0.38, -0.02], [span / n - 0.03, 0.11, Dp - 0.32], "#7f8d4a", 0.05);
  }
  k.box([-W / 2 + 0.32, 0.55, Dp / 2 - 0.26], [0.26, 0.24, 0.1], C.cream, 0.05, [0.2, 0.3, 0]);
  k.box([W / 2 - 0.32, 0.55, Dp / 2 - 0.26], [0.26, 0.24, 0.1], "#3f6b52", 0.05, [0.2, -0.3, 0]);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      k.cyl([sx * (W / 2 - 0.08), 0.04, sz * (Dp / 2 - 0.1)], 0.03, 0.022, 0.08, C.darkOak, 8);
  void D;
};

const beanbag: Builder = (k) => {
  k.sphere([0, 0.17, 0.02], [0.3, 0.2, 0.28], "#c4693f");
  k.sphere([0, 0.33, 0.14], [0.22, 0.16, 0.12], "#b65c35");
};

const bed: Builder = (k, w, d) => {
  k.box([0, 0.18, 0], [w - 0.06, 0.24, d - 0.06], C.darkOak, 0.04);
  k.box([0, 0.36, 0.02], [w - 0.14, 0.14, d - 0.14], C.white, 0.06);
  k.box([0, 0.44, 0.18], [w - 0.18, 0.06, d * 0.55], "#5b7f9c", 0.05);
  k.box([0, 0.55, -d / 2 + 0.06], [w - 0.06, 0.6, 0.08], C.darkOak, 0.03);
  const pillows = Math.max(1, Math.round(w / 1.2));
  for (let i = 0; i < pillows; i++)
    k.box(
      [-w / 2 + (w * (i + 0.5)) / pillows, 0.47, -d / 2 + 0.3],
      [Math.min(0.6, w / pillows - 0.12), 0.1, 0.32],
      C.cream,
      0.05,
    );
};

const table: Builder = (k, w, d) => {
  k.box([0, 0.71, 0], [w - 0.04, 0.06, d - 0.04], C.oak, 0.04);
  legs(k, w - 0.04, d - 0.04, 0.68, C.darkOak, 0.12, 0.035);
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
    k.cyl([0, 0.015, 0], 0.13, 0.15, 0.03, C.ink, 18);
    k.rod([0, 0.03, 0], [0, 1.3, 0], 0.014, C.ink);
    k.add(transformGeometry(new CylinderGeometry(0.14, 0.2, 0.22, 20, 1, true), [0, 1.36, 0]), "#e4c48e");
    k.glow([0, 1.32, 0], [0.05, 0.06, 0.05], "#fbd88b");
  },
  bookshelf: (k, w, d) => {
    const h = 1.5;
    k.box([0, h / 2, 0], [w - 0.06, h, d - 0.1], C.darkOak, 0.02);
    const shelves = 4;
    for (let s = 0; s < shelves; s++) {
      const y = 0.1 + s * 0.36;
      k.box([0, y, 0.02], [w - 0.14, 0.025, d - 0.14], C.lightOak, 0.008);
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
    k.box([0, 0.5, 0], [w - 0.06, 1, d - 0.1], C.darkOak, 0.02);
    for (let i = 0; i < 3; i++) {
      k.box([0, 0.2 + i * 0.3, d / 2 - 0.04], [w - 0.16, 0.26, 0.02], C.oak, 0.01);
      k.box([0, 0.28 + i * 0.3, d / 2 - 0.02], [0.14, 0.02, 0.02], C.metal, 0.005);
    }
  },
  tv: (k, w, d) => {
    k.box([0, 0.22, 0], [w - 0.1, 0.4, Math.min(d - 0.1, 0.4)], C.darkOak, 0.02);
    k.box([0, 0.75, -0.05], [Math.min(w - 0.2, 1.4), 0.68, 0.05], "#1a1f22", 0.02);
    k.add(
      transformGeometry(
        new SphereGeometry(1, 8, 6),
        [0, 0.75, -0.02],
        [Math.min(w - 0.3, 1.3) / 2, 0.3, 0.004],
      ),
      "#1e4b5c",
      0,
      0.3,
      true,
    );
  },
  speaker: (k) => {
    for (const a of [0, 2.1, 4.2])
      k.rod([0, 0.85, 0], [Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25], 0.012, C.ink);
    k.box([0, 1.05, 0], [0.32, 0.46, 0.28], "#1d2326", 0.03);
    for (const y of [0.95, 1.17])
      k.add(
        transformGeometry(
          new CylinderGeometry(0.09, 0.09, 0.02, 18),
          [0, y, 0.145],
          [1, 1, 1],
          [Math.PI / 2, 0, 0],
        ),
        "#3a4448",
      );
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
    // Curved reception counter: front panel arc plus a desktop.
    k.box([0, 0.5, 0.05], [w - 0.1, 1.0, d - 0.3], "#5e7a4a", 0.06);
    k.box([0, 1.02, 0.05], [w, 0.06, d - 0.15], C.lightOak, 0.03);
    k.box([0, 0.76, -d / 2 + 0.2], [w - 0.4, 0.04, 0.35], C.lightOak, 0.02);
    plant(k, 0.5, -w / 2 + 0.3, 0, 1.05);
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
    k.box([0, 0.45, 0], [w - 0.08, 0.9, d - 0.1], "#3a4447", 0.02);
    k.box([0, 1.08, 0], [0.34, 0.36, 0.3], "#1e2224", 0.03);
    k.cyl([0, 0.98, 0.12], 0.04, 0.035, 0.08, C.white, 12);
    k.glow([0.1, 1.18, 0.16], [0.02, 0.02, 0.01], "#f59e5b");
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
    k.box([0, 1.25, d / 2 - 0.05], [w - 0.24, 0.42, 0.02], "#5a7cf0", 0.01);
    k.add(
      transformGeometry(new SphereGeometry(1, 8, 6), [0, 1.25, d / 2 - 0.03], [(w - 0.3) / 2, 0.18, 0.004]),
      "#7d6bff",
      0,
      0.3,
      true,
    );
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
    const r = Math.min(w, d) / 2;
    k.rod([0, 0, 0], [0, 2.0, 0], 0.03, C.cream);
    k.add(transformGeometry(new CylinderGeometry(0.04, r, 0.4, 16, 1, true), [0, 2.05, 0]), C.cream);
    k.cyl([0, 0.05, 0], 0.25, 0.28, 0.1, C.dark, 16);
  },
  pergola: (k, w, d) => {
    const h = 2.1;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        k.box([sx * (w / 2 - 0.12), h / 2, sz * (d / 2 - 0.12)], [0.16, h, 0.16], C.darkOak, 0.02);
    for (const sz of [-1, 1]) k.box([0, h, sz * (d / 2 - 0.12)], [w, 0.12, 0.14], C.darkOak, 0.02);
    const beams = Math.max(3, Math.round(w / 0.7));
    for (let i = 0; i < beams; i++)
      k.box([-w / 2 + (w * (i + 0.5)) / beams, h + 0.1, 0], [0.08, 0.08, d], C.oak, 0.01);
    for (let i = 0; i < 10; i++)
      k.sphere(
        [(((i * 37) % 10) / 10) * w - w / 2, h + 0.15, (((i * 53) % 10) / 10) * d - d / 2],
        [0.35, 0.12, 0.3],
        i % 2 ? C.leaf : C.leafLight,
      );
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
    k.box([0, 0.45, 0], [w - 0.1, 0.9, d - 0.15], "#3a3f42", 0.04);
    k.box([0, 0.93, 0], [w - 0.2, 0.06, d - 0.25], "#1c1f21", 0.02);
    for (let i = 0; i < 3; i++) k.glow([-0.3 + i * 0.3, 0.98, 0], [0.12, 0.02, 0.05], "#f08a3c");
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

/** Fallback for kinds without a dedicated model: a neutral block of the right footprint. */
const fallback = tall("#b8a98f", 0.8);

/** Build all furniture of a map into one static group (one mesh per material). */
export function buildFurniture(map: MapData): Group {
  const k = new PlacedKit();
  for (const o of map.objects) {
    if (o.kind === "rug") continue;
    const w = o.w * TILE_M,
      d = o.h * TILE_M;
    const dir =
      o.kind === "chair" || o.kind === "desk" || o.kind === "gamingDesk"
        ? workstationFacing(map, o)
        : (o.facing ?? (o.kind === "sofa" || o.kind === "beanbag" || o.kind === "bed" ? "down" : "up"));
    const yaw = facingYaw(dir);
    // Model in a local frame whose width runs across the gaze; a sideways object swaps footprint axes.
    const sideways = dir === "left" || dir === "right";
    k.matrix.makeRotationY(yaw).setPosition((o.x + o.w / 2) * TILE_M, 0, (o.y + o.h / 2) * TILE_M);
    (builders[o.kind] ?? fallback)(k, sideways ? d : w, sideways ? w : d, o, map);
  }
  return k.build();
}
