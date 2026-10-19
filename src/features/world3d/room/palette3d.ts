/**
 * Colours and light of a 3D world. Each room type has its own walls and fabrics; the workspace's
 * appearance settings (furniture style, ambience) adjust them, so the same layout can feel like a
 * bright office or a cosy evening lounge without new assets.
 */
import { DEFAULT_APPEARANCE, type MapData } from "@/shared/map";

export interface RoomPalette {
  /** Wall surfaces and the cut top of low walls. */
  wall: string;
  wallTop: string;
  baseboard: string;
  /** Underside of the floor slab, seen at the front edge of the diorama. */
  slab: string;
  background: string;
  wood: string;
  woodLight: string;
  woodDark: string;
  /** Sofas, beanbags, cushions. */
  fabric: string;
  fabricLight: string;
  pillow: string;
  pillow2: string;
  /** Office chair shell and frame. */
  chair: string;
  chairFrame: string;
  metal: string;
  accent: string;
  /** Rug colours, used in turn. */
  rugs: Array<{ base: string; border: string; pattern: string }>;
}

export interface RoomLight {
  hemi: number;
  hemiSky: string;
  hemiGround: string;
  sun: number;
  sunColor: string;
  fill: number;
  exposure: number;
  /** Strength of screens, lamps and LEDs. */
  glow: number;
}

const BASE: Record<string, RoomPalette> = {
  office: {
    wall: "#ebe3d6",
    wallTop: "#7a6c5a",
    baseboard: "#7a6650",
    slab: "#24353b",
    background: "#0b1a21",
    wood: "#c99a62",
    woodLight: "#dfbd8a",
    woodDark: "#86613f",
    fabric: "#4f7a68",
    fabricLight: "#679380",
    pillow: "#efe3c8",
    pillow2: "#d98b5f",
    chair: "#2f5a4f",
    chairFrame: "#22302f",
    metal: "#a9b1b3",
    accent: "#18864a",
    rugs: [
      { base: "#e4dccb", border: "#b9a98c", pattern: "#cfc3ab" },
      { base: "#9fb5aa", border: "#6f8b7e", pattern: "#b3c6bc" },
      { base: "#d9b48f", border: "#a87b52", pattern: "#e6c9a8" },
    ],
  },
  home: {
    wall: "#f0e4d0",
    wallTop: "#866c50",
    baseboard: "#8a6646",
    slab: "#2b343a",
    background: "#0b1a21",
    wood: "#c48d58",
    woodLight: "#e0b47c",
    woodDark: "#7f5534",
    fabric: "#b98b67",
    fabricLight: "#cfa47f",
    pillow: "#f2e6cf",
    pillow2: "#6f8f78",
    chair: "#7f5534",
    chairFrame: "#5a3b24",
    metal: "#b5b2aa",
    accent: "#d98b5f",
    rugs: [
      { base: "#e9dcc4", border: "#c3a47d", pattern: "#d8c3a2" },
      { base: "#c98f73", border: "#9b6249", pattern: "#dcae96" },
      { base: "#a8b8a0", border: "#7b8f72", pattern: "#c0ceb8" },
      { base: "#d8cbe0", border: "#a493b3", pattern: "#e6dcec" },
    ],
  },
  gaming: {
    wall: "#45425e",
    wallTop: "#1c1b28",
    baseboard: "#1a1924",
    slab: "#15141d",
    background: "#0c0b14",
    wood: "#6b5a4b",
    woodLight: "#857262",
    woodDark: "#3f342b",
    fabric: "#4d4378",
    fabricLight: "#62579a",
    pillow: "#4fd1c5",
    pillow2: "#f06292",
    chair: "#1f1e2a",
    chairFrame: "#121118",
    metal: "#8c90a0",
    accent: "#8b6cff",
    rugs: [
      { base: "#2d2b40", border: "#8b6cff", pattern: "#3a3752" },
      { base: "#263443", border: "#4fd1c5", pattern: "#304255" },
      { base: "#3c2a3d", border: "#f06292", pattern: "#4a3550" },
    ],
  },
  studio: {
    wall: "#ecebe6",
    wallTop: "#6f6c66",
    baseboard: "#55595c",
    slab: "#25292c",
    background: "#0b1a21",
    wood: "#d3b48a",
    woodLight: "#e6cfa9",
    woodDark: "#8d6d4a",
    fabric: "#6f767c",
    fabricLight: "#868e94",
    pillow: "#f2c94c",
    pillow2: "#ef7d57",
    chair: "#33393d",
    chairFrame: "#1f2326",
    metal: "#b9bec0",
    accent: "#f2c94c",
    rugs: [
      { base: "#e6e1d6", border: "#b9b2a3", pattern: "#d6d0c2" },
      { base: "#f0d27a", border: "#c9a64a", pattern: "#f6e1a2" },
      { base: "#9fb4c2", border: "#71889a", pattern: "#b6c7d2" },
    ],
  },
  rooftop: {
    wall: "#e9e2d6",
    wallTop: "#b7ab97",
    baseboard: "#8b7355",
    slab: "#c9c0b2",
    background: "#bcdbe6",
    wood: "#b9814f",
    woodLight: "#d6a571",
    woodDark: "#7b5233",
    fabric: "#e3d8c2",
    fabricLight: "#efe6d4",
    pillow: "#2f8f83",
    pillow2: "#e98a5d",
    chair: "#c9a26b",
    chairFrame: "#8a6a45",
    metal: "#9aa3a6",
    accent: "#2f8f83",
    rugs: [
      { base: "#e8dfcc", border: "#2f8f83", pattern: "#d9cdb4" },
      { base: "#e9b48f", border: "#c7774d", pattern: "#f1caa9" },
      { base: "#b9d3c9", border: "#5f9585", pattern: "#cfe2da" },
    ],
  },
};

/** Furniture styles override the room's woods and fabrics (walls stay those of the room type). */
const STYLES: Record<string, Partial<RoomPalette>> = {
  modern: {
    wood: "#ddd0bb",
    woodLight: "#ece3d3",
    woodDark: "#2c2f33",
    fabric: "#8d9499",
    fabricLight: "#a7adb1",
    pillow: "#f4f1ea",
    pillow2: "#2f6f8f",
    chair: "#2c2f33",
    chairFrame: "#1b1d20",
    metal: "#3a3d41",
  },
  industrial: {
    wood: "#7a5536",
    woodLight: "#946a46",
    woodDark: "#3c2a1d",
    fabric: "#8a5a3c",
    fabricLight: "#a06d4b",
    pillow: "#d9c9a8",
    pillow2: "#3f4a4f",
    chair: "#3a3f42",
    chairFrame: "#1e2224",
    metal: "#4b5154",
  },
  tropical: {
    wood: "#c9a26b",
    woodLight: "#ddbd8b",
    woodDark: "#8a6a45",
    fabric: "#3f8f7a",
    fabricLight: "#56a58f",
    pillow: "#f2e3c2",
    pillow2: "#f08a5d",
    chair: "#c9a26b",
    chairFrame: "#8a6a45",
    metal: "#a59b86",
  },
};

export function roomPalette(map: MapData): RoomPalette {
  const base = BASE[map.template ?? "office"] ?? BASE.office;
  const style = (map.appearance ?? DEFAULT_APPEARANCE).furnitureStyle;
  return { ...base, ...(style === "warm" ? {} : STYLES[style]) };
}

export function roomLight(map: MapData): RoomLight {
  const ambience = (map.appearance ?? DEFAULT_APPEARANCE).ambience;
  const outdoor = map.template === "rooftop";
  switch (ambience) {
    case "bright":
      return {
        hemi: 1.15,
        hemiSky: "#fffaf0",
        hemiGround: "#6f7a72",
        sun: 2.4,
        sunColor: "#fff3df",
        fill: 0.55,
        exposure: 1.05,
        glow: 0.35,
      };
    case "dim":
      return {
        hemi: 0.62,
        hemiSky: "#ffe2bf",
        hemiGround: "#3c3530",
        sun: 1.25,
        sunColor: "#ffc98f",
        fill: 0.3,
        exposure: 1,
        glow: 0.9,
      };
    case "night":
      return {
        hemi: 0.42,
        hemiSky: "#9fb4ff",
        hemiGround: "#1d2030",
        sun: 0.55,
        sunColor: "#b9c8ff",
        fill: 0.25,
        exposure: 1.05,
        glow: 1.6,
      };
    default:
      return {
        hemi: outdoor ? 1.05 : 0.95,
        hemiSky: "#fff6e6",
        hemiGround: "#5d665f",
        sun: outdoor ? 2.3 : 2,
        sunColor: "#ffefd6",
        fill: 0.45,
        exposure: 1,
        glow: 0.4,
      };
  }
}
