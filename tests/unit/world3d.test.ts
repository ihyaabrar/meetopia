import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import {
  findPath,
  MASTER_3D,
  rotatePoint,
  solveArm,
  walkable,
  wrapAngle,
} from "@/shared/spatial/workstation3d";
import {
  commandLab,
  createLabMotion,
  moveLab,
  stepLab,
  turnStation,
} from "@/features/world3d/lab-controller";
import { createMasterAvatar, poseMaster, type MasterLook } from "@/features/avatar3d/master-avatar";
import { createDesk, createChair, createRoom } from "@/features/world3d/master-furniture";
import { disposeModel } from "@/features/world3d/model-kit";

describe("3D master spatial contract", () => {
  for (const degrees of [0, 90, 180, 270]) {
    const yaw = (degrees * Math.PI) / 180;
    it(`${degrees}°: keeps seat, desk, keyboard and approach in one local frame`, () => {
      const seat = rotatePoint(MASTER_3D.sockets.seat, yaw),
        keyboard = rotatePoint(MASTER_3D.sockets.keyboard, yaw);
      expect(Math.atan2(keyboard.x - seat.x, keyboard.z - seat.z)).toBeCloseTo(wrapAngle(yaw));
      const m = createLabMotion();
      turnStation(m, yaw);
      commandLab(m, "type");
      for (let i = 0; i < 1200; i++) stepLab(m, 1 / 60);
      expect(m.phase).toBe("typing");
      expect(m.seated).toBe(1);
      expect(m.position.x).toBeCloseTo(seat.x);
      expect(m.position.z).toBeCloseTo(seat.z);
      expect(wrapAngle(m.yaw - yaw)).toBeCloseTo(0, 3);
      commandLab(m, "stand");
      for (let i = 0; i < 90; i++) stepLab(m, 1 / 60);
      expect(m.phase).toBe("idle");
      expect(m.seated).toBe(0);
      expect(walkable(m.position, yaw)).toBe(true);
    });
  }
  it("finds paths around the inflated desk, never through it", () => {
    const path = findPath({ x: -1.4, z: -1.4 }, { x: 1.4, z: 1.4 }, 0);
    expect(path.length).toBeGreaterThan(10);
    for (const p of path) expect(walkable(p, 0)).toBe(true);
    expect(findPath({ x: -1.4, z: -1.4 }, { x: 0, z: 0 }, 0)).toEqual([]);
  });
  it("rejects blocked/out-of-room targets and caps stalled frame deltas", () => {
    const m = createLabMotion();
    moveLab(m, { x: 0, z: 0 });
    expect(m.blocked).toBe(true);
    const before = { ...m.position };
    stepLab(m, 100, { x: -1, z: 0 });
    expect(Math.hypot(m.position.x - before.x, m.position.z - before.z)).toBeLessThanOrEqual(0.053);
    expect(walkable({ x: 8, z: 0 }, 0)).toBe(false);
  });
  it("allows cancellation while approaching and interrupting a partial seat transition", () => {
    const m = createLabMotion();
    commandLab(m, "sit");
    commandLab(m, "stand");
    expect(m.phase).toBe("idle");
    m.phase = "sitting-down";
    stepLab(m, 0.05);
    commandLab(m, "stand");
    for (let i = 0; i < 90; i++) stepLab(m, 1 / 60);
    expect(m.seated).toBe(0);
    expect(m.phase).toBe("idle");
  });
  it("reverses a partial seat transition without snapping to a different interpolation point", () => {
    const m = createLabMotion();
    m.phase = "sitting-down";
    for (let i = 0; i < 16; i++) stepLab(m, 1 / 60);
    const before = { ...m.position },
      seated = m.seated;
    commandLab(m, "stand");
    stepLab(m, 0);
    expect(m.position).toEqual(before);
    expect(m.seated).toBe(seated);
  });
  it("solves keyboard reach with physical upper/forearm lengths", () => {
    const dy = 0.052,
      dz = 0.334,
      p = solveArm(dy, dz);
    const y = -0.19 * Math.cos(p.upper) - 0.18 * Math.cos(p.upper + p.lower);
    const z = -0.19 * Math.sin(p.upper) - 0.18 * Math.sin(p.upper + p.lower);
    expect(y).toBeCloseTo(dy);
    expect(z).toBeCloseTo(dz);
    expect(p.clamped).toBe(false);
    expect(solveArm(10, 10).clamped).toBe(true);
  });
});

describe("real volumetric avatar and furniture", () => {
  for (const look of ["hoodie", "blue-jacket", "bob"] as MasterLook[]) {
    it(`${look}: normalized skin weights, independent skeleton, short connected neck and supported seated feet`, () => {
      const rig = createMasterAvatar(look),
        other = createMasterAvatar(look);
      expect(rig.skeleton).not.toBe(other.skeleton);
      expect(rig.bones.head).not.toBe(other.bones.head);
      expect(rig.mesh.isSkinnedMesh).toBe(true);
      const weights = rig.mesh.geometry.getAttribute("skinWeight");
      let maximumWeightError = 0;
      for (let i = 0; i < weights.count; i++)
        maximumWeightError = Math.max(
          maximumWeightError,
          Math.abs(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1),
        );
      expect(maximumWeightError).toBeLessThan(0.00001);
      expect(rig.mesh.geometry.groups.length).toBeLessThanOrEqual(9);
      for (const s of [0, 0.5, 1]) {
        poseMaster(rig, s, false, 0, true, 0, true);
        const head = rig.bones.head.getWorldPosition(new Vector3()),
          spine = rig.bones.spine.getWorldPosition(new Vector3());
        const neckTop = spine.y + 0.178 + 0.0325,
          headBottom = head.y - 0.265;
        expect(neckTop).toBeGreaterThanOrEqual(headBottom);
        expect(neckTop - headBottom).toBeLessThan(0.07);
      }
      poseMaster(rig, 1, false, 0, true, 0, true);
      rig.group.position.z = MASTER_3D.sockets.seat.z;
      rig.group.updateMatrixWorld(true);
      const foot = new Vector3(0, -0.3135, 0.034).applyMatrix4(rig.bones.shinL.matrixWorld);
      expect(foot.y).toBeCloseTo(MASTER_3D.footrest.height, 2);
      const hand = new Vector3(0, -0.186, 0.006).applyMatrix4(rig.bones.forearmL.matrixWorld);
      expect(Math.abs(hand.x)).toBeLessThan(0.19);
      expect(hand.z).toBeCloseTo(MASTER_3D.sockets.keyboard.z, 1);
      expect(hand.y - 0.04).toBeCloseTo(MASTER_3D.sockets.keyboard.y, 1);
      disposeModel(rig.group);
      rig.skeleton.dispose();
      disposeModel(other.group);
      other.skeleton.dispose();
    });
  }
  it("builds standalone desk, chair and room geometry without bitmap assets", () => {
    for (const build of [createDesk, createChair, createRoom]) {
      const model = build();
      expect(model.children.length).toBeGreaterThan(2);
      model.traverse((o) => {
        if ("isMesh" in o) expect(o.type).toBe("Mesh");
      });
      disposeModel(model);
    }
  });
});
