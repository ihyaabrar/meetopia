"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RoomClient, RoomSnapshot } from "@/client/roomClient";
import type { MediaManager, RemoteMedia } from "@/client/media";
import { PALETTE, drawAvatar, renderStaticMap } from "@/client/draw";
import { useT } from "@/i18n/client";
import { useToast } from "@/components/Toasts";
import { Icon } from "@/components/Icon";
import {
  INTERACT_RANGE,
  TILE,
  buildWalkable,
  distanceToObject,
  privateZoneAt,
  type MapObject,
  type ObjectAction,
  type Zone,
} from "@/shared/map";
import { findPath, nearestFree, type Point } from "@/shared/pathfinding";
import { STATUSES, type PresenceStatus } from "@/shared/proximity";
import type { Direction, Presence } from "@/shared/protocol";

const SPEED = 4.2; // tile per detik
const SEND_INTERVAL = 90;

interface Props {
  room: RoomClient;
  media: MediaManager;
  snap: RoomSnapshot;
  onAction: (action: ObjectAction, obj: MapObject) => void;
  onPeerClick: (peer: Presence) => void;
  onOpenDevices: () => void;
  onOpenNotes: () => void;
  onHelp: () => void;
  /** Dipanggil komponen induk untuk meminta avatar berjalan ke titik/orang tertentu. */
  registerWalkTo: (fn: (p: Point) => void) => void;
}

interface Display {
  x: number;
  y: number;
  phase: number;
}

function dirFrom(dx: number, dy: number, fallback: Direction): Direction {
  if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) return fallback;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

export function RoomStage({
  room,
  media,
  snap,
  onAction,
  onPeerClick,
  onOpenDevices,
  onOpenNotes,
  onHelp,
  registerWalkTo,
}: Props) {
  const t = useT();
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef(snap);
  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);
  const map = snap.map!;
  const self = snap.selfId ? snap.peers.get(snap.selfId) : undefined;

  const grid = useMemo(() => buildWalkable(map), [map]);
  const bg = useMemo(
    () => (typeof document === "undefined" ? null : renderStaticMap(map, (k) => t(k))),
    [map, t],
  );

  const state = useRef({
    path: [] as Point[],
    lastSend: 0,
    display: new Map<string, Display>(),
    zoom: 0,
    pendingZone: null as null | { zone: Zone; target: Point },
    onArrive: null as null | (() => void),
    pointer: null as null | { x: number; y: number; id: number },
    camera: { x: 0, y: 0, scale: 1 },
  });
  const [hint, setHint] = useState<{ obj: MapObject; pinned: boolean } | null>(null);
  const hintObjRef = useRef<MapObject | null>(null);
  useEffect(() => {
    hintObjRef.current = hint?.obj ?? null;
  }, [hint]);
  /** Dipanggil saat avatar sampai di tujuan; diisi di efek di bawah (menghindari ketergantungan melingkar). */
  const arriveRef = useRef<() => void>(() => {});

  const remote = useSyncExternalStore(media.subscribe, media.getSnapshot, () => [] as RemoteMedia[]);

  // ------------------------------------------------------------ gerak
  const zoneOccupied = useCallback(
    (zone: Zone) => {
      const s = snapRef.current;
      for (const p of s.peers.values())
        if (p.id !== s.selfId && privateZoneAt(map, p.x, p.y)?.id === zone.id) return true;
      return false;
    },
    [map],
  );

  const walkTo = useCallback(
    (target: Point, onArrive?: () => void) => {
      const me = room.self;
      if (!me) return;
      const goal = nearestFree(grid, target);
      if (!goal) return;
      let path = findPath(grid, { x: me.x, y: me.y }, goal) ?? [];
      state.current.pendingZone = null;
      // Ruang privat yang terisi: berhenti di depan pintu lalu tawarkan "ketuk" (FR-31).
      for (let i = 0; i < path.length; i++) {
        const z = privateZoneAt(map, path[i].x + 0.5, path[i].y + 0.5);
        if (z && room.self?.allowedZone !== z.id && zoneOccupied(z)) {
          path = path.slice(0, i);
          state.current.pendingZone = { zone: z, target: goal };
          onArrive = undefined;
          break;
        }
      }
      state.current.path = path;
      state.current.onArrive = onArrive ?? null;
      if (me.sitting) room.send({ t: "sit", sitting: false });
      if (!path.length) arriveRef.current();
    },
    [grid, map, room, zoneOccupied],
  );

  const arrive = useCallback(() => {
    const st = state.current;
    const cb = st.onArrive;
    st.onArrive = null;
    cb?.();
    if (st.pendingZone) {
      const { zone, target } = st.pendingZone;
      st.pendingZone = null;
      toast({
        text: t("knock.zoneBusy", { zone: t(zone.label) }),
        action: {
          label: t("knock.knock"),
          run: () => {
            room.send({ t: "knock", zoneId: zone.id });
            toast({ text: t("knock.sent") });
            const off = room.on("knockResult", (r) => {
              if (r.zoneId !== zone.id) return;
              off();
              if (r.accept) {
                room.updateSelf({ allowedZone: zone.id });
                walkTo(target);
              }
            });
          },
        },
      });
    }
  }, [room, t, toast, walkTo]);
  useEffect(() => {
    arriveRef.current = arrive;
  }, [arrive]);

  useEffect(() => {
    registerWalkTo((p) => walkTo(p));
  }, [registerWalkTo, walkTo]);

  useEffect(() => {
    const off1 = room.on("moveRejected", () => {
      state.current.path = [];
      toast({ text: t("knock.rejectedMove"), kind: "error" });
    });
    return off1;
  }, [room, t, toast]);

  // ------------------------------------------------------------ loop render
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    let hintCheck = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const st = state.current;
      const s = snapRef.current;
      const me = s.selfId ? s.peers.get(s.selfId) : undefined;

      // Gerak diri sendiri menyusuri jalur
      if (me && st.path.length) {
        const n = st.path[0];
        const tx = n.x + 0.5;
        const ty = n.y + 0.5;
        const dx = tx - me.x;
        const dy = ty - me.y;
        const d = Math.hypot(dx, dy);
        const step = SPEED * dt;
        let nx = me.x;
        let ny = me.y;
        if (d <= step) {
          nx = tx;
          ny = ty;
          st.path.shift();
        } else {
          nx += (dx / d) * step;
          ny += (dy / d) * step;
        }
        const moving = st.path.length > 0;
        const dir = dirFrom(dx, dy, me.dir);
        room.updateSelf({ x: nx, y: ny, dir, moving, sitting: false });
        if (now - st.lastSend > SEND_INTERVAL || !moving) {
          st.lastSend = now;
          room.send({ t: "move", x: nx, y: ny, dir, moving });
        }
        if (!moving) arriveRef.current();
      }

      // Ukuran kanvas & kamera
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      if (!st.zoom) st.zoom = Math.max(0.6, Math.min(1.6, w / (24 * TILE)));
      const scale = st.zoom * dpr;
      const meD = me ?? { x: map.spawn.x, y: map.spawn.y };
      const worldW = map.width * TILE;
      const worldH = map.height * TILE;
      let camX = meD.x * TILE - w / 2 / st.zoom;
      let camY = meD.y * TILE - h / 2 / st.zoom;
      camX =
        worldW * st.zoom < w ? (worldW - w / st.zoom) / 2 : Math.max(0, Math.min(worldW - w / st.zoom, camX));
      camY =
        worldH * st.zoom < h ? (worldH - h / st.zoom) / 2 : Math.max(0, Math.min(worldH - h / st.zoom, camY));
      st.camera = { x: camX, y: camY, scale: st.zoom };

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#cdd8c9";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
      if (bg) ctx.drawImage(bg, 0, 0);

      // Lingkaran radius suara di sekitar avatar saat bergerak (prinsip UX "aturan jarak terlihat")
      if (me && (me.moving || st.path.length) && !privateZoneAt(map, me.x, me.y)) {
        ctx.beginPath();
        ctx.arc(me.x * TILE, me.y * TILE, map.audio.radius * TILE, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(63,154,85,0.08)";
        ctx.fill();
        ctx.setLineDash([10, 8]);
        ctx.strokeStyle = "rgba(63,154,85,0.55)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Titik tujuan
      if (st.path.length) {
        const g = st.path[st.path.length - 1];
        ctx.strokeStyle = PALETTE.green;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse((g.x + 0.5) * TILE, (g.y + 0.5) * TILE + 6, 9, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Objek yang sedang disorot
      const ho = hintObjRef.current;
      if (ho) {
        ctx.strokeStyle = "rgba(63,154,85,0.9)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(ho.x * TILE, ho.y * TILE, ho.w * TILE, ho.h * TILE, 8);
        ctx.stroke();
      }

      // Avatar (interpolasi untuk orang lain), urut dari atas ke bawah
      const people = [...s.peers.values()];
      for (const p of people) {
        let d = st.display.get(p.id);
        if (!d) {
          d = { x: p.x, y: p.y, phase: 0 };
          st.display.set(p.id, d);
        }
        if (p.id === s.selfId) {
          d.x = p.x;
          d.y = p.y;
        } else {
          const k = 1 - Math.pow(0.0005, dt);
          d.x += (p.x - d.x) * k;
          d.y += (p.y - d.y) * k;
          if (Math.hypot(p.x - d.x, p.y - d.y) > 6) {
            d.x = p.x;
            d.y = p.y;
          }
        }
        const walking = p.moving || Math.hypot(p.x - d.x, p.y - d.y) > 0.05;
        d.phase = walking ? d.phase + dt * 12 : 0;
      }
      for (const id of st.display.keys()) if (!s.peers.has(id)) st.display.delete(id);
      people.sort((a, b) => st.display.get(a.id)!.y - st.display.get(b.id)!.y);

      for (const p of people) {
        const d = st.display.get(p.id)!;
        const px = d.x * TILE;
        const py = d.y * TILE + 8;
        if (p.status === "busy") {
          ctx.strokeStyle = "rgba(210,85,74,0.8)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(px, py, 13, 5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = p.status === "away" ? 0.6 : 1;
        drawAvatar(ctx, p.avatar, px, py, 1, { dir: p.dir, walk: d.phase, sitting: p.sitting });
        ctx.globalAlpha = 1;
        // Label nama + status
        const label = p.name;
        ctx.font = "600 11px Outfit, system-ui, sans-serif";
        const tw = ctx.measureText(label).width;
        const lx = px;
        const ly = py - 48;
        const bw = tw + 30;
        ctx.fillStyle = p.id === s.selfId ? "rgba(27,58,42,0.92)" : "rgba(255,255,255,0.94)";
        ctx.beginPath();
        ctx.roundRect(lx - bw / 2, ly - 9, bw, 18, 9);
        ctx.fill();
        const statusColor = { active: "#4fae63", busy: "#d2554a", meeting: "#8a63c9", away: "#e0a33a" }[
          p.status
        ];
        ctx.fillStyle = statusColor;
        ctx.beginPath();
        ctx.arc(lx - bw / 2 + 9, ly, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.id === s.selfId ? "#fff" : PALETTE.ink;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, lx - bw / 2 + 16, ly + 0.5);
        // Status mikrofon (FR-22: terlihat oleh orang lain)
        ctx.fillStyle = p.media.mic ? "#4fae63" : "#d2554a";
        ctx.beginPath();
        ctx.arc(lx + bw / 2 - 7, ly, 3, 0, Math.PI * 2);
        ctx.fill();
        if (p.media.screen) {
          ctx.font = "13px system-ui";
          ctx.fillText("🖥️", lx + bw / 2 + 2, ly);
        }
      }

      // Posisi popup petunjuk objek
      const hel = hintRef.current;
      if (hel && ho) {
        hel.style.left = `${(ho.x + ho.w / 2) * TILE * st.zoom - camX * st.zoom}px`;
        hel.style.top = `${ho.y * TILE * st.zoom - camY * st.zoom}px`;
      }

      // Petunjuk otomatis saat avatar dalam jangkauan objek (FR-74)
      if (me && now - hintCheck > 200) {
        hintCheck = now;
        let best: MapObject | null = null;
        let bestD = INTERACT_RANGE;
        for (const o of map.objects) {
          if (!o.label) continue;
          const dd = distanceToObject(o, me.x, me.y);
          if (dd < bestD) {
            bestD = dd;
            best = o;
          }
        }
        setHint((cur) => {
          if (cur?.pinned) {
            if (me.moving || st.path.length) return cur;
            const stillNear = distanceToObject(cur.obj, me.x, me.y) < INTERACT_RANGE * 2.5;
            return stillNear ? cur : best ? { obj: best, pinned: false } : null;
          }
          if (best?.id === cur?.obj.id) return cur;
          return best ? { obj: best, pinned: false } : null;
        });
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [bg, map, room]);

  // ------------------------------------------------------------ input
  const toWorld = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const cam = state.current.camera;
    return {
      x: (clientX - r.left) / cam.scale / TILE + cam.x / TILE,
      y: (clientY - r.top) / cam.scale / TILE + cam.y / TILE,
    };
  };

  const onTap = (wx: number, wy: number) => {
    const s = snapRef.current;
    // Klik avatar orang lain
    for (const p of s.peers.values()) {
      if (p.id === s.selfId) continue;
      const d = state.current.display.get(p.id) ?? p;
      if (Math.abs(wx - d.x) < 0.6 && wy < d.y + 0.4 && wy > d.y - 1.6) return onPeerClick(p);
    }
    // Klik objek interaktif: tampilkan petunjuk dan berjalan mendekat
    const obj = map.objects.find(
      (o) => o.label && wx >= o.x && wx < o.x + o.w && wy >= o.y && wy < o.y + o.h,
    );
    if (obj) {
      setHint({ obj, pinned: true });
      const me = room.self;
      if (me && distanceToObject(obj, me.x, me.y) > INTERACT_RANGE) {
        walkTo({ x: obj.x + obj.w / 2, y: obj.y + obj.h + 0.2 });
      }
      return;
    }
    setHint(null);
    walkTo({ x: wx, y: wy });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    state.current.pointer = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = state.current.pointer;
    state.current.pointer = null;
    if (!p || p.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) return;
    const w = toWorld(e.clientX, e.clientY);
    onTap(w.x, w.y);
  };
  const zoomBy = (f: number) => {
    state.current.zoom = Math.max(0.45, Math.min(2.4, (state.current.zoom || 1) * f));
  };

  const runAction = (action: ObjectAction, obj: MapObject) => {
    if (action === "sit") {
      walkTo({ x: obj.x + Math.floor(obj.w / 2), y: obj.y }, () => {
        room.send({ t: "sit", sitting: true });
        room.updateSelf({ sitting: true });
        toast({ text: t("action.satDown") });
      });
      return;
    }
    onAction(action, obj);
  };

  // ------------------------------------------------------------ kontrol media
  const [busyMedia, setBusyMedia] = useState(false);
  const toggle = async (kind: "mic" | "cam" | "screen") => {
    if (!self || busyMedia) return;
    setBusyMedia(true);
    try {
      if (kind === "mic") await media.setMic(!self.media.mic);
      if (kind === "cam") await media.setCam(!self.media.cam);
      if (kind === "screen") await media.setScreen(!self.media.screen);
    } finally {
      setBusyMedia(false);
    }
  };

  const setStatus = (status: PresenceStatus) => {
    room.send({ t: "status", status, manual: true });
    room.updateSelf({ status, manualStatus: true });
  };

  const goToZone = (zoneId: string) => {
    const z = map.zones.find((zz) => zz.id === zoneId);
    if (z) walkTo({ x: z.x + Math.floor(z.w / 2), y: z.y + Math.floor(z.h / 2) });
  };

  const presenter = remote.find((r) => r.screen && snap.peers.get(r.peerId)?.media.screen);
  const presenterName = presenter ? snap.peers.get(presenter.peerId)?.name : null;
  const videoPeers = remote.filter((r) => r.cam && snap.peers.get(r.peerId)?.media.cam).slice(0, 8);
  const zoneHere = self ? privateZoneAt(map, self.x, self.y) : null;
  const selfCamOn = !!self?.media.cam;
  const selfCam = useMemo(
    () => (selfCamOn && media.camTrack ? new MediaStream([media.camTrack]) : null),
    [selfCamOn, media.camTrack],
  );

  return (
    <div className="stage">
      <canvas
        ref={canvasRef}
        className="map"
        tabIndex={0}
        aria-label={t("room.canvasLabel")}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.1 : 0.9)}
      />

      <div className="overlay-tl">
        {snap.conn !== "open" && <span className="pill warn">⟳ {t(`conn.${snap.conn}`)}</span>}
        {zoneHere && <span className="pill">🔒 {t("room.inPrivate", { zone: t(zoneHere.label) })}</span>}
        {self?.media.screen && (
          <span className="pill" style={{ background: "#ffe3df", color: "#8a2a20" }}>
            🖥️ {t("media.youPresent")}
            <button className="btn small danger" onClick={() => void media.setScreen(false)}>
              {t("media.stop")}
            </button>
          </span>
        )}
      </div>

      <div className="zoom">
        <button onClick={() => zoomBy(1.2)} aria-label={t("room.zoomIn")}>
          +
        </button>
        <button onClick={() => zoomBy(1 / 1.2)} aria-label={t("room.zoomOut")}>
          −
        </button>
      </div>

      {(videoPeers.length > 0 || self?.media.cam) && (
        <div className="videos">
          {selfCam && <VideoTile stream={selfCam} name={t("media.you")} muted mirror />}
          {videoPeers.map((r) => (
            <VideoTile key={r.peerId} stream={r.cam!} name={snap.peers.get(r.peerId)?.name ?? ""} />
          ))}
        </div>
      )}

      {presenter && (
        <div className="screen-view">
          <div className="bar">
            🖥️ <b>{t("media.presenting", { name: presenterName ?? "" })}</b>
          </div>
          <VideoEl stream={presenter.screen!} />
        </div>
      )}

      {hint && (
        <div ref={hintRef} className="hint-pop" role="dialog" aria-label={t(hint.obj.label!)}>
          <div className="title">
            ✨ {t(hint.obj.label!)}
            <span className="spacer" />
            <button
              className="icon-btn"
              style={{ width: 24, height: 24 }}
              onClick={() => setHint(null)}
              aria-label={t("common.close")}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
          <div className="actions">
            {hint.obj.actions?.map((a) => (
              <button key={a} className="btn small" onClick={() => runAction(a, hint.obj)}>
                {t(`action.${a}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="controls" role="toolbar" aria-label={t("room.controls")}>
        <button
          className={`ctl big ${self?.media.mic ? "on" : "off"}`}
          onClick={() => void toggle("mic")}
          aria-pressed={!!self?.media.mic}
          aria-label={self?.media.mic ? t("media.micOn") : t("media.micOff")}
          title={self?.media.mic ? t("media.micOn") : t("media.micOff")}
        >
          <Icon name={self?.media.mic ? "mic" : "micOff"} size={22} />
          <span className="lbl">{self?.media.mic ? t("media.mute") : t("media.unmute")}</span>
        </button>
        <button
          className={`ctl ${self?.media.cam ? "on" : ""}`}
          onClick={() => void toggle("cam")}
          aria-pressed={!!self?.media.cam}
          aria-label={t("media.camera")}
        >
          <Icon name={self?.media.cam ? "cam" : "camOff"} />
        </button>
        <button
          className={`ctl ${self?.media.screen ? "on" : ""}`}
          onClick={() => void toggle("screen")}
          aria-pressed={!!self?.media.screen}
          aria-label={self?.media.screen ? t("media.stopShare") : t("media.share")}
        >
          <Icon name="screen" />
          <span className="lbl">{self?.media.screen ? t("media.stopShare") : t("media.share")}</span>
        </button>
        <span className="ctl-sep" />
        <label className="ctl">
          <span
            className={`status-dot s-${self?.status ?? "active"}`}
            style={{ position: "static", border: "none" }}
          />
          <span className="sr-only">{t("status.label")}</span>
          <select
            value={self?.status ?? "active"}
            onChange={(e) => setStatus(e.target.value as PresenceStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="ctl hide-sm">
          <Icon name="pin" />
          <span className="sr-only">{t("room.goTo")}</span>
          <select value="" onChange={(e) => e.target.value && goToZone(e.target.value)}>
            <option value="">{t("room.goTo")}</option>
            {map.zones.map((z) => (
              <option key={z.id} value={z.id}>
                {t(z.label)}
              </option>
            ))}
          </select>
        </label>
        <button className="ctl" onClick={onOpenNotes} aria-label={t("notes.title")} title={t("notes.title")}>
          <Icon name="notes" />
        </button>
        <button
          className="ctl"
          onClick={onOpenDevices}
          aria-label={t("devices.title")}
          title={t("devices.title")}
        >
          <Icon name="settings" />
        </button>
        <button className="ctl hide-sm" onClick={onHelp} aria-label={t("tips.title")} title={t("tips.title")}>
          <Icon name="help" />
        </button>
      </div>
    </div>
  );
}

function VideoEl({ stream, muted, mirror }: { stream: MediaStream; muted?: boolean; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    />
  );
}

function VideoTile({
  stream,
  name,
  muted,
  mirror,
}: {
  stream: MediaStream;
  name: string;
  muted?: boolean;
  mirror?: boolean;
}) {
  return (
    <div className="video-tile">
      <VideoEl stream={stream} muted={muted} mirror={mirror} />
      <span className="name">{name}</span>
    </div>
  );
}
