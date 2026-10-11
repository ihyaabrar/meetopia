"use client";

/**
 * The 3D room: same map, same people, same realtime state as the 2D canvas, drawn with Three.js.
 * RoomStage keeps all movement/realtime/UI logic and writes a frame description into `frameRef`
 * every animation frame; this component only renders it and answers pick/project questions.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  PCFSoftShadowMap,
  Plane,
  Raycaster,
  RingGeometry,
  Vector2,
  Vector3,
} from "three";
import type { MapData, MapObject } from "@/shared/map";
import type { Point } from "@/shared/pathfinding";
import type { Presence } from "@/shared/protocol";
import {
  chibiKey,
  chibiSpec,
  createChibi,
  poseMaster,
  type ChibiAction,
  type MasterRig,
} from "@/features/avatar3d/master-avatar";
import { disposeModel } from "@/features/world3d/model-kit";
import { buildFurniture, TILE_M } from "./furniture3d";
import { buildWorld } from "./world-model";

export interface Person3D {
  p: Presence;
  x: number;
  y: number;
  phase: number;
  actionAt?: number;
  speaking: number;
  isSelf: boolean;
}
export interface Room3DFrame {
  people: Person3D[];
  /** 2D zoom (screen px per 2D world px); 3D uses the same value so zoom buttons keep working. */
  zoom: number;
  insetTop: number;
  insetBottom: number;
  target: Point | null;
  focusObj: MapObject | null;
  reducedMotion: boolean;
  showNames: boolean;
  time: number;
}
export interface Room3DApi {
  /** Screen point → map tile coordinates (fractional), or null outside the floor. */
  pick(clientX: number, clientY: number): { x: number; y: number } | null;
  /** Map tile coordinates + height in metres → px relative to the canvas, or null if hidden. */
  project(x: number, y: number, height: number): { left: number; top: number } | null;
  emote(id: string, emoji: string): void;
  bubble(id: string, text: string): void;
}

const PX_PER_2D = 32 / TILE_M;
const CAMERA_OFFSET = new Vector3(0, 7, 9);
const SIN_PITCH = CAMERA_OFFSET.y / CAMERA_OFFSET.length();
const STATUS_COLOR: Record<string, string> = {
  active: "#00d69b",
  busy: "#f2837a",
  meeting: "#a98be0",
  away: "#e3b25c",
  offline: "#7d766e",
};

const YAW: Record<string, number> = {
  down: 0,
  "down-right": Math.PI / 4,
  right: Math.PI / 2,
  "up-right": (3 * Math.PI) / 4,
  up: Math.PI,
  "up-left": (-3 * Math.PI) / 4,
  left: -Math.PI / 2,
  "down-left": -Math.PI / 4,
};
const ACTIONS: Record<string, ChibiAction> = {
  wave: "wave",
  jump: "jump",
  phone: "phone",
  coffee: "coffee",
  clap: "clap",
  "thumbs-up": "thumbs-up",
  dance: "dance",
};
const SEAT_DROP: Partial<Record<string, number>> = { beanbag: -0.16, bed: 0.04, sofa: -0.03 };

function createMarkers() {
  const ring = new Mesh(
    new RingGeometry(0.16, 0.22, 32),
    new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  // A square outline (4-segment ring turned 45°) around the object being interacted with.
  const focus = new Mesh(
    new RingGeometry(0.5, 0.56, 4, 1),
    new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85, depthWrite: false }),
  );
  focus.rotation.x = -Math.PI / 2;
  focus.visible = false;
  return { ring, focus };
}

type Effects = Map<string, { emoji?: string; emojiAt?: number; bubble?: string; bubbleAt?: number }>;
type LabelEl = { root: HTMLDivElement; name: HTMLSpanElement; extra: HTMLDivElement };

function Scene({
  map,
  frameRef,
  apiRef,
  zoneLabel,
  labels,
  effects,
  onReady,
}: {
  map: MapData;
  frameRef: React.RefObject<Room3DFrame | null>;
  apiRef: React.RefObject<Room3DApi | null>;
  zoneLabel: (key: string) => string;
  labels: React.RefObject<Map<string, LabelEl>>;
  effects: React.RefObject<Effects>;
  onReady: (ids: string[]) => void;
}) {
  const { camera, gl, scene, size } = useThree();
  const world = useMemo(() => buildWorld(map, zoneLabel), [map, zoneLabel]);
  const furniture = useMemo(() => buildFurniture(map), [map]);
  const rigs = useRef(
    new Map<string, { key: string; rig: MasterRig; yaw: number; seated: number; away: boolean }>(),
  );
  const sun = useRef<DirectionalLight>(null);
  const target = useRef(new Vector3(map.spawn.x * TILE_M, 0, map.spawn.y * TILE_M));
  // Imperative scene helpers live in a ref: they are mutated every frame, never React state.
  const fxRef = useRef<{ ring: Mesh; focus: Mesh } | null>(null);
  if (fxRef.current === null) fxRef.current = createMarkers();
  const lastIds = useRef("");
  const first = useRef(true);

  useEffect(() => {
    void world.ready;
    return () => world.dispose();
  }, [world]);
  useEffect(() => () => disposeModel(furniture), [furniture]);
  useEffect(() => {
    const all = rigs.current;
    const { ring, focus } = fxRef.current!;
    scene.add(ring, focus);
    return () => {
      scene.remove(ring, focus);
      for (const r of all.values()) {
        disposeModel(r.rig.group);
        r.rig.skeleton.dispose();
      }
      all.clear();
      ring.geometry.dispose();
      (ring.material as MeshBasicMaterial).dispose();
      focus.geometry.dispose();
      (focus.material as MeshBasicMaterial).dispose();
    };
  }, [scene]);

  // Picking and projection for RoomStage (tile coordinates in, tile coordinates out).
  useEffect(() => {
    const ray = new Raycaster(),
      floor = new Plane(new Vector3(0, 1, 0), 0),
      hit = new Vector3();
    apiRef.current = {
      pick(clientX, clientY) {
        const r = gl.domElement.getBoundingClientRect();
        ray.setFromCamera(
          new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1),
          camera,
        );
        if (!ray.ray.intersectPlane(floor, hit)) return null;
        return { x: hit.x / TILE_M, y: hit.z / TILE_M };
      },
      project(x, y, height) {
        const v = new Vector3(x * TILE_M, height, y * TILE_M).project(camera);
        if (v.z > 1) return null;
        return { left: ((v.x + 1) / 2) * size.width, top: ((1 - v.y) / 2) * size.height };
      },
      emote(id, emoji) {
        effects.current.set(id, { ...effects.current.get(id), emoji, emojiAt: performance.now() });
      },
      bubble(id, text) {
        effects.current.set(id, { ...effects.current.get(id), bubble: text, bubbleAt: performance.now() });
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, camera, gl, size.width, size.height, effects]);

  const tmp = useMemo(() => new Vector3(), []);
  useFrame((state, dt) => {
    const f = frameRef.current;
    if (!f) return;
    const cam = state.camera as OrthographicCamera;
    const { ring, focus } = fxRef.current!;
    const self = f.people.find((p) => p.isSelf);
    // Camera: follow the person smoothly, but never show more than a margin beyond the map edges
    // (like the 2D view). Zoom matches the 2D zoom buttons, converted to px per metre.
    const zoom = Math.max(18, f.zoom * PX_PER_2D);
    const W = map.width * TILE_M,
      D = map.height * TILE_M;
    // Ground distance covered by half the visible band (orthographic, tilted camera).
    const band = Math.max(1, size.height - f.insetTop - f.insetBottom);
    const halfW = size.width / 2 / zoom,
      halfD = band / 2 / zoom / SIN_PITCH;
    const margin = TILE_M;
    const clamp = (v: number, half: number, len: number) =>
      2 * half >= len + 2 * margin ? len / 2 : Math.max(half - margin, Math.min(len - half + margin, v));
    if (self) tmp.set(self.x * TILE_M, 0, self.y * TILE_M);
    else tmp.set(W / 2, 0, D / 2);
    tmp.set(clamp(tmp.x, halfW, W), 0, clamp(tmp.z, halfD, D));
    const k = 1 - Math.pow(0.002, Math.min(dt, 0.1));
    target.current.lerp(tmp, first.current ? 1 : k);
    first.current = false;
    // Centre the target in the band between the HUD and the dock, not in the whole canvas.
    const shift = (f.insetTop - f.insetBottom) / 2 / zoom / SIN_PITCH;
    cam.position.copy(target.current).add(CAMERA_OFFSET);
    cam.position.z -= shift;
    cam.lookAt(target.current.x, 0, target.current.z - shift);
    if (cam.zoom !== zoom) {
      cam.zoom = zoom;
      cam.updateProjectionMatrix();
    }
    if (sun.current) {
      sun.current.position.set(target.current.x - 4, 9, target.current.z + 5);
      sun.current.target.position.copy(target.current);
      sun.current.target.updateMatrixWorld();
    }

    // People: create/remove rigs, place and pose them.
    const seen = new Set<string>();
    let created = 0;
    for (const v of f.people) {
      const spec = chibiSpec(v.p.avatar);
      const key = chibiKey(spec);
      let entry = rigs.current.get(v.p.id);
      if (!entry || entry.key !== key) {
        if (created >= 2 && entry) {
          seen.add(v.p.id);
          continue;
        }
        if (created >= 2) continue;
        created++;
        if (entry) {
          scene.remove(entry.rig.group);
          disposeModel(entry.rig.group);
          entry.rig.skeleton.dispose();
        }
        const rig = createChibi(spec);
        scene.add(rig.group);
        entry = { key, rig, yaw: YAW[v.p.dir] ?? 0, seated: v.p.sitting ? 1 : 0, away: false };
        rigs.current.set(v.p.id, entry);
      }
      seen.add(v.p.id);
      const seat = v.p.sitting && v.p.seatId ? map.objects.find((o) => o.id === v.p.seatId) : undefined;
      entry.seated += ((v.p.sitting ? 1 : 0) - entry.seated) * Math.min(1, dt * 10);
      const want = YAW[v.p.dir] ?? 0;
      let diff = want - entry.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      entry.yaw += diff * Math.min(1, dt * 12);
      const g = entry.rig.group;
      g.position.set(v.x * TILE_M, (seat ? (SEAT_DROP[seat.kind] ?? 0) : 0) * entry.seated, v.y * TILE_M);
      g.rotation.y = entry.yaw;
      const action = ACTIONS[v.p.avatarAction ?? "idle"] ?? "idle";
      poseMaster(
        entry.rig,
        entry.seated,
        v.phase > 0,
        v.phase,
        v.p.sitting && v.p.avatarAction === "type",
        f.time,
        f.reducedMotion,
        action,
        Math.max(0, f.time - (v.actionAt ?? 0)),
      );
      // "Away" people are drawn faded (only touch materials when it changes).
      const away = v.p.status === "away";
      if (entry.away !== away) {
        entry.away = away;
        g.traverse((o: Object3D) => {
          if (o instanceof Mesh)
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
              m.transparent = away;
              m.opacity = away ? 0.55 : 1;
              m.needsUpdate = true;
            }
        });
      }
    }
    for (const [id, entry] of rigs.current)
      if (!seen.has(id)) {
        scene.remove(entry.rig.group);
        disposeModel(entry.rig.group);
        entry.rig.skeleton.dispose();
        rigs.current.delete(id);
      }
    const ids = f.people.map((p) => p.p.id).join(",");
    if (ids !== lastIds.current) {
      lastIds.current = ids;
      onReady(f.people.map((p) => p.p.id));
    }

    // Name chips, emoji and nearby-chat bubbles follow the heads on screen.
    const now = performance.now();
    for (const v of f.people) {
      const el = labels.current.get(v.p.id);
      if (!el) continue;
      const entry = rigs.current.get(v.p.id);
      const top = entry ? 1.52 - 0.42 * entry.seated : 1.5;
      const pos = new Vector3(v.x * TILE_M, top, v.y * TILE_M).project(cam);
      const left = ((pos.x + 1) / 2) * size.width,
        y = ((1 - pos.y) / 2) * size.height;
      el.root.style.transform = `translate(${left.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.root.style.display = f.showNames || v.isSelf ? "" : "none";
      el.root.dataset.speaking = v.speaking > 0.08 && v.p.media.mic ? "true" : "false";
      el.root.style.setProperty("--status", STATUS_COLOR[v.p.status] ?? STATUS_COLOR.active);
      if (el.name.textContent !== v.p.name) el.name.textContent = v.p.name;
      el.root.dataset.mic = v.p.media.mic ? "on" : "off";
      const fx = effects.current.get(v.p.id);
      const emoji = fx?.emoji && now - (fx.emojiAt ?? 0) < 2600 ? fx.emoji : "";
      const bubble = fx?.bubble && now - (fx.bubbleAt ?? 0) < 6000 ? fx.bubble : "";
      const text = bubble || emoji;
      if (el.extra.textContent !== text) el.extra.textContent = text;
      el.extra.dataset.kind = bubble ? "bubble" : emoji ? "emoji" : "none";
    }

    // Walk target and the object that is being interacted with.
    ring.visible = !!f.target;
    if (f.target) {
      const p = (Math.sin(f.time * 6) + 1) / 2;
      ring.position.set((f.target.x + 0.5) * TILE_M, 0.02, (f.target.y + 0.5) * TILE_M);
      ring.scale.setScalar(1 + p * 0.25);
    }
    focus.visible = !!f.focusObj;
    if (f.focusObj) {
      const o = f.focusObj;
      focus.position.set((o.x + o.w / 2) * TILE_M, 0.025, (o.y + o.h / 2) * TILE_M);
      focus.scale.set(((o.w + 0.3) * TILE_M) / 0.75, ((o.h + 0.3) * TILE_M) / 0.75, 1);
      focus.rotation.z = Math.PI / 4;
      (focus.material as MeshBasicMaterial).opacity = 0.6 + Math.sin(f.time * 4) * 0.25;
    }
  });

  const sky = map.template === "rooftop" ? "#bfe0ea" : "#0b1a21";
  return (
    <>
      <color attach="background" args={[sky]} />
      <hemisphereLight args={["#fff4e2", "#4f5f58", 1.05]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        ref={sun}
        intensity={2.3}
        color="#ffe9c9"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-normalBias={0.04}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[6, 5, -6]} intensity={0.45} color="#bfe3ff" />
      <primitive object={world.group} />
      <primitive object={furniture} />
    </>
  );
}

export default function Room3D({
  map,
  frameRef,
  apiRef,
  zoneLabel,
  className,
  canvasLabel,
  handlers,
  onCanvas,
  style,
  interactive = true,
}: {
  map: MapData;
  frameRef: React.RefObject<Room3DFrame | null>;
  apiRef: React.RefObject<Room3DApi | null>;
  zoneLabel: (key: string) => string;
  className?: string;
  canvasLabel: string;
  /** Receives the WebGL canvas (RoomStage measures it and attaches the pointer cursor to it). */
  onCanvas?: (canvas: HTMLCanvasElement | null) => void;
  style?: React.CSSProperties;
  /** false = decorative preview: not focusable, announced as an image. */
  interactive?: boolean;
  handlers: Pick<
    React.HTMLAttributes<HTMLDivElement>,
    "onPointerDown" | "onPointerUp" | "onPointerMove" | "onKeyDown" | "onWheel"
  >;
}) {
  const labels = useRef(new Map<string, LabelEl>());
  const effects = useRef<Effects>(new Map());
  const [ids, setIds] = useState<string[]>([]);
  return (
    <div className={`room3d ${className ?? ""}`} style={style} {...handlers}>
      <Canvas
        orthographic
        shadows={{ type: PCFSoftShadowMap }}
        dpr={[1, 1.75]}
        camera={{ position: [0, 7, 9], near: 0.1, far: 80, zoom: 60 }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: ACESFilmicToneMapping }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.02;
          const c = gl.domElement;
          // Same DOM contract as the 2D canvas (keyboard focus, tests, assistive tech).
          if (interactive) {
            c.classList.add("map");
            c.tabIndex = 0;
            c.setAttribute("role", "application");
          } else c.setAttribute("role", "img");
          c.setAttribute("aria-label", canvasLabel);
          c.dataset.renderer = "3d";
          c.style.background = new Color("#0b1a21").getStyle();
          onCanvas?.(c);
        }}
        fallback={<div role="alert">WebGL tidak tersedia.</div>}
      >
        <Scene
          map={map}
          frameRef={frameRef}
          apiRef={apiRef}
          zoneLabel={zoneLabel}
          labels={labels}
          effects={effects}
          onReady={setIds}
        />
      </Canvas>
      <div className="room3d-labels" aria-hidden="true">
        {ids.map((id) => (
          <div
            key={id}
            className="room3d-label"
            ref={(el) => {
              if (!el) {
                labels.current.delete(id);
                return;
              }
              labels.current.set(id, {
                root: el,
                name: el.querySelector(".n") as HTMLSpanElement,
                extra: el.querySelector(".x") as HTMLDivElement,
              });
            }}
          >
            <div className="x" data-kind="none" />
            <span className="chip">
              <i className="dot" />
              <span className="n" />
              <i className="mic" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
