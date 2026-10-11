"use client";

import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SKIN_TONES } from "@/shared/avatar";
import type { MasterLook } from "@/features/avatar3d/master-avatar";
import type { LabCommand } from "./lab-controller";
import type { CameraView, LabInput, LabStatus } from "./WorldLabCanvas";
import styles from "./world-lab.module.css";

const WorldCanvas = dynamic(() => import("./WorldLabCanvas"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Menyiapkan ruang 3D…</div>,
});
const PHASES = {
  idle: "Berdiri",
  walking: "Berjalan",
  approaching: "Mendekati kursi",
  "sitting-down": "Mulai duduk",
  seated: "Duduk",
  typing: "Mengetik",
  "standing-up": "Berdiri dari kursi",
};
const VIEWS: [CameraView, string][] = [
  ["diorama", "Diorama"],
  ["front", "Depan"],
  ["back", "Belakang"],
  ["left", "Kiri"],
  ["right", "Kanan"],
];
const LOOKS: [MasterLook, string, string][] = [
  ["hoodie", "Hoodie", "#24965d"],
  ["blue-jacket", "Jaket & kacamata", "#2386bd"],
  ["bob", "Rambut bob", "#734b35"],
];

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Meetopia 3D master", error, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <div className={styles.loading} role="alert">
        Ruang 3D gagal dimuat. <button onClick={() => window.location.reload()}>Coba lagi</button>
        <Link href="/app">Kembali ke aplikasi 2D</Link>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function WorldLab() {
  const [look, setLook] = useState<MasterLook>("hoodie"),
    [skin, setSkin] = useState<string>(SKIN_TONES[1]);
  const [view, setView] = useState<CameraView>("diorama"),
    [zoom, setZoom] = useState(1);
  const [cameraRevision, setCameraRevision] = useState(0),
    [stationYaw, setStationYaw] = useState(0);
  const [guides, setGuides] = useState(false),
    [reducedMotion, setReducedMotion] = useState(false);
  const [isolateAvatar, setIsolateAvatar] = useState(false);
  const [ready, setReady] = useState(false),
    [contextLost, setContextLost] = useState(false);
  const [command, setCommand] = useState<{ kind: LabCommand; revision: number }>({
    kind: "reset",
    revision: 0,
  });
  const [status, setStatus] = useState<LabStatus>({
    phase: "idle",
    x: -1.25,
    z: -1.15,
    yaw: 0,
    blocked: false,
    drawCalls: 0,
    triangles: 0,
  });
  const stage = useRef<HTMLDivElement>(null),
    pressed = useRef(new Set<string>());
  const input = useRef<LabInput>({ keys: { x: 0, z: 0 }, running: false });
  const send = useCallback(
    (kind: LabCommand) => setCommand((old) => ({ kind, revision: old.revision + 1 })),
    [],
  );
  const onReady = useCallback(() => setReady(true), []),
    onContextLost = useCallback(() => setContextLost(true), []);
  const refreshInput = useCallback(() => {
    const p = pressed.current;
    input.current = {
      keys: {
        x: Number(p.has("d") || p.has("ArrowRight")) - Number(p.has("a") || p.has("ArrowLeft")),
        z: Number(p.has("s") || p.has("ArrowDown")) - Number(p.has("w") || p.has("ArrowUp")),
      },
      running: p.has("Shift"),
    };
  }, []);
  const clearInput = useCallback(() => {
    pressed.current.clear();
    refreshInput();
  }, [refreshInput]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)"),
      update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    const up = (e: globalThis.KeyboardEvent) => {
      pressed.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      refreshInput();
    };
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clearInput);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clearInput);
    };
  }, [refreshInput, clearInput]);
  function keyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target instanceof HTMLElement && e.target.closest("button, a, input, select")) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Shift"].includes(key)) {
      e.preventDefault();
      pressed.current.add(key);
      refreshInput();
    }
    if (key === "e" && !e.repeat) {
      e.preventDefault();
      send(["typing", "seated", "sitting-down"].includes(status.phase) ? "stand" : "sit");
    }
  }
  const busy = ["approaching", "sitting-down", "standing-up"].includes(status.phase);
  return (
    <main className={styles.lab}>
      <header className={styles.header}>
        <Link href="/" aria-label="Beranda Meetopia">
          <Logo size={30} />
        </Link>
        <span className={styles.version}>
          Spatial lab <span>01</span>
        </span>
        <Link href="/app" className={styles.back}>
          Kembali ke aplikasi <span>↗</span>
        </Link>
      </header>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>MEETOPIA / NEW DIMENSION</p>
          <h1>Ruang yang terasa nyata.</h1>
          <p>Satu master. Semua sudut. Avatar dan furnitur yang benar-benar bertemu.</p>
        </div>
        <span className={styles.badge}>
          <i />
          Prototype 3D · bukan map produksi
        </span>
      </div>
      <div className={styles.workspace}>
        <section className={styles.viewportSection} aria-label="Pratinjau interaktif 3D">
          <div className={styles.viewportBar}>
            <span>
              <i />
              Kantor / Oak & Emerald
            </span>
            <span>1 unit = 1 meter</span>
          </div>
          <div
            ref={stage}
            className={styles.stage}
            tabIndex={0}
            onKeyDown={keyDown}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) clearInput();
            }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).tagName === "CANVAS")
                stage.current?.focus({ preventScroll: true });
            }}
            aria-label="Ruang 3D interaktif"
            aria-describedby="lab-keyboard"
            data-ready={ready}
          >
            <SceneBoundary>
              <WorldCanvas
                look={look}
                skin={skin}
                stationYaw={stationYaw}
                guides={guides}
                isolateAvatar={isolateAvatar}
                reducedMotion={reducedMotion}
                view={view}
                zoom={zoom}
                cameraRevision={cameraRevision}
                command={command}
                input={input}
                onStatus={setStatus}
                onReady={onReady}
                onContextLost={onContextLost}
              />
            </SceneBoundary>
            {!ready ? <div className={styles.cornerNote}>Memuat geometri 3D…</div> : null}
            <span className={styles.roomLabel}>{isolateAvatar ? "MASTER / AVATAR" : "WORK / 01"}</span>
            {isolateAvatar && ready ? (
              <span className={styles.cornerNote}>
                {["typing", "seated"].includes(status.phase)
                  ? "Pose duduk tetap aktif; kursi dan meja disembunyikan."
                  : "Mode inspeksi: geometri avatar saja."}
              </span>
            ) : null}
            <div className={styles.zoom} aria-label="Zoom kamera">
              <button onClick={() => setZoom((z) => Math.min(1.7, z + 0.15))} aria-label="Perbesar kamera">
                +
              </button>
              <button onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))} aria-label="Perkecil kamera">
                −
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setCameraRevision((r) => r + 1);
                }}
                aria-label="Reset kamera"
              >
                ↺
              </button>
            </div>
            <div className={styles.cameraViews} role="group" aria-label="Sudut kamera">
              {VIEWS.map(([id, title]) => (
                <button
                  key={id}
                  aria-pressed={view === id}
                  onClick={() => {
                    setView(id);
                    setCameraRevision((r) => r + 1);
                  }}
                >
                  {title}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.actionBar} role="group" aria-label="Aksi avatar">
            <span className={styles.liveState}>
              <i />
              {PHASES[status.phase]}
            </span>
            {(
              [
                ["walk", "Berjalan"],
                ["sit", "Duduk"],
                ["type", "Mengetik"],
                ["stand", "Berdiri"],
              ] as [LabCommand, string][]
            ).map(([kind, title]) => (
              <button
                key={kind}
                disabled={busy && kind !== "stand"}
                aria-pressed={
                  (kind === "sit" && status.phase === "seated") ||
                  (kind === "type" && status.phase === "typing")
                }
                onClick={() => send(kind)}
              >
                {title}
              </button>
            ))}
          </div>
          <p id="lab-keyboard" className={styles.instructions}>
            <span>
              <kbd>W A S D</kbd> / panah untuk jalan · <kbd>Shift</kbd> lari · <kbd>E</kbd> duduk / berdiri
            </span>
            <span>Klik lantai untuk jalan. Seret untuk orbit.</span>
          </p>
          {status.blocked ? (
            <p className={styles.notice} role="status">
              Jalur terhalang furnitur. Pilih titik lantai lain.
            </p>
          ) : null}
          {contextLost ? (
            <p className={styles.notice} role="alert">
              Koneksi GPU terputus. <button onClick={() => window.location.reload()}>Muat ulang ruang</button>
            </p>
          ) : null}
        </section>
        <aside className={styles.inspector} aria-label="Pengaturan master">
          <div className={styles.inspectorHeading}>
            <span>MASTER CHARACTER</span>
            <span>01 / 03</span>
          </div>
          <h2>Kenali wujud barunya.</h2>
          <p className={styles.muted}>Bandingkan baju, kepala, dan pose duduk dari setiap sisi.</p>
          <fieldset className={styles.looks}>
            <legend>Karakter uji</legend>
            {LOOKS.map(([id, name, color], i) => (
              <button key={id} aria-pressed={look === id} onClick={() => setLook(id)}>
                <span className={styles.lookColor} style={{ background: color }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  {name}
                  <small>
                    {id === "blue-jacket"
                      ? "Uji avatar yang sebelumnya bermasalah"
                      : id === "bob"
                        ? "Siluet rambut panjang"
                        : "Master proporsi chibi"}
                  </small>
                </span>
                <span>{look === id ? "✓" : ""}</span>
              </button>
            ))}
          </fieldset>
          <fieldset className={styles.swatches}>
            <legend>Warna kulit</legend>
            {SKIN_TONES.map((tone, i) => (
              <button
                key={tone}
                style={{ background: tone }}
                aria-label={`Warna kulit ${i + 1}`}
                aria-pressed={skin === tone}
                onClick={() => setSkin(tone)}
              >
                {skin === tone ? "✓" : ""}
              </button>
            ))}
          </fieldset>
          <div className={styles.rotation}>
            <label htmlFor="station-rotation">
              Arah workstation <span>Meja + kursi + avatar</span>
            </label>
            <select
              id="station-rotation"
              value={Math.round((stationYaw * 180) / Math.PI)}
              onChange={(e) => {
                clearInput();
                setStationYaw((Number(e.target.value) * Math.PI) / 180);
                send("reset");
              }}
            >
              <option value={0}>0° · arah +Z</option>
              <option value={90}>90° · arah +X</option>
              <option value={180}>180° · arah −Z</option>
              <option value={270}>270° · arah −X</option>
            </select>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={isolateAvatar}
              onChange={(e) => {
                setIsolateAvatar(e.target.checked);
                setCameraRevision((r) => r + 1);
              }}
            />
            <span>
              Isolasi avatar<small>Sembunyikan furnitur untuk cek sambungan</small>
            </span>
          </label>
          <label className={styles.toggle}>
            <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} />
            <span>
              Titik kontak & grid<small>Merah: pinggul · biru: keyboard</small>
            </span>
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
            />
            <span>
              Kurangi gerak<small>Matikan bobbing dan ketukan tangan</small>
            </span>
          </label>
          <div className={styles.metrics}>
            <div>
              <span>Model</span>
              <strong>Rig 3D / 11 bones</strong>
            </div>
            <div>
              <span>Ukuran meja</span>
              <strong>1.70 × 0.76 × 0.72 m</strong>
            </div>
            <div>
              <span>Footrest</span>
              <strong>Menopang kaki chibi</strong>
            </div>
            <output
              data-phase={status.phase}
              data-x={status.x.toFixed(3)}
              data-z={status.z.toFixed(3)}
              data-yaw={status.yaw.toFixed(3)}
              aria-label="Diagnostik renderer"
            >
              <span>Render</span>
              <strong>
                {status.drawCalls} calls · {(status.triangles / 1000).toFixed(1)}k tris
              </strong>
            </output>
          </div>
          <button
            className={styles.reset}
            onClick={() => {
              clearInput();
              send("reset");
            }}
          >
            Reset pose & posisi <span>↺</span>
          </button>
          <div className={styles.scope}>
            <span>YANG SEDANG DIUJI</span>
            <p>
              Jalan → duduk → mengetik → berdiri. Profil, map, dan avatar produksi tidak diubah di lab ini.
            </p>
            <Link href="/asset-lab">Bandingkan dengan master 2D ↗</Link>
          </div>
        </aside>
      </div>
      <footer className={styles.footer}>
        <span>BUILT FOR TOGETHERNESS.</span>
        <span>Chibi 3D · original procedural master</span>
      </footer>
    </main>
  );
}
