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

/** Original code-native chibi master. All clothing and facial geometry uses one skeleton. */
export function createMasterAvatar(look: MasterLook = "hoodie", skin = "#f6cfa6"): MasterRig {
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
  group.name = "Meetopia chibi master v1";
  group.add(bones.hip);
  group.updateMatrixWorld(true);
  const jacket = look === "blue-jacket",
    bob = look === "bob";
  const colors = [
    skin,
    jacket ? "#108b76" : "#239860",
    "#25353e",
    jacket ? "#605046" : "#f2eadc",
    jacket ? "#207fbf" : "#4b3023",
    "#24201d",
    "#ef9c8d",
    "#faf2df",
    "#104f37",
  ];
  const materials = colors.map(
    (color, i) => new MeshStandardMaterial({ color: new Color(color), roughness: i === 5 ? 0.4 : 0.8 }),
  );
  const parts: BufferGeometry[] = [];
  function add(
    g: BufferGeometry,
    bone: RigBone,
    material: number,
    blend?: { next: RigBone; jointY: number },
  ) {
    if (g.index) {
      const source = g;
      g = source.toNonIndexed();
      source.dispose();
    }
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
  add(torso, "spine", 1);
  ellipsoid("hip", [0, 0.005, 0], [0.145, 0.07, 0.105], 2);
  add(transformGeometry(new CylinderGeometry(0.055, 0.059, 0.065, 16), [0, 0.178, 0]), "spine", 0);
  // A collar intersects the neck rather than hovering between the torso and head.
  add(
    transformGeometry(
      new TorusGeometry(0.068, 0.012, 8, 24),
      [0, 0.177, 0],
      [1, 1, 0.8],
      [Math.PI / 2, 0, 0],
    ),
    "spine",
    8,
  );
  if (jacket) {
    // Full curved undershirt inside an open jacket, never a rectangle pasted on the chest.
    const undershirt = new LatheGeometry(
      torsoProfile.map((p) => new Vector2(p.x * 0.96, p.y)),
      24,
    );
    undershirt.scale(1, 1, 0.68);
    add(undershirt, "spine", 7);
    for (const side of [-1, 1]) {
      tube(
        "spine",
        [
          [side * 0.047, 0.165, 0.1],
          [side * 0.06, 0.075, 0.125],
          [side * 0.051, -0.095, 0.103],
        ],
        0.01,
        8,
      );
      box("spine", [side * 0.112, -0.055, 0.129], [0.065, 0.017, 0.014], 8, 0.003);
    }
  } else {
    ellipsoid("spine", [0, 0.139, -0.075], [0.114, 0.066, 0.07], 8);
    box("spine", [0, -0.055, 0.131], [0.15, 0.075, 0.015], 8);
    for (const side of [-1, 1])
      tube(
        "spine",
        [
          [side * 0.045, 0.17, 0.103],
          [side * 0.04, 0.08, 0.145],
          [side * 0.037, 0.015, 0.145],
        ],
        0.0045,
        7,
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
    add(sleeve, arm, 1, { next: forearm, jointY: -0.19 });
    ellipsoid(forearm, [0, -0.186, 0.006], [0.038, 0.049, 0.04], 0);
    box(forearm, [0, -0.151, 0], [0.083, 0.024, 0.083], 8, 0.01);
    const thigh = `thigh${suffix}` as const,
      shin = `shin${suffix}` as const;
    const pants = new LatheGeometry(
      [
        [0.053, -0.48],
        [0.06, -0.45],
        [0.064, -0.23],
        [0.074, -0.05],
        [0.072, 0.035],
      ].map(([r, y]) => new Vector2(r, y)),
      14,
    );
    add(pants, thigh, 2, { next: shin, jointY: -0.23 });
    box(shin, [0, -0.27, 0.032], [0.145, 0.085, 0.22], 3, 0.028);
    box(shin, [0, -0.3, 0.034], [0.149, 0.027, 0.225], 7, 0.009);
    for (const z of [0.055, 0.085]) box(shin, [0, -0.23, z], [0.076, 0.006, 0.012], 5, 0.002);
  }
  ellipsoid("head", [0, 0, 0], [0.288, 0.265, 0.245], 0);
  for (const side of [-1, 1]) {
    ellipsoid("head", [side * 0.284, -0.018, 0], [0.039, 0.055, 0.046], 0);
    ellipsoid("head", [side * 0.304, -0.018, 0.019], [0.013, 0.028, 0.027], 6);
    ellipsoid("head", [side * 0.103, -0.023, 0.233], [0.027, 0.037, 0.013], 5);
    ellipsoid("head", [side * 0.098, -0.012, 0.246], [0.006, 0.008, 0.003], 7);
    ellipsoid("head", [side * 0.154, -0.075, 0.205], [0.04, 0.021, 0.008], 6);
    tube(
      "head",
      [
        [side * 0.13, 0.035, 0.221],
        [side * 0.1, 0.046, 0.235],
        [side * 0.072, 0.039, 0.237],
      ],
      0.004,
      4,
    );
  }
  ellipsoid("head", [0, -0.055, 0.247], [0.016, 0.012, 0.012], 0);
  tube(
    "head",
    [
      [-0.028, -0.102, 0.224],
      [0, -0.115, 0.23],
      [0.028, -0.102, 0.224],
    ],
    0.004,
    5,
  );
  // Full volumetric crown/back and sculpted locks. No head sprite or billboard is used.
  add(
    transformGeometry(
      new SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, 1.25),
      [0, 0.015, -0.005],
      [0.301, 0.282, 0.263],
    ),
    "head",
    4,
  );
  add(
    transformGeometry(
      new SphereGeometry(1, 28, 18, Math.PI, Math.PI, 0.85, bob ? 1.5 : 0.98),
      [0, 0.015, -0.005],
      [0.301, 0.282, 0.263],
    ),
    "head",
    4,
  );
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.092;
    const lock = ball(
      [x, 0.133 + Math.abs(i - 2) * 0.004, 0.199 - Math.abs(i - 2) * 0.019],
      [0.071, 0.11 - (i % 2) * 0.012, 0.069],
    );
    if (jacket) {
      lock.dispose();
      add(
        cylinderBetween(
          [x, 0.195, 0.168 - Math.abs(i - 2) * 0.015],
          [x + (i - 2) * 0.022, 0.028 + (i % 2) * 0.027, 0.245 - Math.abs(i - 2) * 0.014],
          0.065,
          0,
        ),
        "head",
        4,
      );
    } else add(lock, "head", 4);
  }
  if (jacket)
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
        4,
      );
    }
  for (const side of [-1, 1]) {
    ellipsoid("head", [side * 0.251, bob ? -0.025 : 0.05, 0.068], [0.062, bob ? 0.205 : 0.1, 0.113], 4);
    ellipsoid("head", [side * 0.08, 0.215, 0.08], [0.09, 0.027, 0.044], 4);
  }
  if (jacket) {
    for (const side of [-1, 1]) {
      add(
        transformGeometry(new TorusGeometry(0.058, 0.006, 7, 24), [side * 0.101, -0.023, 0.25], [1, 0.82, 1]),
        "head",
        5,
      );
      tube(
        "head",
        [
          [side * 0.16, -0.023, 0.25],
          [side * 0.24, -0.01, 0.14],
          [side * 0.282, 0, 0],
        ],
        0.005,
        5,
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
      5,
    );
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

export function poseMaster(
  rig: MasterRig,
  seated: number,
  moving: boolean,
  gait: number,
  typing: boolean,
  time: number,
  reducedMotion: boolean,
) {
  const b = rig.bones;
  const stride = moving ? Math.sin(gait) * 0.48 : 0;
  b.hip.position.y =
    MASTER_3D.avatar.hipHeight + (MASTER_3D.sockets.seat.y - MASTER_3D.avatar.hipHeight) * seated;
  if (moving && !reducedMotion) b.hip.position.y += Math.abs(Math.sin(gait)) * 0.013;
  b.spine.rotation.x = 0;
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
    b[`thigh${side}`].rotation.x = (-Math.PI / 2) * seated + stride * sign * (1 - seated);
    b[`shin${side}`].rotation.x = (Math.PI / 2) * seated + Math.max(0, -stride * sign) * 0.8 * (1 - seated);
    const tap = typing && !reducedMotion ? Math.sin(time * 12 + sign * 1.8) * 0.025 : 0;
    b[`arm${side}`].rotation.x =
      (typing ? reach.upper + tap : -0.35) * seated - stride * sign * 0.6 * (1 - seated);
    b[`arm${side}`].rotation.order = "YXZ";
    b[`arm${side}`].rotation.y = typing ? sign * 0.13 * seated : 0;
    b[`forearm${side}`].rotation.x = (typing ? reach.lower - tap : -0.55) * seated;
    b[`arm${side}`].rotation.z = sign * -0.08 * (1 - seated);
  }
  rig.group.updateMatrixWorld(true);
}
