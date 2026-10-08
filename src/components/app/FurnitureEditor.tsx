"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/client/api";
import { TILE, type MapData, type MapObject, type ObjectKind } from "@/shared/map";
import { objectPlacementError, layoutError } from "@/shared/map-edit";
import { renderIllustratedPreview } from "@/client/art/world";
import { furnitureRect } from "@/client/art/environment-assets";
import { orientWorkstation, workstationFacing, type WorkstationDirection } from "@/shared/workstation";
import { useT } from "@/i18n/client";
import { Icon } from "@/components/Icon";

const CATALOG: Array<[ObjectKind, number, number]> = [
  ["desk", 4, 1],
  ["chair", 1, 1],
  ["sofa", 4, 1],
  ["table", 5, 2],
  ["beanbag", 1, 1],
  ["plant", 1, 1],
  ["palm", 1, 1],
  ["lamp", 1, 1],
  ["bookshelf", 2, 1],
  ["tv", 3, 1],
  ["coffee", 2, 1],
  ["cooler", 1, 1],
  ["gamingDesk", 4, 1],
  ["whiteboard", 3, 1],
  ["speaker", 1, 1],
  ["camera", 1, 1],
  ["softbox", 1, 1],
  ["cabinet", 2, 1],
  ["rug", 5, 3],
  ["bed", 3, 3],
  ["counter", 4, 1],
  ["fridge", 1, 1],
  ["arcade", 1, 1],
  ["welcome", 4, 1],
  ["noticeboard", 3, 1],
  ["vending", 1, 1],
  ["printer", 1, 1],
  ["art", 2, 1],
  ["parasol", 2, 2],
  ["pergola", 4, 2],
  ["greenscreen", 4, 1],
  ["bbq", 3, 1],
  ["firepit", 2, 2],
  ["foosball", 3, 2],
  ["bath", 3, 2],
  ["sink", 2, 1],
];
const INTERACTIONS: Partial<Record<ObjectKind, MapObject["actions"]>> = {
  chair: ["sit"],
  sofa: ["sit"],
  beanbag: ["sit"],
  bed: ["sit"],
  desk: ["openPrivateNotes"],
  table: ["openSharedNotes"],
  tv: ["watch"],
  coffee: ["brew"],
  cooler: ["drink"],
  whiteboard: ["openSharedNotes"],
  noticeboard: ["openSharedNotes"],
  speaker: ["music"],
  bookshelf: ["read"],
  gamingDesk: ["play"],
  arcade: ["play"],
  foosball: ["play"],
  counter: ["cook"],
  bbq: ["cook"],
  fridge: ["drink"],
  vending: ["buy"],
  welcome: ["showTips"],
};

export function FurnitureEditor({ groupId, onSaved }: { groupId: string; onSaved: () => void }) {
  const t = useT(),
    canvas = useRef<HTMLCanvasElement>(null);
  const [map, setMap] = useState<MapData | null>(null),
    [saved, setSaved] = useState<MapData | null>(null);
  const [selected, setSelected] = useState<string | null>(null),
    // Kunci terjemahan (diterjemahkan saat render agar ganti bahasa tidak memuat ulang map).
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [history, setHistory] = useState<MapData[]>([]);
  const drag = useRef<{ id: string; dx: number; dy: number; start: MapData } | null>(null);
  const loadRequest = useRef(0);
  const load = useCallback(() => {
    const request = ++loadRequest.current;
    setError("");
    void api<{ map: MapData }>(`/api/groups/${groupId}/map`)
      .then((r) => {
        if (request !== loadRequest.current) return;
        setMap(r.map);
        setSaved(r.map);
        setHistory([]);
        setSelected(null);
      })
      .catch(() => {
        if (request === loadRequest.current) setError("editor.loadFailed");
      });
  }, [groupId]);
  useEffect(() => {
    const requestGuard = loadRequest;
    load();
    // Strict-mode's first request or a previous group's response must not erase an active draft.
    return () => {
      requestGuard.current++;
    };
  }, [load]);
  useEffect(() => {
    if (!map) return;
    let active = true;
    void renderIllustratedPreview(map, t).then((r) => {
      if (!active || !canvas.current) return;
      const c = canvas.current;
      c.width = r.canvas.width;
      c.height = r.canvas.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(r.canvas, 0, 0);
      const o = map.objects.find((item) => item.id === selected);
      if (o) {
        ctx.strokeStyle = "#00e4ad";
        ctx.lineWidth = 4;
        ctx.strokeRect(o.x * TILE, o.y * TILE, o.w * TILE, o.h * TILE);
      }
    });
    return () => {
      active = false;
    };
  }, [map, selected, t]);
  const edit = (next: MapData) => {
    if (busy) return;
    if (map) setHistory((h) => [...h.slice(-29), map]);
    setMap(next);
    setError("");
  };
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) * e.currentTarget.width) / box.width / TILE,
      y: ((e.clientY - box.top) * e.currentTarget.height) / box.height / TILE,
    };
  };
  const itemName = (kind: ObjectKind) => t(`editor.item.${kind}`);
  const item = map?.objects.find((o) => o.id === selected);
  const changed = map && saved && JSON.stringify(map.objects) !== JSON.stringify(saved.objects);
  const move = (x: number, y: number) => {
    if (!map || !item || busy) return;
    const obj = { ...item, x, y };
    const problem = objectPlacementError(map, obj);
    if (problem) {
      setError(problem);
      return;
    }
    edit({ ...map, objects: map.objects.map((o) => (o.id === obj.id ? obj : o)) });
  };
  const rotate = (dir: WorkstationDirection) => {
    if (!map || !item || busy) return;
    const obj = orientWorkstation(item, dir);
    const problem = objectPlacementError(map, obj);
    if (problem) {
      setError(problem);
      return;
    }
    edit({ ...map, objects: map.objects.map((o) => (o.id === obj.id ? obj : o)) });
  };
  return (
    <section className="furniture-editor">
      <div className="gallery-heading">
        <div>
          <span className="eyebrow">MEETOPIA SPACE BUILDER</span>
          <h3>{t("editor.title")}</h3>
          <p>{t("editor.help")}</p>
        </div>
        <button
          className="btn secondary small"
          disabled={busy || !history.length}
          onClick={() => {
            setMap(history.at(-1)!);
            setHistory((h) => h.slice(0, -1));
          }}
        >
          {t("editor.undo")}
        </button>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {t(error)}{" "}
          {!map && (
            <button className="btn small" onClick={load}>
              {t("editor.retry")}
            </button>
          )}
        </p>
      )}
      {!map ? (
        <p role="status">{t("editor.loading")}</p>
      ) : (
        <>
          <p className="hint">{t("editor.catalogHint", { n: CATALOG.length })}</p>
          <div className="editor-catalog" aria-label={t("editor.add")}>
            {CATALOG.map(([kind, w, h]) => (
              <button
                className="chip"
                key={kind}
                disabled={busy}
                onClick={() => {
                  const keys: Partial<Record<ObjectKind, string>> = {
                    gamingDesk: "gamingPc",
                    counter: "kitchen",
                    table: "meetingTable",
                  };
                  const obj: MapObject = {
                    id: crypto.randomUUID(),
                    kind,
                    x: Math.floor(map.spawn.x) + 2,
                    y: Math.floor(map.spawn.y),
                    w,
                    h,
                    solid: !["chair", "sofa", "beanbag", "bed", "rug", "parasol", "pergola"].includes(kind),
                    label: `object.${keys[kind] ?? kind}`,
                    actions: INTERACTIONS[kind],
                    ...(kind === "chair" ? { facing: "up" as const } : {}),
                  };
                  // Barang baru diletakkan di tempat kosong terdekat dari tengah map (mudah terlihat),
                  // bukan di pojok kiri atas tempat ia bisa tertutup perabot lain.
                  const cx = map.width / 2 - w / 2,
                    cy = map.height / 2 - h / 2;
                  const spots: Array<[number, number]> = [];
                  for (let y = 1; y < map.height; y++) for (let x = 1; x < map.width; x++) spots.push([x, y]);
                  spots.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
                  let found = false;
                  for (const [x, y] of spots) {
                    obj.x = x;
                    obj.y = y;
                    if (!objectPlacementError(map, obj)) {
                      found = true;
                      break;
                    }
                  }
                  if (!found) {
                    setError("editor.noSpace");
                    return;
                  }
                  edit({ ...map, objects: [...map.objects, obj] });
                  setSelected(obj.id);
                }}
              >
                <Icon name="plus" size={12} />
                {t(`editor.item.${kind}`)}
              </button>
            ))}
          </div>
          <label className="field">
            {t("editor.select")}
            <select
              className="input"
              aria-label={t("editor.select")}
              value={selected ?? ""}
              disabled={busy}
              onChange={(e) => setSelected(e.target.value || null)}
            >
              <option value="">{t("editor.none")}</option>
              {map.objects.map((o, i) => (
                <option key={o.id} value={o.id}>
                  {itemName(o.kind)} {i + 1} · {o.x},{o.y}
                </option>
              ))}
            </select>
          </label>
          <canvas
            ref={canvas}
            tabIndex={0}
            className="editor-canvas"
            aria-label={t("editor.canvas")}
            onKeyDown={(e) => {
              if (busy) return;
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && history.length) {
                e.preventDefault();
                e.stopPropagation();
                setMap(history.at(-1)!);
                setHistory((h) => h.slice(0, -1));
                return;
              }
              if (!item) return;
              const d: Record<string, [number, number]> = {
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
              };
              if (d[e.key]) {
                e.preventDefault();
                e.stopPropagation();
                move(item.x + d[e.key][0], item.y + d[e.key][1]);
              } else if (e.key.toLowerCase() === "r") {
                e.preventDefault();
                e.stopPropagation();
                const dirs = ["up", "right", "down", "left"] as const;
                rotate(dirs[(dirs.indexOf(workstationFacing(map, item)) + 1) % 4]);
              } else if (e.key === "Delete") {
                e.preventDefault();
                e.stopPropagation();
                edit({ ...map, objects: map.objects.filter((o) => o.id !== item.id) });
                setSelected(null);
              }
            }}
            onPointerDown={(e) => {
              if (busy) return;
              e.currentTarget.focus();
              const p = point(e);
              const o = [...map.objects]
                .sort((a, b) => b.y + b.h - (a.y + a.h))
                .find((o) => {
                  const r =
                    o.kind === "rug"
                      ? { x: o.x * TILE, y: o.y * TILE, w: o.w * TILE, h: o.h * TILE }
                      : furnitureRect(o, map);
                  return (
                    p.x * TILE >= r.x && p.x * TILE < r.x + r.w && p.y * TILE >= r.y && p.y * TILE < r.y + r.h
                  );
                });
              setSelected(o?.id ?? null);
              if (o) {
                drag.current = { id: o.id, dx: p.x - o.x, dy: p.y - o.y, start: map };
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const p = point(e);
              const x = Math.round(p.x - d.dx),
                y = Math.round(p.y - d.dy);
              setMap({
                ...d.start,
                objects: d.start.objects.map((o) =>
                  o.id === d.id
                    ? {
                        ...o,
                        x: Math.max(1, Math.min(d.start.width - o.w - 1, x)),
                        y: Math.max(1, Math.min(d.start.height - o.h - 1, y)),
                      }
                    : o,
                ),
              });
            }}
            onPointerUp={() => {
              const d = drag.current;
              if (!d) return;
              drag.current = null;
              const o = map.objects.find((o) => o.id === d.id)!;
              const problem = objectPlacementError(map, o);
              if (problem) {
                setMap(d.start);
                setError(problem);
              } else setHistory((h) => [...h.slice(-29), d.start]);
            }}
            onPointerCancel={() => {
              if (drag.current) setMap(drag.current.start);
              drag.current = null;
            }}
          />
          {item && (
            <div className="editor-inspector">
              <b>{itemName(item.kind)}</b>
              <span className="hint">
                X {item.x} · Y {item.y}
              </span>
              <label>
                X{" "}
                <input
                  className="input"
                  type="number"
                  aria-label={t("editor.posX")}
                  min={1}
                  max={map.width - item.w - 1}
                  disabled={busy}
                  value={item.x}
                  onChange={(e) => move(Number(e.target.value), item.y)}
                />
              </label>
              <label>
                Y{" "}
                <input
                  className="input"
                  type="number"
                  aria-label={t("editor.posY")}
                  min={1}
                  max={map.height - item.h - 1}
                  disabled={busy}
                  value={item.y}
                  onChange={(e) => move(item.x, Number(e.target.value))}
                />
              </label>
              <label>
                {t("editor.facing")}{" "}
                <select
                  className="input"
                  disabled={busy}
                  value={workstationFacing(map, item)}
                  onChange={(e) => rotate(e.target.value as WorkstationDirection)}
                >
                  <option value="up">↑ {t("editor.face.up")}</option>
                  <option value="down">↓ {t("editor.face.down")}</option>
                  <option value="left">← {t("editor.face.left")}</option>
                  <option value="right">→ {t("editor.face.right")}</option>
                </select>
              </label>
              <button
                className="btn secondary small"
                disabled={busy}
                onClick={() => {
                  if (item.kind === "desk") {
                    const dirs = ["up", "right", "down", "left"] as const;
                    rotate(dirs[(dirs.indexOf(workstationFacing(map, item)) + 1) % 4]);
                    return;
                  }
                  const o = { ...item, w: item.h, h: item.w };
                  const problem = objectPlacementError(map, o);
                  if (problem) {
                    setError(problem);
                    return;
                  }
                  edit({ ...map, objects: map.objects.map((v) => (v.id === o.id ? o : v)) });
                }}
              >
                {t("editor.rotateFootprint")}
              </button>
              <button
                className="btn danger small"
                disabled={busy}
                onClick={() => {
                  edit({ ...map, objects: map.objects.filter((o) => o.id !== item.id) });
                  setSelected(null);
                }}
              >
                {t("editor.delete")}
              </button>
            </div>
          )}
          <div className="save-bar" data-visible="true">
            <span className="grow" role="status">
              {changed ? t("editor.unsaved") : t("editor.saved")}
            </span>
            <button
              className="btn secondary small"
              disabled={!changed || busy}
              onClick={() => {
                setMap(saved);
                setHistory([]);
              }}
            >
              {t("editor.discard")}
            </button>
            <button
              className="btn small"
              disabled={!changed || busy}
              onClick={async () => {
                const problem = layoutError(map);
                if (problem) {
                  setError(problem);
                  return;
                }
                setBusy(true);
                setError("");
                try {
                  const r = await api<{ map: MapData }>(`/api/groups/${groupId}/map`, {
                    method: "PATCH",
                    body: { objects: map.objects, expectedVersion: saved!.version },
                  });
                  setMap(r.map);
                  setSaved(r.map);
                  setHistory([]);
                  onSaved();
                } catch {
                  setError(t("editor.saveFailed"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? t("editor.saving") : t("editor.save")}
            </button>
            <button
              className="btn ghost small"
              onClick={() => {
                if (!changed || confirm(t("editor.reloadConfirm"))) load();
              }}
            >
              {t("editor.reload")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
