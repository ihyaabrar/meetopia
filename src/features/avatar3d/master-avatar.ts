import {
  Bone,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Uint16BufferAttribute,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ball, rounded, transformGeometry, cylinderBetween, type Vec3 } from "@/features/world3d/model-kit";
import { MASTER_3D, solveArm } from "@/shared/spatial/workstation3d";
import type { AvatarConfig } from "@/shared/avatar";

export type MasterLook = "hoodie" | "blue-jacket" | "bob";
export type RigBone =
  | "hip"
  | "spine"
  | "head"
  | "armL"
  | "forearmL"
  | "armR"
  | "forearmR"
  | "thighL"
  | "shinL"
  | "thighR"
  | "shinR";
export type MasterRig = {
  group: Group;
  mesh: SkinnedMesh;
  skeleton: Skeleton;
  bones: Record<RigBone, Bone>;
  height: number;
};
const BONE_NAMES: RigBone[] = [
  "hip",
  "spine",
  "head",
  "armL",
  "forearmL",
  "armR",
  "forearmR",
  "thighL",
  "shinL",
  "thighR",
  "shinR",
];

/** Everything the 3D chibi needs; built from a saved 2D avatar profile by `chibiSpec`. */
export interface ChibiSpec {
  skin: string;
  hair: string;
  hairStyle: "short" | "spiky" | "bob" | "long" | "bun" | "ponytail" | "curly" | "none";
  top: string;
  topStyle: "hoodie" | "jacket" | "tee" | "shirt" | "polo" | "sweater" | "striped";
  /** Visible under an open jacket. */
  under: string;
  pants: string;
  legs: "trousers" | "shorts" | "skirt";
  shoes: string;
  glasses: "none" | "clear" | "sun";
  hat: "none" | "cap" | "beanie" | "hijab";
  headphones: boolean;
  accessory: string;
}

const LAB_LOOKS: Record<MasterLook, Omit<ChibiSpec, "skin">> = {
  hoodie: {
    hair: "#4b3023",
    hairStyle: "short",
    top: "#239860",
    topStyle: "hoodie",
    under: "#faf2df",
    pants: "#25353e",
    legs: "trousers",
    shoes: "#f2eadc",
    glasses: "none",
    hat: "none",
    headphones: false,
    accessory: "#29765a",
  },
  "blue-jacket": {
    hair: "#207fbf",
    hairStyle: "spiky",
    top: "#108b76",
    topStyle: "jacket",
    under: "#faf2df",
    pants: "#25353e",
    legs: "trousers",
    shoes: "#605046",
    glasses: "clear",
    hat: "none",
    headphones: false,
    accessory: "#29765a",
  },
  bob: {
    hair: "#4b3023",
    hairStyle: "bob",
    top: "#239860",
    topStyle: "hoodie",
    under: "#faf2df",
    pants: "#25353e",
    legs: "trousers",
    shoes: "#f2eadc",
    glasses: "none",
    hat: "none",
    headphones: false,
    accessory: "#29765a",
  },
};

const HAIR_3D: Record<AvatarConfig["hair"], ChibiSpec["hairStyle"]> = {
  short: "short",
  sidepart: "short",
  undercut: "short",
  sprout: "short",
  spiky: "spiky",
  bob: "bob",
  wavy: "bob",
  long: "long",
  braids: "long",
  bun: "bun",
  ponytail: "ponytail",
  curly: "curly",
  none: "none",
};

/** Map a saved avatar profile (the same one the 2D map uses) onto the 3D chibi. */
export function chibiSpec(a: AvatarConfig): ChibiSpec {
  const hat =
    a.accessory === "cap" || a.accessory === "beanie" || a.accessory === "hijab" ? a.accessory : "none";
  return {
    skin: a.skin,
    hair: a.hairColor,
    hairStyle: HAIR_3D[a.hair] ?? "short",
    top: a.bodyColor,
    topStyle:
      a.outfit === "jacket" || a.outfit === "blazer"
        ? "jacket"
        : a.outfit === "hoodie" ||
            a.outfit === "shirt" ||
            a.outfit === "polo" ||
            a.outfit === "sweater" ||
            a.outfit === "striped"
          ? a.outfit
          : "tee",
    under: a.outfit === "blazer" ? "#f4f1ea" : "#faf2df",
    pants: a.pantsColor,
    legs: a.bottom === "shorts" ? "shorts" : a.bottom === "skirt" ? "skirt" : "trousers",
    shoes: a.shoes === "boots" ? "#6c4935" : a.shoes === "canvas" ? "#4b7860" : "#f2eadc",
    glasses:
      a.eyewear === "sun" || a.accessory === "sunglasses"
        ? "sun"
        : a.eyewear !== "none" || a.accessory === "glasses"
          ? "clear"
          : "none",
    hat,
    headphones: a.headphones || a.accessory === "headphones",
    accessory: a.accessoryColor,
  };
}

/** A stable key: two profiles with the same key produce identical geometry. */
export const chibiKey = (s: ChibiSpec) => Object.values(s).join("|");

const shade = (hex: string, k: number) => {
  const c = new Color(hex);
  return `#${(k < 0 ? c.lerp(new Color("#000000"), -k) : c.lerp(new Color("#ffffff"), k)).getHexString()}`;
};

/** Lab calibration presets (kept for /3d-lab and its tests). */
export function createMasterAvatar(look: MasterLook = "hoodie", skin = "#f6cfa6"): MasterRig {
  return createChibi({ skin, ...LAB_LOOKS[look] });
}

/** Original code-native chibi. All clothing, hair and facial geometry is weighted to one skeleton. */
export function createChibi(spec: ChibiSpec): MasterRig {
  const bones = Object.fromEntries(
    BONE_NAMES.map((name) => {
      const b = new Bone();
      b.name = name;
      return [name, b];
    }),
  ) as Record<RigBone, Bone>;
  function joint(name: RigBone, parent: RigBone | null, p: Vec3) {
    bones[name].position.set(...p);
    if (parent) bones[parent].add(bones[name]);
  }
  joint("hip", null, [0, 0.55, 0]);
  joint("spine", "hip", [0, 0.12, 0]);
  joint("head", "spine", [0, 0.41, 0]);
  for (const [suffix, side] of [
    ["L", -1],
    ["R", 1],
  ] as const) {
    joint(`arm${suffix}`, "spine", [side * 0.195, 0.13, 0]);
    joint(`forearm${suffix}`, `arm${suffix}`, [0, -0.19, 0]);
    joint(`thigh${suffix}`, "hip", [side * 0.09, 0, 0]);
    joint(`shin${suffix}`, `thigh${suffix}`, [0, -0.23, 0]);
  }
  const group = new Group();
  group.name = "Meetopia chibi";
  group.add(bones.hip);
  group.updateMatrixWorld(true);
  const jacket = spec.topStyle === "jacket",
    hoodie = spec.topStyle === "hoodie";
  const SKIN = 0,
    TOP = 1,
    PANTS = 2,
    SHOES = 3,
    HAIR = 4,
    DARK = 5,
    BLUSH = 6,
    LIGHT = 7,
    TRIM = 8,
    ACCENT = 9;
  const colors = [
    spec.skin,
    spec.top,
    spec.pants,
    spec.shoes,
    spec.hair,
    "#24201d",
    "#ef9c8d",
    jacket ? spec.under : "#faf2df",
    shade(spec.top, -0.35),
    spec.accessory,
  ];
  const materials = colors.map(
    (color, i) =>
      new MeshStandardMaterial({
        color: new Color(color),
        roughness: i === DARK ? 0.4 : i === HAIR ? 0.65 : 0.8,
      }),
  );
  const parts: BufferGeometry[] = [];
  function add(
    g: BufferGeometry,
    bone: RigBone,
    material: number,
    blend?: { next: RigBone; jointY: number },
  ) {
    const index = BONE_NAMES.indexOf(bone),
      nextIndex = blend ? BONE_NAMES.indexOf(blend.next) : index;
    const count = g.getAttribute("position").count,
      indices: number[] = [],
      weights: number[] = [];
    for (let i = 0; i < count; i++) {
      const y = g.getAttribute("position").getY(i);
      const t = blend ? Math.max(0, Math.min(1, (blend.jointY + 0.032 - y) / 0.064)) : 0;
      indices.push(index, nextIndex, 0, 0);
      weights.push(1 - t, t, 0, 0);
    }
    g.applyMatrix4(bones[bone].matrixWorld);
    g.setAttribute("skinIndex", new Uint16BufferAttribute(indices, 4));
    g.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
    g.clearGroups();
    g.addGroup(0, g.index?.count ?? count, material);
    parts.push(g);
  }
  function ellipsoid(b: RigBone, p: Vec3, s: Vec3, mat: number) {
    add(ball(p, s), b, mat);
  }
  function box(b: RigBone, p: Vec3, s: Vec3, mat: number, r = 0.018) {
    add(rounded(p, s, r), b, mat);
  }
  function tube(b: RigBone, points: Vec3[], radius: number, mat: number) {
    add(
      new TubeGeometry(new CatmullRomCurve3(points.map((p) => new Vector3(...p))), 14, radius, 6, false),
      b,
      mat,
    );
  }

  // The torso is a closed volume, with a physical neckline. Sleeves are continuous weighted tubes.
  const torsoProfile = [
    [0.13, -0.135],
    [0.16, -0.115],
    [0.19, 0.01],
    [0.19, 0.1],
    [0.15, 0.17],
    [0.085, 0.185],
    [0.068, 0.18],
  ].map(([r, y]) => new Vector2(r, y));
  const torso = new LatheGeometry(
    torsoProfile,
    24,
    jacket ? 0.32 : 0,
    jacket ? Math.PI * 2 - 0.64 : Math.PI * 2,
  );
  torso.scale(1, 1, 0.68);
  add(torso, "spine", TOP);
  ellipsoid("hip", [0, 0.005, 0], [0.145, 0.07, 0.105], PANTS);
  add(transformGeometry(new CylinderGeometry(0.055, 0.059, 0.065, 16), [0, 0.178, 0]), "spine", SKIN);
  // A collar intersects the neck rather than hovering between the torso and head.
  if (spec.hat !== "hijab")
    add(
      transformGeometry(
        new TorusGeometry(0.068, 0.012, 8, 24),
        [0, 0.177, 0],
        [1, 1, 0.8],
        [Math.PI / 2, 0, 0],
      ),
      "spine",
      TRIM,
    );
  if (jacket) {
    // Full curved undershirt inside an open jacket, never a rectangle pasted on the chest.
    const undershirt = new LatheGeometry(
      torsoProfile.map((p) => new Vector2(p.x * 0.96, p.y)),
      24,
    );
    undershirt.scale(1, 1, 0.68);
    add(undershirt, "spine", LIGHT);
    for (const side of [-1, 1]) {
      tube(
        "spine",
        [
          [side * 0.047, 0.165, 0.1],
          [side * 0.06, 0.075, 0.125],
          [side * 0.051, -0.095, 0.103],
        ],
        0.01,
        TRIM,
      );
      box("spine", [side * 0.112, -0.055, 0.129], [0.065, 0.017, 0.014], TRIM, 0.003);
    }
  } else if (hoodie) {
    ellipsoid("spine", [0, 0.139, -0.075], [0.114, 0.066, 0.07], TRIM);
    box("spine", [0, -0.055, 0.131], [0.15, 0.075, 0.015], TRIM);
    for (const side of [-1, 1])
      tube(
        "spine",
        [
          [side * 0.045, 0.17, 0.103],
          [side * 0.04, 0.08, 0.145],
          [side * 0.037, 0.015, 0.145],
        ],
        0.0045,
        LIGHT,
      );
  } else {
    // Tee / shirt / polo / sweater / striped: a hem band instead of a hood, plus each garment's
    // own detail so different tops never render the same.
    box("spine", [0, -0.122, 0], [0.33, 0.026, 0.235], TRIM, 0.012);
    const style = spec.topStyle;
    if (style === "shirt" || style === "polo") {
      // Collar points and a button placket.
      for (const side of [-1, 1]) box("spine", [side * 0.045, 0.165, 0.1], [0.07, 0.016, 0.05], LIGHT, 0.006);
      const buttons = style === "shirt" ? 4 : 2;
      for (let i = 0; i < buttons; i++)
        ellipsoid("spine", [0, 0.13 - i * 0.055, 0.132], [0.009, 0.009, 0.005], LIGHT);
      if (style === "shirt") box("spine", [0, 0.02, 0.129], [0.012, 0.29, 0.006], TRIM, 0.003);
    }
    if (style === "sweater") {
      add(
        transformGeometry(
          new TorusGeometry(0.075, 0.02, 8, 24),
          [0, 0.172, 0],
          [1, 1, 0.8],
          [Math.PI / 2, 0, 0],
        ),
        "spine",
        TRIM,
      );
      for (const x of [-0.09, -0.045, 0, 0.045, 0.09])
        box("spine", [x, -0.122, 0.118], [0.008, 0.026, 0.006], LIGHT, 0.002);
    }
    if (style === "striped")
      for (const y of [-0.08, -0.02, 0.04, 0.1])
        add(
          transformGeometry(
            new TorusGeometry(0.19, 0.012, 6, 32),
            [0, y, 0],
            [1, 1, 0.68],
            [Math.PI / 2, 0, 0],
          ),
          "spine",
          LIGHT,
        );
  }
  for (const suffix of ["L", "R"] as const) {
    const arm = `arm${suffix}` as const,
      forearm = `forearm${suffix}` as const;
    const sleeve = new LatheGeometry(
      [
        [0.028, -0.355],
        [0.047, -0.34],
        [0.05, -0.19],
        [0.064, -0.04],
        [0.062, 0.008],
        [0, 0.05],
      ].map(([r, y]) => new Vector2(r, y)),
      16,
      0,
      Math.PI * 2,
    );
    add(sleeve, arm, TOP, { next: forearm, jointY: -0.19 });
    ellipsoid(forearm, [0, -0.186, 0.006], [0.038, 0.049, 0.04], SKIN);
    box(forearm, [0, -0.151, 0], [0.083, 0.024, 0.083], TRIM, 0.01);
    const thigh = `thigh${suffix}` as const,
      shin = `shin${suffix}` as const;
    // Trousers reach the ankle; shorts and a skirt leave the lower leg bare.
    const bare = spec.legs !== "trousers";
    const pants = new LatheGeometry(
      (bare
        ? [
            [0.056, -0.27],
            [0.06, -0.24],
            [0.066, -0.13],
            [0.074, -0.05],
            [0.072, 0.035],
          ]
        : [
            [0.053, -0.48],
            [0.06, -0.45],
            [0.064, -0.23],
            [0.074, -0.05],
            [0.072, 0.035],
          ]
      ).map(([r, y]) => new Vector2(r, y)),
      14,
    );
    add(pants, thigh, spec.legs === "skirt" ? SKIN : PANTS, { next: shin, jointY: -0.23 });
    if (bare)
      add(
        new LatheGeometry(
          [
            [0.044, -0.25],
            [0.05, -0.2],
            [0.053, -0.05],
            [0.055, 0.02],
          ].map(([r, y]) => new Vector2(r, y)),
          12,
        ),
        shin,
        SKIN,
      );
    box(shin, [0, -0.27, 0.032], [0.145, 0.085, 0.22], SHOES, 0.028);
    box(shin, [0, -0.3, 0.034], [0.149, 0.027, 0.225], LIGHT, 0.009);
    for (const z of [0.055, 0.085]) box(shin, [0, -0.23, z], [0.076, 0.006, 0.012], DARK, 0.002);
  }
  if (spec.legs === "skirt")
    add(
      new LatheGeometry(
        [
          [0.15, 0.03],
          [0.17, -0.03],
          [0.22, -0.17],
          [0.215, -0.19],
        ].map(([r, y]) => new Vector2(r, y)),
        24,
      ),
      "hip",
      PANTS,
    );
  ellipsoid("head", [0, 0, 0], [0.288, 0.265, 0.245], SKIN);
  for (const side of [-1, 1]) {
    ellipsoid("head", [side * 0.284, -0.018, 0], [0.039, 0.055, 0.046], SKIN);
    ellipsoid("head", [side * 0.304, -0.018, 0.019], [0.013, 0.028, 0.027], BLUSH);
    ellipsoid("head", [side * 0.103, -0.023, 0.233], [0.027, 0.037, 0.013], DARK);
    ellipsoid("head", [side * 0.098, -0.012, 0.246], [0.006, 0.008, 0.003], LIGHT);
    ellipsoid("head", [side * 0.154, -0.075, 0.205], [0.04, 0.021, 0.008], BLUSH);
    tube(
      "head",
      [
        [side * 0.13, 0.035, 0.221],
        [side * 0.1, 0.046, 0.235],
        [side * 0.072, 0.039, 0.237],
      ],
      0.004,
      HAIR,
    );
  }
  ellipsoid("head", [0, -0.055, 0.247], [0.016, 0.012, 0.012], SKIN);
  tube(
    "head",
    [
      [-0.028, -0.102, 0.224],
      [0, -0.115, 0.23],
      [0.028, -0.102, 0.224],
    ],
    0.004,
    DARK,
  );
  addHair(spec, { add, ellipsoid, tube }, HAIR, ACCENT);
  if (spec.glasses !== "none") {
    for (const side of [-1, 1]) {
      add(
        transformGeometry(new TorusGeometry(0.058, 0.006, 7, 24), [side * 0.101, -0.023, 0.25], [1, 0.82, 1]),
        "head",
        DARK,
      );
      if (spec.glasses === "sun")
        ellipsoid("head", [side * 0.101, -0.023, 0.248], [0.054, 0.045, 0.006], DARK);
      tube(
        "head",
        [
          [side * 0.16, -0.023, 0.25],
          [side * 0.24, -0.01, 0.14],
          [side * 0.282, 0, 0],
        ],
        0.005,
        DARK,
      );
    }
    tube(
      "head",
      [
        [-0.041, -0.013, 0.259],
        [0, -0.003, 0.265],
        [0.041, -0.013, 0.259],
      ],
      0.005,
      DARK,
    );
  }
  if (spec.headphones) {
    add(
      transformGeometry(new TorusGeometry(0.3, 0.018, 8, 28, Math.PI), [0, 0.02, 0], [1, 1.05, 1], [0, 0, 0]),
      "head",
      DARK,
    );
    for (const side of [-1, 1]) ellipsoid("head", [side * 0.3, -0.01, 0.01], [0.04, 0.07, 0.07], ACCENT);
  }
  // Primitives are indexed; if any part is not, merge everything as non-indexed instead.
  if (parts.some((p) => !p.index))
    for (let i = 0; i < parts.length; i++)
      if (parts[i].index) {
        const flat = parts[i].toNonIndexed();
        flat.clearGroups();
        flat.addGroup(0, flat.getAttribute("position").count, parts[i].groups[0].materialIndex ?? 0);
        parts[i].dispose();
        parts[i] = flat;
      }
  // mergeGeometries(useGroups) replaces source groups; these match one material per part.
  const materialIds = [...new Set(parts.map((p) => p.groups[0].materialIndex))];
  const batches = materialIds.map((id) =>
    mergeGeometries(
      parts.filter((p) => p.groups[0].materialIndex === id),
      false,
    )!,
  );
  const geometry = mergeGeometries(batches, true);
  if (!geometry) throw new Error("Cannot merge chibi skin geometry");
  geometry.groups.forEach((g, i) => {
    g.materialIndex = materialIds[i];
  });
  batches.forEach((p) => p.dispose());
  parts.forEach((p) => p.dispose());
  const mesh = new SkinnedMesh(geometry, materials),
    skeleton = new Skeleton(BONE_NAMES.map((name) => bones[name]));
  mesh.name = "Weighted body, clothing and hair";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  group.add(mesh);
  group.updateMatrixWorld(true);
  mesh.bind(skeleton);
  return { group, mesh, skeleton, bones, height: 1.4 };
}

type Builders = {
  add: (g: BufferGeometry, bone: RigBone, material: number) => void;
  ellipsoid: (b: RigBone, p: Vec3, s: Vec3, mat: number) => void;
  tube: (b: RigBone, points: Vec3[], radius: number, mat: number) => void;
};
const SKULL: Vec3 = [0.301, 0.282, 0.263];
/** Volumetric hair and headwear. A hijab or beanie replaces the visible hair crown. */
function addHair(spec: ChibiSpec, { add, ellipsoid, tube }: Builders, HAIR: number, ACCENT: number) {
  const cap = (thetaLength: number, mat: number, scale = 1) =>
    add(
      transformGeometry(
        new SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, thetaLength),
        [0, 0.015, -0.005],
        [SKULL[0] * scale, SKULL[1] * scale, SKULL[2] * scale],
      ),
      "head",
      mat,
    );
  if (spec.hat === "hijab") {
    // Covers crown, sides and neck; the face stays open.
    add(
      transformGeometry(
        new SphereGeometry(1, 28, 18, Math.PI * 0.62, Math.PI * 1.76, 0, 2.3),
        [0, 0.0, -0.01],
        [0.315, 0.3, 0.28],
      ),
      "head",
      ACCENT,
    );
    cap(1.0, ACCENT, 1.05);
    ellipsoid("spine", [0, 0.17, -0.01], [0.17, 0.07, 0.14], ACCENT);
    return;
  }
  const style = spec.hairStyle;
  if (style !== "none") {
    cap(1.25, HAIR);
    add(
      transformGeometry(
        new SphereGeometry(
          1,
          28,
          18,
          Math.PI,
          Math.PI,
          0.85,
          style === "bob" || style === "long" ? 1.5 : 0.98,
        ),
        [0, 0.015, -0.005],
        SKULL,
      ),
      "head",
      HAIR,
    );
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.092;
      if (style === "spiky")
        add(
          cylinderBetween(
            [x, 0.195, 0.168 - Math.abs(i - 2) * 0.015],
            [x + (i - 2) * 0.022, 0.028 + (i % 2) * 0.027, 0.245 - Math.abs(i - 2) * 0.014],
            0.065,
            0,
          ),
          "head",
          HAIR,
        );
      else
        add(
          ball(
            [x, 0.133 + Math.abs(i - 2) * 0.004, 0.199 - Math.abs(i - 2) * 0.019],
            [0.071, 0.11 - (i % 2) * 0.012, 0.069],
          ),
          "head",
          HAIR,
        );
    }
    if (style === "spiky")
      for (let i = 0; i < 11; i++) {
        const a = i * 2.4,
          radius = 0.11 + (i % 3) * 0.048;
        add(
          cylinderBetween(
            [Math.sin(a) * radius, 0.215, Math.cos(a) * radius],
            [Math.sin(a) * (radius + 0.065), 0.292 + (i % 2) * 0.025, Math.cos(a) * (radius + 0.055)],
            0.05,
            0,
          ),
          "head",
          HAIR,
        );
      }
    const longSides = style === "bob" || style === "long";
    for (const side of [-1, 1]) {
      ellipsoid(
        "head",
        [side * 0.251, longSides ? -0.025 : 0.05, 0.068],
        [0.062, longSides ? 0.205 : 0.1, 0.113],
        HAIR,
      );
      ellipsoid("head", [side * 0.08, 0.215, 0.08], [0.09, 0.027, 0.044], HAIR);
    }
    if (style === "long") ellipsoid("head", [0, -0.2, -0.17], [0.25, 0.24, 0.1], HAIR);
    if (style === "bun") ellipsoid("head", [0, 0.27, -0.12], [0.1, 0.09, 0.1], HAIR);
    if (style === "ponytail")
      tube(
        "head",
        [
          [0, 0.12, -0.25],
          [0, -0.02, -0.33],
          [0, -0.22, -0.3],
        ],
        0.055,
        HAIR,
      );
    if (style === "curly")
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        ellipsoid(
          "head",
          [Math.sin(a) * 0.27, 0.13 + (i % 3) * 0.04, Math.cos(a) * 0.23 - 0.02],
          [0.07, 0.07, 0.07],
          HAIR,
        );
      }
  }
  if (spec.hat === "cap") {
    cap(1.0, ACCENT, 1.04);
    add(
      transformGeometry(
        new CylinderGeometry(0.2, 0.2, 0.02, 20, 1, false, -Math.PI / 2, Math.PI),
        [0, 0.11, 0.2],
        [1, 1, 0.9],
      ),
      "head",
      ACCENT,
    );
  }
  if (spec.hat === "beanie") {
    cap(1.15, ACCENT, 1.06);
    tube(
      "head",
      Array.from({ length: 13 }, (_, i): Vec3 => {
        const a = (i / 12) * Math.PI * 2;
        return [Math.sin(a) * 0.31, 0.1, Math.cos(a) * 0.29];
      }),
      0.03,
      ACCENT,
    );
  }
}

/** Poses beyond the lab's walk/sit/type cycle, used by the shared 3D room. */
export type ChibiAction =
  "idle" | "wave" | "jump" | "phone" | "coffee" | "clap" | "thumbs-up" | "dance" | "read";

export function poseMaster(
  rig: MasterRig,
  seated: number,
  moving: boolean,
  gait: number,
  typing: boolean,
  time: number,
  reducedMotion: boolean,
  action: ChibiAction = "idle",
  actionTime = 0,
) {
  const b = rig.bones;
  const stride = moving ? Math.sin(gait) * 0.48 : 0;
  b.hip.position.y =
    MASTER_3D.avatar.hipHeight + (MASTER_3D.sockets.seat.y - MASTER_3D.avatar.hipHeight) * seated;
  if (moving && !reducedMotion) b.hip.position.y += Math.abs(Math.sin(gait)) * 0.013;
  // A jump: crouch, lift off, land (0.65 s), legs tucked in the air.
  const jumpT = action === "jump" ? Math.min(1, actionTime / 0.65) : 1;
  const air = action === "jump" && jumpT < 1 ? Math.sin(jumpT * Math.PI) : 0;
  b.hip.position.y += air * 0.32;
  b.spine.rotation.x = 0;
  b.spine.rotation.z = action === "dance" && !reducedMotion ? Math.sin(time * 6) * 0.08 : 0;
  b.head.rotation.set(typing ? -0.025 : 0, 0, 0);
  const shoulderY = MASTER_3D.sockets.seat.y + 0.12 + 0.13;
  const reach = solveArm(
    MASTER_3D.sockets.keyboard.y + 0.025 - shoulderY,
    MASTER_3D.sockets.keyboard.z - MASTER_3D.sockets.seat.z - 0.006,
  );
  for (const [side, sign] of [
    ["L", 1],
    ["R", -1],
  ] as const) {
    b[`thigh${side}`].rotation.x = (-Math.PI / 2) * seated + stride * sign * (1 - seated) - air * 0.5;
    b[`shin${side}`].rotation.x =
      (Math.PI / 2) * seated + Math.max(0, -stride * sign) * 0.8 * (1 - seated) + air * 0.9;
    const tap = typing && !reducedMotion ? Math.sin(time * 12 + sign * 1.8) * 0.025 : 0;
    b[`arm${side}`].rotation.order = "YXZ";
    b[`arm${side}`].rotation.x =
      (typing ? reach.upper + tap : -0.35) * seated - stride * sign * 0.6 * (1 - seated);
    b[`arm${side}`].rotation.y = typing ? sign * 0.13 * seated : 0;
    b[`forearm${side}`].rotation.x = (typing ? reach.lower - tap : -0.55) * seated;
    b[`forearm${side}`].rotation.y = 0;
    b[`forearm${side}`].rotation.z = 0;
    b[`arm${side}`].rotation.z = sign * -0.08 * (1 - seated);
    if (action === "read" && seated > 0.5) {
      // Reading while seated: both hands hold a book in front of the chest.
      b[`arm${side}`].rotation.x = -0.55;
      b[`arm${side}`].rotation.y = sign * 0.25;
      b[`forearm${side}`].rotation.x = -1.35;
      continue;
    }
    if (seated > 0.5 || moving) continue;
    // Standing gestures. Right arm is side "R" (sign -1).
    const wiggle = reducedMotion ? 0 : Math.sin(time * 10);
    if (action === "wave" && side === "R") {
      b.armR.rotation.z = 2.5;
      b.forearmR.rotation.z = 0.35 + wiggle * 0.35;
    } else if (action === "jump") {
      b[`arm${side}`].rotation.z = sign * -(0.4 + air * 1.6);
    } else if (action === "clap" || action === "thumbs-up") {
      b[`arm${side}`].rotation.x = -1.1;
      b[`arm${side}`].rotation.y =
        sign * (action === "clap" ? 0.55 + (reducedMotion ? 0 : Math.abs(wiggle) * 0.12) : 0.2);
      b[`forearm${side}`].rotation.x = -0.6;
    } else if ((action === "phone" || action === "coffee") && side === "R") {
      b.armR.rotation.x = -0.5;
      b.forearmR.rotation.x = action === "phone" ? -2.2 : -1.6;
    } else if (action === "dance") {
      b[`arm${side}`].rotation.z = sign * -(1.2 + (reducedMotion ? 0 : Math.sin(time * 6 + sign) * 0.5));
    }
  }
  rig.group.updateMatrixWorld(true);
}
