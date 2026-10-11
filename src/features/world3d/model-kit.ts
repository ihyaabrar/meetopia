import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type Vec3 = [number, number, number];
export function transformGeometry(
  g: BufferGeometry,
  position: Vec3,
  scale: Vec3 = [1, 1, 1],
  rotation: Vec3 = [0, 0, 0],
) {
  g.scale(...scale);
  g.rotateX(rotation[0]);
  g.rotateY(rotation[1]);
  g.rotateZ(rotation[2]);
  g.translate(...position);
  return g;
}
export function ball(position: Vec3, size: Vec3) {
  return transformGeometry(new SphereGeometry(1, 20, 14), position, size);
}
export function rounded(position: Vec3, size: Vec3, radius = 0.025, rotation: Vec3 = [0, 0, 0]) {
  return transformGeometry(
    new RoundedBoxGeometry(...size, 2, Math.min(radius, Math.min(...size) / 2)),
    position,
    [1, 1, 1],
    rotation,
  );
}
export function cylinderBetween(a: Vec3, b: Vec3, radius: number, topRadius = radius) {
  const start = new Vector3(...a),
    end = new Vector3(...b),
    direction = end.clone().sub(start);
  const g = new CylinderGeometry(topRadius, radius, direction.length(), 12);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
  return g.applyMatrix4(new Matrix4().compose(start.add(end).multiplyScalar(0.5), q, new Vector3(1, 1, 1)));
}
/** Batch static geometry by material. Every prop remains volumetric, not a wallpaper cutout. */
export class ModelKit {
  private parts = new Map<string, { material: MeshStandardMaterial; geometry: BufferGeometry[] }>();
  add(g: BufferGeometry, color: string, metalness = 0, roughness = 0.72, emissive = false) {
    if (g.index) {
      const source = g;
      g = source.toNonIndexed();
      source.dispose();
    }
    const key = `${color}/${metalness}/${roughness}/${emissive}`;
    let item = this.parts.get(key);
    if (!item) {
      item = {
        material: new MeshStandardMaterial({
          color,
          metalness,
          roughness,
          ...(emissive ? { emissive: new Color(color), emissiveIntensity: 0.3 } : {}),
        }),
        geometry: [],
      };
      this.parts.set(key, item);
    }
    item.geometry.push(g);
  }
  box(p: Vec3, s: Vec3, color: string, radius = 0.025, rotation: Vec3 = [0, 0, 0]) {
    this.add(rounded(p, s, radius, rotation), color);
  }
  sphere(p: Vec3, s: Vec3, color: string) {
    this.add(ball(p, s), color);
  }
  rod(a: Vec3, b: Vec3, r: number, color: string, top = r) {
    this.add(cylinderBetween(a, b, r, top), color);
  }
  build() {
    const group = new Group();
    for (const { material, geometry } of this.parts.values()) {
      const merged = mergeGeometries(geometry, false);
      if (!merged) throw new Error("Incompatible master asset geometry");
      geometry.forEach((g) => g.dispose());
      const mesh = new Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}
export function disposeModel(group: Group) {
  const geometries = new Set<BufferGeometry>(),
    materials = new Set<MeshStandardMaterial>();
  group.traverse((o) => {
    if (o instanceof Mesh) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m as MeshStandardMaterial);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
