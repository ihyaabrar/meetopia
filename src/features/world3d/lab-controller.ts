import {
  findPath,
  MASTER_3D,
  rotatePoint,
  walkable,
  wrapAngle,
  type Point2,
} from "@/shared/spatial/workstation3d";

export type LabPhase =
  "idle" | "walking" | "approaching" | "sitting-down" | "seated" | "typing" | "standing-up";
export type LabCommand = "sit" | "type" | "stand" | "walk" | "reset";
export interface LabMotion {
  position: Point2;
  yaw: number;
  stationYaw: number;
  phase: LabPhase;
  path: Point2[];
  progress: number;
  gait: number;
  seated: number;
  typing: boolean;
  moving: boolean;
  blocked: boolean;
}
export function createLabMotion(stationYaw = 0): LabMotion {
  return {
    position: rotatePoint({ x: -1.25, z: -1.15 }, stationYaw),
    yaw: wrapAngle(stationYaw),
    stationYaw,
    phase: "idle",
    path: [],
    progress: 0,
    gait: 0,
    seated: 0,
    typing: false,
    moving: false,
    blocked: false,
  };
}
export function commandLab(m: LabMotion, command: LabCommand): void {
  if (command === "reset") {
    Object.assign(m, createLabMotion(m.stationYaw));
    return;
  }
  if (command === "stand" || command === "walk") {
    if (m.seated > 0 || m.phase === "sitting-down") {
      const progress = m.phase === "sitting-down" || m.phase === "standing-up" ? m.progress : m.seated;
      m.phase = "standing-up";
      m.progress = progress;
      m.typing = false;
      m.path = [];
    } else {
      m.phase = "idle";
      m.path = [];
      m.typing = false;
    }
    if (command === "walk" && m.seated === 0) moveLab(m, { x: 1.45, z: -1.35 });
    return;
  }
  m.typing = command === "type";
  if (m.phase === "seated" || m.phase === "typing") {
    m.phase = m.typing ? "typing" : "seated";
    return;
  }
  if (m.phase === "sitting-down") return;
  if (m.phase === "standing-up") return;
  const destination = rotatePoint(MASTER_3D.sockets.approach, m.stationYaw);
  const path = findPath(m.position, destination, m.stationYaw);
  m.blocked = path.length === 0;
  if (!m.blocked) {
    m.path = path;
    m.phase = "approaching";
  }
}
export function moveLab(m: LabMotion, destination: Point2): void {
  if (m.seated > 0 || m.phase === "sitting-down" || m.phase === "standing-up") return;
  const path = findPath(m.position, destination, m.stationYaw);
  m.blocked = !path.length;
  if (path.length) {
    m.path = path;
    m.phase = "walking";
    m.typing = false;
  }
}
export function turnStation(m: LabMotion, yaw: number): void {
  // Recalibration is an explicit reset; don't carry a half-complete transition across socket frames.
  Object.assign(m, createLabMotion(yaw));
  const start = rotatePoint({ x: -1.25, z: -1.15 }, yaw);
  m.position = walkable(start, yaw) ? start : rotatePoint({ x: 0, z: -1.45 }, yaw);
}
export function stepLab(m: LabMotion, elapsed: number, keys: Point2 = { x: 0, z: 0 }, running = false): void {
  const dt = Math.min(Math.max(elapsed, 0), 0.05);
  m.moving = false;
  if (m.phase === "sitting-down" || m.phase === "standing-up") {
    const sitting = m.phase === "sitting-down";
    m.progress = Math.max(0, Math.min(1, m.progress + dt * (sitting ? 1.45 : -1.45)));
    const t = m.progress * m.progress * (3 - 2 * m.progress);
    const a = MASTER_3D.sockets.approach,
      s = MASTER_3D.sockets.seat;
    m.position = rotatePoint({ x: 0, z: a.z + (s.z - a.z) * t }, m.stationYaw);
    m.yaw += wrapAngle(m.stationYaw - m.yaw) * Math.min(1, dt * 12);
    m.seated = t;
    if (sitting && m.progress === 1) m.phase = m.typing ? "typing" : "seated";
    if (!sitting && m.progress === 0) {
      m.phase = "idle";
      m.seated = 0;
    }
    return;
  }
  if (m.phase === "seated" || m.phase === "typing") return;
  let direction: Point2 | undefined;
  const input = Math.hypot(keys.x, keys.z);
  if (input > 0) {
    m.path = [];
    m.phase = "walking";
    m.blocked = false;
    direction = { x: keys.x / input, z: keys.z / input };
  } else if (m.path.length) {
    const target = m.path[0],
      dx = target.x - m.position.x,
      dz = target.z - m.position.z,
      d = Math.hypot(dx, dz);
    const speed = (running ? 2 : 1.05) * dt;
    if (d <= speed) {
      m.position = { ...target };
      m.path.shift();
    } else direction = { x: dx / d, z: dz / d };
  }
  if (direction) {
    const speed = (running ? 2 : 1.05) * dt;
    const next = { x: m.position.x + direction.x * speed, z: m.position.z + direction.z * speed };
    if (walkable(next, m.stationYaw)) {
      m.position = next;
      m.moving = true;
      m.gait += dt * (running ? 13 : 9);
    } else {
      m.blocked = true;
      m.path = [];
    }
    m.yaw += wrapAngle(Math.atan2(direction.x, direction.z) - m.yaw) * Math.min(1, dt * 12);
  }
  if (!m.path.length && !input) {
    if (m.phase === "approaching") {
      m.phase = "sitting-down";
      m.progress = 0;
    } else m.phase = "idle";
  }
}
