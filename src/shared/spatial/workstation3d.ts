/** Master 3D: metres, Y-up, +Z = character forward. No legacy tile coordinates. */
export type Point2 = { x: number; z: number };
export type Point3 = Point2 & { y: number };
export const MASTER_3D = {
  version: 1,
  desk: { width: 1.7, depth: 0.76, height: 0.72 },
  chair: { seatHeight: 0.42, seatWidth: 0.46 },
  avatar: { hipHeight: 0.55, thigh: 0.23, shin: 0.25, shoulderHeight: 0.82 },
  // A footrest supports this deliberately short-legged chibi at an adult desk.
  footrest: { height: 0.166, z: -0.29 },
  sockets: {
    seat: { x: 0, y: 0.48, z: -0.53 },
    approach: { x: 0, z: -1.13 },
    exit: { x: 0, z: -1.13 },
    keyboard: { x: 0, y: 0.757, z: -0.19 },
    monitor: { x: 0, y: 1.05, z: 0.21 },
  },
  floor: { minX: -2.55, maxX: 2.55, minZ: -2.05, maxZ: 2.05 },
} as const;

export function rotatePoint<T extends Point2>(p: T, yaw: number): T {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return { ...p, x: p.x * c + p.z * s, z: -p.x * s + p.z * c };
}
export function localPoint<T extends Point2>(p: T, yaw: number): T {
  return rotatePoint(p, -yaw);
}
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
export function walkable(p: Point2, yaw: number): boolean {
  const f = MASTER_3D.floor,
    margin = 0.22;
  if (p.x < f.minX + margin || p.x > f.maxX - margin || p.z < f.minZ + margin || p.z > f.maxZ - margin)
    return false;
  const q = localPoint(p, yaw);
  // Inflated desk, occupied chair, plant pot and low shelf footprints.
  if (Math.abs(q.x) < 1.06 && q.z > -0.57 && q.z < 0.6) return false;
  if (Math.abs(q.x) < 0.47 && q.z > -0.93 && q.z < -0.38) return false;
  if (Math.hypot(p.x + 1.9, p.z - 1.35) < 0.43) return false;
  if (p.x < -1.9 && p.z < -0.7) return false;
  return true;
}

/** Small deterministic navigation grid for this isolated master, not the multiplayer server. */
export function findPath(start: Point2, end: Point2, yaw: number): Point2[] {
  if (!walkable(end, yaw)) return [];
  const cell = 0.16,
    key = (x: number, z: number) => `${x},${z}`;
  const sx = Math.round(start.x / cell),
    sz = Math.round(start.z / cell);
  const ex = Math.round(end.x / cell),
    ez = Math.round(end.z / cell);
  const queue = [[sx, sz]],
    parents = new Map<string, string | null>([[key(sx, sz), null]]);
  let found: string | undefined;
  for (let index = 0; index < queue.length && index < 1800; index++) {
    const [x, z] = queue[index],
      k = key(x, z);
    if (x === ex && z === ez) {
      found = k;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        nk = key(nx, nz);
      if (!parents.has(nk) && walkable({ x: nx * cell, z: nz * cell }, yaw)) {
        parents.set(nk, k);
        queue.push([nx, nz]);
      }
    }
  }
  if (!found) return [];
  const path: Point2[] = [end];
  for (let k: string | null = found; k && parents.get(k) !== null; k = parents.get(k) ?? null) {
    const [x, z] = k.split(",").map(Number);
    path.push({ x: x * cell, z: z * cell });
  }
  return path.reverse();
}

/** Two-segment IK in the sagittal plane. Angle 0 points down, negative X turns forward. */
export function solveArm(dy: number, dz: number, upper = 0.19, lower = 0.18) {
  const raw = Math.hypot(dy, dz);
  const reach = Math.max(Math.abs(upper - lower) + 0.001, Math.min(raw, upper + lower - 0.001));
  const direction = Math.atan2(dz, -dy);
  const shoulder = Math.acos(
    Math.max(-1, Math.min(1, (upper ** 2 + reach ** 2 - lower ** 2) / (2 * upper * reach))),
  );
  const bend =
    Math.PI -
    Math.acos(Math.max(-1, Math.min(1, (upper ** 2 + lower ** 2 - reach ** 2) / (2 * upper * lower))));
  return { upper: -(direction - shoulder), lower: -bend, reach, clamped: raw > upper + lower };
}
