"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ACESFilmicToneMapping, Group, PCFShadowMap, Vector3, type Camera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createMasterAvatar, poseMaster, type MasterLook } from "@/features/avatar3d/master-avatar";
import { createChair, createDesk, createRoom } from "./master-furniture";
import { disposeModel } from "./model-kit";
import {
  commandLab,
  createLabMotion,
  moveLab,
  stepLab,
  turnStation,
  type LabCommand,
  type LabMotion,
  type LabPhase,
} from "./lab-controller";
import { MASTER_3D, rotatePoint, type Point2 } from "@/shared/spatial/workstation3d";

export type CameraView = "diorama" | "front" | "back" | "left" | "right";
export type LabStatus = {
  phase: LabPhase;
  x: number;
  z: number;
  yaw: number;
  blocked: boolean;
  drawCalls: number;
  triangles: number;
};
export type LabInput = { keys: Point2; running: boolean };
export interface WorldLabProps {
  look: MasterLook;
  skin: string;
  stationYaw: number;
  guides: boolean;
  isolateAvatar: boolean;
  reducedMotion: boolean;
  view: CameraView;
  zoom: number;
  cameraRevision: number;
  command: { kind: LabCommand; revision: number };
  input: React.RefObject<LabInput>;
  onStatus: (status: LabStatus) => void;
  onReady: () => void;
  onContextLost: () => void;
}

function setCameraZoom(camera: Camera & { zoom: number; updateProjectionMatrix: () => void }, zoom: number) {
  // Three's camera is an imperative renderer resource, not React component state.
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
}
function CameraRig({
  view,
  zoom,
  cameraRevision,
  stationYaw,
  isolateAvatar,
  subject,
}: Pick<WorldLabProps, "view" | "zoom" | "cameraRevision" | "stationYaw" | "isolateAvatar"> & {
  subject: React.RefObject<LabMotion>;
}) {
  const { camera, gl, size, invalidate } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.09;
    orbit.minPolarAngle = 0.22;
    orbit.maxPolarAngle = Math.PI / 2.05;
    orbit.minZoom = 40;
    orbit.maxZoom = 300;
    orbit.enablePan = false;
    controls.current = orbit;
    return () => {
      orbit.dispose();
      controls.current = null;
    };
  }, [camera, gl]);
  useEffect(() => {
    const target =
      view === "diorama" ? { x: 0, y: 0.4, z: 0 } : rotatePoint({ x: 0, y: 0.82, z: -0.28 }, stationYaw);
    const p =
      view === "diorama"
        ? { x: 4.5, y: 4.6, z: 5.6 }
        : rotatePoint(
            {
              x: view === "left" ? -6 : view === "right" ? 6 : 0,
              y: 2.8,
              z: view === "front" ? 6 : view === "back" ? -6 : 0,
            },
            stationYaw,
          );
    camera.position.set(p.x, p.y, p.z);
    controls.current?.target.set(target.x, target.y, target.z);
    setCameraZoom(
      camera,
      Math.min(
        size.width / (view === "diorama" ? 7.5 : 3.2),
        size.height / (view === "diorama" ? 6.2 : 2.5),
      ) * zoom,
    );
    controls.current?.update();
    invalidate();
  }, [camera, gl, view, zoom, size.width, size.height, cameraRevision, stationYaw, invalidate]);
  useFrame(() => {
    const orbit = controls.current;
    if (!orbit) return;
    if (isolateAvatar) {
      const p = subject.current.position;
      const dx = p.x - orbit.target.x,
        dz = p.z - orbit.target.z;
      camera.position.set(camera.position.x + dx, camera.position.y, camera.position.z + dz);
      orbit.target.x = p.x;
      orbit.target.z = p.z;
    }
    orbit.update();
  });
  return null;
}
function Scene(props: WorldLabProps) {
  const { gl } = useThree();
  const motion = useRef<LabMotion>(createLabMotion(props.stationYaw));
  const avatar = useMemo(() => createMasterAvatar(props.look, props.skin), [props.look, props.skin]);
  const activeAvatar = useRef(avatar);
  const { onContextLost } = props;
  const room = useMemo(() => createRoom(), []),
    desk = useMemo(() => createDesk(), []),
    chair = useMemo(() => createChair(), []);
  const station = useRef<Group>(null);
  const lastReport = useRef(0),
    ready = useRef(false),
    lastCommand = useRef(-1);
  useEffect(() => {
    activeAvatar.current = avatar;
    return () => {
      disposeModel(avatar.group);
      avatar.skeleton.dispose();
    };
  }, [avatar]);
  useEffect(
    () => () => {
      disposeModel(room);
      disposeModel(desk);
      disposeModel(chair);
    },
    [room, desk, chair],
  );
  useEffect(() => {
    turnStation(motion.current, props.stationYaw);
  }, [props.stationYaw]);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl, onContextLost]);
  useFrame(({ clock }, dt) => {
    if (lastCommand.current !== props.command.revision) {
      lastCommand.current = props.command.revision;
      commandLab(motion.current, props.command.kind);
    }
    const m = motion.current,
      input = props.input.current;
    stepLab(m, dt, input.keys, input.running);
    const rig = activeAvatar.current;
    rig.group.position.set(m.position.x, 0, m.position.z);
    rig.group.rotation.y = m.yaw;
    poseMaster(
      rig,
      m.seated,
      m.moving,
      m.gait,
      m.typing && m.phase === "typing",
      clock.elapsedTime,
      props.reducedMotion,
    );
    if (station.current) station.current.rotation.y = m.stationYaw;
    if (!ready.current && gl.info.render.frame > 1) {
      ready.current = true;
      props.onReady();
    }
    if (clock.elapsedTime - lastReport.current > 0.2) {
      lastReport.current = clock.elapsedTime;
      props.onStatus({
        phase: m.phase,
        x: m.position.x,
        z: m.position.z,
        yaw: m.yaw,
        blocked: m.blocked,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
      });
    }
  });
  function floorClick(event: ThreeEvent<MouseEvent>) {
    if (event.delta > 5) return;
    event.stopPropagation();
    moveLab(motion.current, { x: event.point.x, z: event.point.z });
  }
  function sit(event: ThreeEvent<MouseEvent>) {
    if (event.delta > 5) return;
    event.stopPropagation();
    commandLab(motion.current, "sit");
  }
  return (
    <>
      <color attach="background" args={["#b8cbbb"]} />
      <ambientLight intensity={1.15} />
      <hemisphereLight args={["#f5efdb", "#658467", 1.2]} />
      <directionalLight
        position={[-3, 6, 4]}
        intensity={3.2}
        color="#fff0d5"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-normalBias={0.035}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[3, 3, -3]} intensity={1} color="#c3e4d8" />
      <pointLight position={[1.78, 1.42, 1.25]} intensity={2} distance={2.5} color="#ffce79" />
      {!props.isolateAvatar ? <primitive object={room} /> : null}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.019, 0]} onClick={floorClick} receiveShadow>
        <planeGeometry args={[5.4, 4.4]} />
        <meshStandardMaterial
          color="#b8cbbb"
          roughness={0.9}
          transparent
          opacity={props.isolateAvatar ? 1 : 0}
          depthWrite={props.isolateAvatar}
        />
      </mesh>
      <group ref={station} rotation={[0, props.stationYaw, 0]}>
        {!props.isolateAvatar ? (
          <>
            <primitive object={desk} onClick={(e: ThreeEvent<MouseEvent>) => e.stopPropagation()} />
            <primitive object={chair} onClick={sit} />
          </>
        ) : null}
        {props.guides ? (
          <>
            <mesh position={[0, MASTER_3D.sockets.seat.y, MASTER_3D.sockets.seat.z]}>
              <sphereGeometry args={[0.03, 12, 8]} />
              <meshBasicMaterial color="#ff6556" depthTest={false} />
            </mesh>
            <mesh position={[0, MASTER_3D.sockets.keyboard.y + 0.025, MASTER_3D.sockets.keyboard.z]}>
              <sphereGeometry args={[0.016, 12, 8]} />
              <meshBasicMaterial color="#4dbbf8" depthTest={false} />
            </mesh>
            <arrowHelper
              args={[new Vector3(0, 0, 1), new Vector3(0, 0.035, -1.13), 0.5, 0x13a66c, 0.09, 0.07]}
            />
          </>
        ) : null}
      </group>
      <primitive object={avatar.group} onClick={(e: ThreeEvent<MouseEvent>) => e.stopPropagation()} />
      {props.guides ? <gridHelper args={[5.4, 27, "#2b6650", "#799377"]} position={[0, 0.022, 0]} /> : null}
      <CameraRig {...props} subject={motion} />
    </>
  );
}
export default function WorldLabCanvas(props: WorldLabProps) {
  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [4.5, 4.6, 5.6], near: 0.1, far: 40, zoom: 90 }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: ACESFilmicToneMapping }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = PCFShadowMap;
        gl.toneMappingExposure = 1.05;
      }}
      fallback={
        <div role="alert">
          Perangkat ini tidak mendukung WebGL. Aplikasi 2D tetap tersedia melalui menu kembali.
        </div>
      }
      aria-label="Ruang kerja Meetopia 3D: avatar chibi, meja, kursi dan monitor"
    >
      <Scene {...props} />
    </Canvas>
  );
}
