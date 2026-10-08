"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { DEFAULT_AVATAR, OUTFITS, type AvatarConfig } from "@/shared/avatar";
import { WORKSTATION_DIRECTIONS, type WorkstationDirection } from "@/shared/workstation";
import { workstationPreview } from "@/client/art/workstation-preview";

const DIRECTIONS = {
  up: ["01 · Menghadap atas", "Punggung avatar · layar monitor terlihat"],
  right: ["02 · Menghadap kanan", "Kursi di kiri · meja memanjang vertikal"],
  down: ["03 · Menghadap bawah", "Wajah avatar · bagian belakang monitor"],
  left: ["04 · Menghadap kiri", "Kursi di kanan · bukan gambar cermin"],
};
type Controls = { zoom: number; activity: "sit" | "type"; guides: boolean; animate: boolean };
const OUTFIT_NAMES = ["Hoodie", "Kaos", "Jaket", "Kemeja", "Polo", "Sweater", "Blazer", "Kaos garis"];
function Sample({
  dir,
  avatar,
  controls,
}: {
  dir: WorkstationDirection;
  avatar: AvatarConfig;
  controls: Controls;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const options = useRef(controls);
  const [error, setError] = useState("");
  useEffect(() => {
    options.current = controls;
  }, [controls]);
  useEffect(() => {
    let active = true,
      frame = 0;
    workstationPreview(dir, avatar)
      .then((preview) => {
        if (!active || !canvas.current) return;
        const start = performance.now(),
          motion = window.matchMedia("(prefers-reduced-motion: reduce)");
        let previous = "";
        const draw = (now: number) => {
          if (!active || !canvas.current) return;
          const settings = options.current,
            animated = settings.animate && !motion.matches;
          const key = JSON.stringify(settings);
          if (animated || key !== previous) {
            preview.draw(canvas.current, { ...settings, time: animated ? (now - start) / 1000 : 0 });
            previous = key;
            canvas.current.dataset.ready = "true";
          }
          frame = requestAnimationFrame(draw);
        };
        draw(start);
      })
      .catch(() => {
        if (active) setError("Aset gagal dimuat. Muat ulang halaman untuk mencoba lagi.");
      });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [dir, avatar]);
  return (
    <article className="asset-lab-card">
      <div className="asset-lab-card-heading">
        <h2>{DIRECTIONS[dir][0]}</h2>
        <p>{DIRECTIONS[dir][1]}</p>
      </div>
      {error && <p role="alert">{error}</p>}
      <canvas
        ref={canvas}
        width={440}
        height={360}
        aria-label={`Pratinjau workstation ${dir}`}
        data-direction={dir}
      />
      <div className="asset-lab-card-footer">
        <span>Oak / Emerald</span>
        <span>Meja 4×1 · kursi 1×1</span>
      </div>
    </article>
  );
}
export default function AssetLab() {
  const [avatar, setAvatar] = useState<AvatarConfig>({
    ...DEFAULT_AVATAR,
    body: "tall",
    outfit: "jacket",
    hair: "spiky",
    hairColor: "#257fc6",
    bodyColor: "#168f79",
    eyewear: "square",
  });
  const [controls, setControls] = useState<Controls>({
    zoom: 2,
    activity: "sit",
    guides: false,
    animate: false,
  });
  return (
    <main className="asset-lab">
      <header className="asset-lab-header">
        <Logo size={30} />
        <Link className="btn secondary small" href="/app">
          Kembali ke aplikasi →
        </Link>
      </header>
      <section className="asset-lab-intro">
        <span className="eyebrow">MASTER ASSET / 02</span>
        <h1>
          Satu workstation.
          <br />
          Empat arah yang benar.
        </h1>
        <p>
          Bandingkan meja, kursi, dan avatar dari renderer aplikasi. Ini karakter uji: pengaturan di sini
          tidak mengubah profil atau map milikmu.
        </p>
        <span className="asset-lab-badge">Prototype · Oak / Emerald</span>
      </section>
      <div className="asset-lab-controls" aria-label="Pengaturan pratinjau">
        <label className="field">
          Bentuk tubuh
          <select
            className="input"
            aria-label="Bentuk tubuh"
            value={avatar.body}
            onChange={(e) => setAvatar({ ...avatar, body: e.target.value as AvatarConfig["body"] })}
          >
            <option value="tall">Tinggi</option>
            <option value="round">Bulat</option>
            <option value="small">Kecil</option>
          </select>
        </label>
        <label className="field">
          Karakter uji
          <select
            className="input"
            aria-label="Karakter uji"
            value={avatar.gender}
            onChange={(e) => {
              const gender = e.target.value as AvatarConfig["gender"];
              setAvatar({ ...avatar, gender, hair: gender === "female" ? "bob" : "spiky" });
            }}
          >
            <option value="male">Pria</option>
            <option value="female">Wanita</option>
            <option value="neutral">Netral</option>
          </select>
        </label>
        <label className="field">
          Baju
          <select
            className="input"
            aria-label="Baju"
            value={avatar.outfit}
            onChange={(e) => setAvatar({ ...avatar, outfit: e.target.value as AvatarConfig["outfit"] })}
          >
            {OUTFITS.map((outfit, i) => (
              <option key={outfit} value={outfit}>
                {OUTFIT_NAMES[i]}
              </option>
            ))}
          </select>
        </label>
        <div className="asset-lab-pose" role="group" aria-label="Pose">
          <span>Pose</span>
          <div>
            {(["sit", "type"] as const).map((activity) => (
              <button
                key={activity}
                className={`chip ${controls.activity === activity ? "active" : ""}`}
                aria-pressed={controls.activity === activity}
                onClick={() => setControls({ ...controls, activity })}
              >
                {activity === "sit" ? "Duduk" : "Mengetik"}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          Zoom
          <select
            className="input"
            aria-label="Zoom"
            value={controls.zoom}
            onChange={(e) => setControls({ ...controls, zoom: Number(e.target.value) })}
          >
            <option value={1}>1× · ukuran map</option>
            <option value={2}>2× · inspeksi detail</option>
          </select>
        </label>
        <label className="asset-lab-toggle">
          <input
            type="checkbox"
            checked={controls.guides}
            onChange={(e) => setControls({ ...controls, guides: e.target.checked })}
          />
          Grid & titik duduk
        </label>
        <label className="asset-lab-toggle">
          <input
            type="checkbox"
            checked={controls.animate}
            onChange={(e) => setControls({ ...controls, animate: e.target.checked })}
          />
          Putar animasi
        </label>
      </div>
      <section className="asset-lab-grid" aria-label="Empat arah workstation">
        {WORKSTATION_DIRECTIONS.map((dir) => (
          <Sample key={dir} dir={dir} avatar={avatar} controls={controls} />
        ))}
      </section>
      <footer className="asset-lab-note">
        <p>
          Garis emas = tapak di lantai. Titik merah = sambungan panggul ke bantalan kursi. Meja kosong, kursi,
          monitor, dan keyboard memakai komponen gambar terpisah.
        </p>
        <p>
          Target kamera ilustrasi: orthographic elevated 45°. Ini belum sertifikasi proyeksi 3D presisi; paket
          furnitur lain masih menunggu kalibrasi master.
        </p>
      </footer>
    </main>
  );
}
