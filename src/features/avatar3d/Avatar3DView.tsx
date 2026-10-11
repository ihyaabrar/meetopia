"use client";

/**
 * Large 3D avatar preview for the avatar editor: the exact model the 3D room shows for this
 * profile. Rebuilt only when the look changes; facing follows the editor's rotate buttons.
 */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ACESFilmicToneMapping, PCFSoftShadowMap, type Group } from "three";
import type { AvatarConfig, AvatarDirection } from "@/shared/avatar";
import { disposeModel } from "@/features/world3d/model-kit";
import { chibiKey, chibiSpec, createChibi, poseMaster, type ChibiAction } from "./master-avatar";

const YAW: Record<AvatarDirection, number> = {
  down: 0,
  "down-right": Math.PI / 4,
  right: Math.PI / 2,
  "up-right": (3 * Math.PI) / 4,
  up: Math.PI,
  "up-left": (-3 * Math.PI) / 4,
  left: -Math.PI / 2,
  "down-left": -Math.PI / 4,
};
const ACTIONS: Partial<Record<string, ChibiAction>> = {
  wave: "wave",
  jump: "jump",
  phone: "phone",
  coffee: "coffee",
  clap: "clap",
  "thumbs-up": "thumbs-up",
  dance: "dance",
  read: "read",
};

function Model({
  avatar,
  direction,
  activity,
  reduced,
}: {
  avatar: AvatarConfig;
  direction: AvatarDirection;
  activity: string;
  reduced: boolean;
}) {
  const spec = chibiSpec(avatar);
  const key = chibiKey(spec);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild only when the look really changes
  const rig = useMemo(() => createChibi(spec), [key]);
  useEffect(
    () => () => {
      disposeModel(rig.group);
      rig.skeleton.dispose();
    },
    [rig],
  );
  const turn = useRef<Group>(null);
  // Same DOM contract as the 2D preview canvas (the editor QA reads the current facing).
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.domElement.setAttribute("data-direction", direction);
  }, [gl, direction]);
  const yaw = useRef(YAW[direction]);
  const started = useRef(0);
  useEffect(() => {
    started.current = performance.now() / 1000;
  }, [activity]);
  useFrame(({ clock }, dt) => {
    let diff = YAW[direction] - yaw.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    yaw.current += diff * Math.min(1, dt * 10);
    if (turn.current) turn.current.rotation.y = yaw.current;
    const t = reduced ? 0 : clock.elapsedTime;
    // With reduced motion a walk is shown as one held mid-stride pose, not as standing still.
    const walking = activity === "walk" || activity === "run";
    const sitting = ["sit", "type", "read"].includes(activity);
    poseMaster(
      rig,
      sitting ? 1 : 0,
      walking,
      reduced ? Math.PI / 2 : t * (activity === "run" ? 17 : 11),
      activity === "type",
      t,
      reduced,
      ACTIONS[activity] ?? "idle",
      (performance.now() / 1000 - started.current) % (activity === "jump" ? 1.2 : 1e9),
    );
  });
  return (
    <group ref={turn}>
      <primitive object={rig.group} />
    </group>
  );
}

export default function Avatar3DView({
  avatar,
  direction,
  activity,
  reduced = false,
  label,
}: {
  avatar: AvatarConfig;
  direction: AvatarDirection;
  activity: string;
  reduced?: boolean;
  label: string;
}) {
  return (
    <Canvas
      className="avatar3d-view"
      shadows={{ type: PCFSoftShadowMap }}
      dpr={[1, 2]}
      camera={{ position: [0, 1.05, 3.1], fov: 30, near: 0.1, far: 20 }}
      gl={{ antialias: true, alpha: true, toneMapping: ACESFilmicToneMapping, preserveDrawingBuffer: true }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, 0.68, 0);
        gl.domElement.setAttribute("role", "img");
        gl.domElement.setAttribute("aria-label", label);
      }}
    >
      <hemisphereLight args={["#fff4e2", "#3d5a52", 1.15]} />
      <directionalLight
        position={[1.6, 3, 2.2]}
        intensity={2.2}
        color="#ffe9c9"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-1.2}
        shadow-camera-right={1.2}
        shadow-camera-top={1.6}
        shadow-camera-bottom={-0.4}
      />
      <directionalLight position={[-2, 1.5, -1.5]} intensity={0.6} color="#9fd8ff" />
      <Model avatar={avatar} direction={direction} activity={activity} reduced={reduced} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.55, 48]} />
        <shadowMaterial opacity={0.25} />
      </mesh>
    </Canvas>
  );
}
