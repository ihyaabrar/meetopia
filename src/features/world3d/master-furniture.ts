import { CylinderGeometry, SphereGeometry } from "three";
import { ModelKit, transformGeometry, type Vec3 } from "./model-kit";
import { MASTER_3D } from "@/shared/spatial/workstation3d";

const oak = "#c68a49",
  lightOak = "#dcaa65",
  darkOak = "#875730",
  ink = "#213b3b",
  mint = "#39d4a0";
export function createDesk() {
  const k = new ModelKit(),
    d = MASTER_3D.desk;
  k.box([0, d.height - 0.035, 0], [d.width, 0.07, d.depth], lightOak, 0.035);
  for (const z of [-0.25, 0, 0.25]) k.box([0, d.height + 0.001, z], [1.62, 0.003, 0.002], oak, 0.001);
  for (const x of [-0.72, 0.72])
    for (const z of [-0.26, 0.26]) k.rod([x, 0.03, z], [x * 0.95, 0.66, z * 0.95], 0.035, darkOak, 0.045);
  k.box([0, 0.55, 0.24], [1.45, 0.08, 0.038], darkOak);
  // Screen normal faces -Z, toward the seat. The back stays a real back when viewed from +Z.
  k.box([0, 0.741, 0.21], [0.25, 0.03, 0.17], ink, 0.012);
  k.rod([0, 0.75, 0.21], [0, 1.015, 0.21], 0.017, ink);
  k.box([0, 1.047, 0.21], [0.62, 0.365, 0.046], ink, 0.022);
  k.add(
    transformGeometry(
      new CylinderGeometry(0.008, 0.008, 0.003, 10),
      [0, 1.211, 0.184],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
    ),
    "#081717",
  );
  k.box([0, 1.05, 0.185], [0.57, 0.308, 0.003], "#143d38", 0.007);
  k.box([-0.21, 1.05, 0.182], [0.09, 0.29, 0.003], "#205849", 0.002);
  k.box([-0.067, 1.147, 0.181], [0.12, 0.018, 0.003], mint, 0.003);
  k.box([0.09, 1.02, 0.18], [0.29, 0.17, 0.003], "#266552", 0.005);
  for (let i = 0; i < 4; i++)
    k.box([-0.07 + i * 0.058, 0.98 + i * 0.023, 0.177], [0.023, 0.047 + i * 0.047, 0.003], mint, 0.002);
  for (let i = 0; i < 3; i++)
    k.box([-0.208, 1.13 - i * 0.071, 0.18], [0.035, 0.005, 0.003], "#93ccac", 0.001);
  // Separate keyboard and mouse volumes; not painted onto the desktop.
  const keyboard = MASTER_3D.sockets.keyboard;
  k.box([0, keyboard.y - 0.013, keyboard.z], [0.39, 0.025, 0.14], "#314942", 0.009);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 10; col++)
      k.box(
        [-0.165 + col * 0.036, keyboard.y + 0.002, keyboard.z - 0.045 + row * 0.034],
        [0.028, 0.007, 0.023],
        "#d9e4d6",
        0.003,
      );
  k.box([0, keyboard.y + 0.002, keyboard.z - 0.067], [0.14, 0.007, 0.015], "#d9e4d6", 0.003);
  k.box([0.39, 0.724, -0.14], [0.22, 0.005, 0.23], "#4b6551", 0.01);
  k.sphere([0.38, 0.75, -0.15], [0.04, 0.027, 0.059], "#e6dfce");
  k.box([-0.51, 0.739, 0.03], [0.23, 0.024, 0.29], "#276b50", 0.007);
  k.box([-0.51, 0.754, 0.03], [0.2, 0.005, 0.26], "#f4e8cc", 0.004);
  k.rod([-0.54, 0.762, -0.05], [-0.45, 0.762, 0.1], 0.006, ink);
  k.add(transformGeometry(new CylinderGeometry(0.045, 0.041, 0.1, 18), [0.61, 0.77, 0.1]), "#f4e8cc");
  k.add(transformGeometry(new CylinderGeometry(0.037, 0.037, 0.003, 18), [0.61, 0.821, 0.1]), "#5c361e");
  k.sphere([0.661, 0.779, 0.1], [0.023, 0.028, 0.014], "#f4e8cc");
  // Ergonomic support for the short chibi shin, not floating feet.
  k.box([0, 0.148, -0.29], [0.49, 0.035, 0.28], ink, 0.018);
  k.rod([-0.19, 0.018, -0.3], [-0.19, 0.13, -0.3], 0.014, ink);
  k.rod([0.19, 0.018, -0.3], [0.19, 0.13, -0.3], 0.014, ink);
  return k.build();
}
export function createChair() {
  const k = new ModelKit(),
    s = MASTER_3D.sockets.seat;
  k.box([0, 0.397, s.z], [0.46, 0.046, 0.44], "#244f43", 0.045);
  k.box([0, 0.651, s.z - 0.203], [0.45, 0.43, 0.066], "#2c6351", 0.04, [-0.09, 0, 0]);
  k.box([0, 0.626, s.z - 0.161], [0.31, 0.32, 0.022], "#36705a", 0.028, [-0.09, 0, 0]);
  k.rod([0, 0.09, s.z], [0, 0.373, s.z], 0.032, ink);
  for (const side of [-1, 1]) {
    k.rod([side * 0.225, 0.37, s.z + 0.06], [side * 0.225, 0.54, s.z + 0.06], 0.016, ink);
    k.box([side * 0.241, 0.55, s.z - 0.015], [0.048, 0.028, 0.25], ink, 0.014);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5,
      x = Math.sin(a) * 0.29,
      z = s.z + Math.cos(a) * 0.29;
    k.rod([0, 0.115, s.z], [x, 0.058, z], 0.021, ink);
    k.add(
      transformGeometry(
        new CylinderGeometry(0.035, 0.035, 0.05, 12),
        [x, 0.038, z],
        [1, 1, 1],
        [0, 0, Math.PI / 2],
      ),
      "#122b2c",
    );
  }
  return k.build();
}
function plant(k: ModelKit, p: Vec3, scale: number) {
  const [x, y, z] = p;
  k.add(
    transformGeometry(new CylinderGeometry(0.16 * scale, 0.12 * scale, 0.27 * scale, 18), [
      x,
      y + 0.135 * scale,
      z,
    ]),
    "#b9683d",
  );
  k.add(
    transformGeometry(new CylinderGeometry(0.145 * scale, 0.145 * scale, 0.02, 18), [x, y + 0.26 * scale, z]),
    "#4a3f28",
  );
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4,
      height = (0.42 + (i % 3) * 0.13) * scale;
    const end: Vec3 = [x + Math.sin(a) * 0.21 * scale, y + height, z + Math.cos(a) * 0.21 * scale];
    k.rod([x, y + 0.24 * scale, z], end, 0.006 * scale, "#315c31");
    k.add(
      transformGeometry(
        ballLeaf(),
        end,
        [0.055 * scale, 0.18 * scale, 0.012 * scale],
        [Math.sin(a) * 0.6, a, Math.cos(a) * 0.8],
      ),
      i % 2 ? "#388b49" : "#5da34e",
    );
  }
}
function ballLeaf() {
  return new SphereGeometry(1, 12, 8);
}
export function createRoom() {
  const k = new ModelKit();
  k.box([0, -0.11, 0], [5.5, 0.21, 4.5], "#8d613b", 0.04);
  for (let row = 0; row < 22; row++) {
    const z = -2.1 + row * 0.2;
    for (let col = 0; col < 4; col++)
      k.box(
        [-2.015 + col * 1.34, 0, z],
        [1.326, 0.014, 0.194],
        ["#ce995e", "#d7a66c", "#c78e54", "#dfaf78"][(row * 3 + col) % 4],
        0.003,
      );
  }
  // Cutaway walls keep an office diorama readable from every camera angle.
  k.box([0, 0.43, -2.22], [5.5, 0.86, 0.1], "#b9c9b7", 0.012);
  k.box([-2.71, 0.43, 0], [0.1, 0.86, 4.5], "#a9bea6", 0.012);
  k.box([0, 0.07, -2.155], [5.35, 0.12, 0.025], "#54705c", 0.006);
  k.box([-2.647, 0.07, 0], [0.025, 0.12, 4.3], "#54705c", 0.006);
  // Office window and acoustic panel, sculpted rather than baked into a backdrop.
  k.box([-1.4, 1.06, -2.22], [1.5, 0.95, 0.08], "#3c6256", 0.014);
  k.box([-1.4, 1.06, -2.167], [1.38, 0.83, 0.013], "#a4ccbf", 0.006);
  k.box([-1.4, 1.06, -2.153], [0.035, 0.87, 0.018], "#3c6256", 0.005);
  k.box([-1.4, 1.06, -2.153], [1.43, 0.035, 0.018], "#3c6256", 0.005);
  for (let i = 0; i < 13; i++) k.box([0.6 + i * 0.08, 0.99, -2.19], [0.036, 0.64, 0.045], "#846142", 0.004);
  k.box([-2.37, 0.39, -1.32], [0.36, 0.78, 1.06], darkOak, 0.02);
  for (const y of [0.28, 0.56, 0.79]) k.box([-2.35, y, -1.32], [0.39, 0.024, 1.08], lightOak, 0.009);
  for (let i = 0; i < 8; i++)
    k.box(
      [-2.145, 0.415, -1.73 + i * 0.09],
      [0.018, 0.22 + (i % 3) * 0.015, 0.054],
      ["#36795e", "#d7be8c", "#a85235", "#557a93"][i % 4],
      0.005,
    );
  plant(k, [-1.9, 0.01, 1.35], 1.25);
  plant(k, [-2.36, 0.81, -1.61], 0.55);
  k.add(transformGeometry(new CylinderGeometry(0.15, 0.15, 0.025, 20), [1.78, 0.026, 1.25]), ink);
  k.rod([1.78, 0.04, 1.25], [1.78, 1.48, 1.25], 0.015, ink);
  k.add(
    transformGeometry(new CylinderGeometry(0.15, 0.22, 0.22, 24, 1, true), [1.78, 1.45, 1.25]),
    "#e4c48e",
  );
  k.sphere([1.78, 1.4, 1.25], [0.035, 0.045, 0.035], "#fbd88b");
  return k.build();
}
