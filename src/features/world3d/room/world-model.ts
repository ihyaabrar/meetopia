/**
 * Floor, zone labels and walls of a map in 3D. The painted 2D floor (tiles, rugs, wall tops, window
 * light) becomes a floor texture so every world keeps its own material; walls are real volumes,
 * kept low enough that the diorama camera still sees over them into the next room.
 */
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { renderWorld } from "@/client/art/world";
import { tileAt, type MapData } from "@/shared/map";
import { TILE_M } from "./furniture3d";

export const WALL_HEIGHT = 0.75;

export interface WorldModel {
  group: Group;
  /** Resolves once the painted floor assets have been drawn into the texture. */
  ready: Promise<void>;
  dispose(): void;
}

export function buildWorld(map: MapData, zoneLabel: (key: string) => string): WorldModel {
  const layers = renderWorld(map, zoneLabel);
  const W = map.width * TILE_M,
    D = map.height * TILE_M;
  const group = new Group();
  group.name = "World floor and walls";

  const floorTexture = new CanvasTexture(layers.floor);
  floorTexture.colorSpace = SRGBColorSpace;
  floorTexture.anisotropy = 4;
  const floor = new Mesh(
    new PlaneGeometry(W, D),
    new MeshStandardMaterial({ map: floorTexture, roughness: 0.92 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0, D / 2);
  floor.receiveShadow = true;
  floor.name = "floor";
  group.add(floor);

  // Zone labels lie on the floor just above it, like signs painted on the ground.
  const labelTexture = new CanvasTexture(layers.labels);
  labelTexture.colorSpace = SRGBColorSpace;
  const labels = new Mesh(
    new PlaneGeometry(W, D),
    new MeshBasicMaterial({ map: labelTexture, transparent: true, depthWrite: false }),
  );
  labels.rotation.x = -Math.PI / 2;
  labels.position.set(W / 2, 0.012, D / 2);
  labels.renderOrder = 1;
  group.add(labels);

  // Ground around the building, so the world does not float in the void.
  const ground = new Mesh(
    new PlaneGeometry(W + 40, D + 40),
    new MeshStandardMaterial({ color: map.template === "rooftop" ? "#8fb8c9" : "#0d1d24", roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(W / 2, -0.02, D / 2);
  group.add(ground);

  // Walls: horizontal runs of wall tiles merged into single boxes, plus a darker cap on top.
  const sides: BufferGeometry[] = [],
    caps: BufferGeometry[] = [];
  for (let y = 0; y < map.height; y++) {
    let x = 0;
    while (x < map.width) {
      if (tileAt(map, x, y) !== "wall") {
        x++;
        continue;
      }
      let end = x;
      while (end + 1 < map.width && tileAt(map, end + 1, y) === "wall") end++;
      const len = (end - x + 1) * TILE_M;
      const cx = x * TILE_M + len / 2,
        cz = y * TILE_M + TILE_M / 2;
      sides.push(new BoxGeometry(len, WALL_HEIGHT, TILE_M).translate(cx, WALL_HEIGHT / 2, cz));
      caps.push(new BoxGeometry(len + 0.002, 0.04, TILE_M + 0.002).translate(cx, WALL_HEIGHT + 0.02, cz));
      x = end + 1;
    }
  }
  const disposables: Array<{ dispose(): void }> = [floorTexture, labelTexture];
  if (sides.length) {
    const wallMat = new MeshStandardMaterial({ color: "#e9e1d2", roughness: 0.85 }),
      capMat = new MeshStandardMaterial({ color: "#23353d", roughness: 0.7 });
    const walls = new Mesh(mergeGeometries(sides), wallMat),
      capMesh = new Mesh(mergeGeometries(caps), capMat);
    walls.castShadow = walls.receiveShadow = true;
    capMesh.castShadow = true;
    group.add(walls, capMesh);
    disposables.push(wallMat, capMat);
  }
  sides.forEach((g) => g.dispose());
  caps.forEach((g) => g.dispose());

  return {
    group,
    ready: layers.ready.then(() => {
      floorTexture.needsUpdate = true;
      labelTexture.needsUpdate = true;
    }),
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
