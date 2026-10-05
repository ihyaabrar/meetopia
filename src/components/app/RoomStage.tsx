"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RoomClient, RoomSnapshot } from "@/client/roomClient";
import type { MediaManager, RemoteMedia } from "@/client/media";
import { Scene, type PersonView } from "@/client/scene";
import { hashStr } from "@/client/art/common";
import { useT } from "@/i18n/client";
import { useToast } from "@/components/Toasts";
import { Icon } from "@/components/Icon";
import {
  INTERACT_RANGE,
  TILE,
  buildWalkable,
  distanceToObject,
  privateZoneAt,
  zoneAt,
  type MapObject,
  type ObjectAction,
  type Zone,
} from "@/shared/map";
import { findPath, nearestFree, type Point } from "@/shared/pathfinding";
import { STATUSES, audiblePeers, type PresenceStatus } from "@/shared/proximity";
import { EMOTES, type Direction, type Presence } from "@/shared/protocol";
import { Minimap } from "./Minimap";

const SPEED = 4.2; // tile per detik
const SEND_INTERVAL = 90;
const now = () => performance.now() / 1000;

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
  lastPuff: number;
  level: number;
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
  const scene = useMemo(
    () => (typeof document === "undefined" ? null : new Scene(map, (k) => t(k))),
    [map, t],
  );

  const state = useRef({
    path: [] as Point[],
    target: null as Point | null,
    lastSend: 0,
    display: new Map<string, Display>(),
    zoom: 0,
    pendingZone: null as null | { zone: Zone; target: Point },
    onArrive: null as null | (() => void),
    pointer: null as null | { x: number; y: number; id: number },
    hover: null as null | Point,
    camera: { x: 0, y: 0, zoom: 1 },
  });
  const [hint, setHint] = useState<{ obj: MapObject; pinned: boolean } | null>(null);
  const hintObjRef = useRef<MapObject | null>(null);
  useEffect(() => {
    hintObjRef.current = hint?.obj ?? null;
  }, [hint]);
  const arriveRef = useRef<() => void>(() => {});
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [nearby, setNearby] = useState(0);

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
      state.current.target = path.length ? path[path.length - 1] : null;
      state.current.onArrive = onArrive ?? null;
      if (me.sitting) room.send({ t: "sit", sitting: false });
      if (!path.length) arriveRef.current();
    },
    [grid, map, room, zoneOccupied],
  );

  const arrive = useCallback(() => {
    const st = state.current;
    st.target = null;
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
    const offs = [
      room.on("moveRejected", () => {
        state.current.path = [];
        state.current.target = null;
        toast({ text: t("knock.rejectedMove"), kind: "error" });
      }),
      room.on("emote", (e) => scene?.emote(e.id, e.emoji, now())),
      room.on("chat", (m) => {
        if (m.kind === "nearby") scene?.bubble(m.senderId, m.body, now());
      }),
    ];
    return () => offs.forEach((o) => o());
  }, [room, scene, t, toast]);

  // ------------------------------------------------------------ loop permainan
  useEffect(() => {
    if (!scene) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    let slowTick = 0;

    const frame = (nowMs: number) => {
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      const time = nowMs / 1000;
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
        if (nowMs - st.lastSend > SEND_INTERVAL || !moving) {
          st.lastSend = nowMs;
          room.send({ t: "move", x: nx, y: ny, dir, moving });
        }
        if (!moving) arriveRef.current();
      }

      // Ukuran kanvas & kamera (mengikuti diri sendiri dengan halus)
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      if (!st.zoom)
        st.zoom = w < 600 ? Math.max(0.8, w / (13 * TILE)) : Math.max(0.8, Math.min(1.7, w / (22 * TILE)));
      const z = st.zoom;
      const worldW = map.width * TILE;
      const worldH = map.height * TILE;
      const meD = me ?? { x: map.spawn.x, y: map.spawn.y };
      let camX = meD.x * TILE - w / 2 / z;
      let camY = meD.y * TILE - h / 2 / z;
      camX = worldW * z < w ? (worldW - w / z) / 2 : Math.max(-TILE, Math.min(worldW - w / z + TILE, camX));
      camY = worldH * z < h ? (worldH - h / z) / 2 : Math.max(-TILE, Math.min(worldH - h / z + TILE, camY));
      const k = st.camera.x === 0 && st.camera.y === 0 ? 1 : 1 - Math.pow(0.001, dt);
      st.camera = {
        x: st.camera.x + (camX - st.camera.x) * k,
        y: st.camera.y + (camY - st.camera.y) * k,
        zoom: z,
      };

      // Posisi tampilan (interpolasi untuk orang lain), animasi, debu langkah, level suara
      const people: PersonView[] = [];
      let selfView: PersonView | null = null;
      for (const p of s.peers.values()) {
        let d = st.display.get(p.id);
        if (!d) {
          d = { x: p.x, y: p.y, phase: 0, lastPuff: 0, level: 0 };
          st.display.set(p.id, d);
        }
        if (p.id === s.selfId) {
          d.x = p.x;
          d.y = p.y;
        } else {
          const kk = 1 - Math.pow(0.0005, dt);
          d.x += (p.x - d.x) * kk;
          d.y += (p.y - d.y) * kk;
          if (Math.hypot(p.x - d.x, p.y - d.y) > 6) {
            d.x = p.x;
            d.y = p.y;
          }
        }
        const walking =
          (p.id === s.selfId ? st.path.length > 0 : p.moving) || Math.hypot(p.x - d.x, p.y - d.y) > 0.05;
        d.phase = walking ? d.phase + dt * 13 : 0;
        if (walking && time - d.lastPuff > 0.22) {
          d.lastPuff = time;
          scene.puff(d.x, d.y, time);
        }
        const lv = p.media.mic ? media.level(p.id === s.selfId ? "self" : p.id) : 0;
        d.level = Math.max(lv, d.level * 0.85);
        const view: PersonView = {
          p,
          x: d.x,
          y: d.y,
          phase: d.phase,
          speaking: d.level,
          isSelf: p.id === s.selfId,
          seed: hashStr(p.id),
        };
        people.push(view);
        if (view.isSelf) selfView = view;
      }
      for (const id of st.display.keys()) if (!s.peers.has(id)) st.display.delete(id);

      // Garis ke orang yang bisa didengar (bila ada yang menyalakan mic)
      const links: Array<{ x: number; y: number; volume: number }> = [];
      let near = 0;
      if (me) {
        const others = [...s.peers.values()].filter((p) => p.id !== me.id);
        for (const a of audiblePeers(map, me, others)) {
          near++;
          if (!me.media.mic && !a.peer.media.mic) continue;
          const d = st.display.get(a.peer.id);
          if (d) links.push({ x: d.x, y: d.y, volume: a.volume });
        }
      }

      scene.draw(ctx, {
        w,
        h,
        dpr,
        cam: st.camera,
        time,
        people,
        self: selfView,
        target: st.target,
        hoverTile: st.hover,
        focusObj: hintObjRef.current,
        links,
        privateZone: me ? privateZoneAt(map, me.x, me.y) : null,
        showRadius: !!me && (me.moving || st.path.length > 0),
      });

      // Posisi popup petunjuk objek
      const ho = hintObjRef.current;
      const hel = hintRef.current;
      if (hel && ho) {
        hel.style.left = `${((ho.x + ho.w / 2) * TILE - st.camera.x) * z}px`;
        hel.style.top = `${(ho.y * TILE - 18 - st.camera.y) * z}px`;
      }

      // Tiap 200 ms: petunjuk otomatis (FR-74) dan jumlah orang di dekat
      if (me && nowMs - slowTick > 200) {
        slowTick = nowMs;
        setNearby((n) => (n === near ? n : near));
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
  }, [scene, map, room, media]);

  // ------------------------------------------------------------ input
  const toWorld = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const cam = state.current.camera;
    return {
      x: ((clientX - r.left) / cam.zoom + cam.x) / TILE,
      y: ((clientY - r.top) / cam.zoom + cam.y) / TILE,
    };
  };

  const peerAt = (wx: number, wy: number) => {
    const s = snapRef.current;
    for (const p of s.peers.values()) {
      if (p.id === s.selfId) continue;
      const d = state.current.display.get(p.id) ?? p;
      if (Math.abs(wx - d.x) < 0.6 && wy < d.y + 0.5 && wy > d.y - 1.7) return p;
    }
    return null;
  };
  const objectAt = (wx: number, wy: number) =>
    map.objects.find(
      (o) =>
        o.label && wx >= o.x && wx < o.x + o.w && wy >= o.y - (o.kind === "desk" ? 0.6 : 0) && wy < o.y + o.h,
    );

  const onTap = (wx: number, wy: number) => {
    setEmoteOpen(false);
    const peer = peerAt(wx, wy);
    if (peer) return onPeerClick(peer);
    // Klik objek interaktif: tampilkan petunjuk dan berjalan mendekat
    const obj = objectAt(wx, wy);
    if (obj) {
      setHint({ obj, pinned: true });
      const me = room.self;
      if (me && distanceToObject(obj, me.x, me.y) > INTERACT_RANGE) {
        walkTo({ x: obj.x + obj.w / 2, y: obj.y + obj.h + 0.2 });
      }
      return;
    }
    setHint(null);
    scene?.ripple(wx, wy, now());
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
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const w = toWorld(e.clientX, e.clientY);
    const interactive = !!peerAt(w.x, w.y) || !!objectAt(w.x, w.y);
    const tx = Math.floor(w.x);
    const ty = Math.floor(w.y);
    state.current.hover = !interactive && grid[ty]?.[tx] ? { x: tx, y: ty } : null;
    canvasRef.current!.style.cursor = interactive ? "pointer" : grid[ty]?.[tx] ? "pointer" : "default";
  };
  const zoomBy = (f: number) => {
    state.current.zoom = Math.max(0.5, Math.min(2.6, (state.current.zoom || 1) * f));
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

  const sendEmote = (emoji: (typeof EMOTES)[number]) => {
    room.send({ t: "emote", emoji });
    setEmoteOpen(false);
  };

  const presenter = remote.find((r) => r.screen && snap.peers.get(r.peerId)?.media.screen);
  const presenterName = presenter ? snap.peers.get(presenter.peerId)?.name : null;
  const videoPeers = remote.filter((r) => r.cam && snap.peers.get(r.peerId)?.media.cam).slice(0, 8);
  const zoneHere = self ? zoneAt(map, self.x, self.y) : null;
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
        onPointerMove={onPointerMove}
        onPointerLeave={() => (state.current.hover = null)}
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.1 : 0.9)}
      />

      <div className="hud-tl">
        {zoneHere && (
          <span className={`hud-chip ${zoneHere.private ? "private" : ""}`}>
            <span aria-hidden>{zoneHere.private ? "🔒" : "📍"}</span>
            <b>{t(zoneHere.label)}</b>
            {zoneHere.private && <span className="sub">{t("room.isolated")}</span>}
          </span>
        )}
        <span className="hud-chip subtle" title={t("room.nearbyHint")}>
          <Icon name="users" size={14} /> {t("room.nearby", { n: nearby })}
        </span>
        {snap.conn !== "open" && <span className="hud-chip warn">⟳ {t(`conn.${snap.conn}`)}</span>}
        {self?.media.screen && (
          <span className="hud-chip danger">
            🖥️ {t("media.youPresent")}
            <button className="btn small danger" onClick={() => void media.setScreen(false)}>
              {t("media.stop")}
            </button>
          </span>
        )}
      </div>

      <div className="hud-tr">
        {scene && (
          <Minimap
            scene={scene}
            getPeople={() => {
              const s = snapRef.current;
              return [...s.peers.values()].map((p) => ({
                x: state.current.display.get(p.id)?.x ?? p.x,
                y: state.current.display.get(p.id)?.y ?? p.y,
                self: p.id === s.selfId,
                status: p.status,
              }));
            }}
            getView={() => {
              const c = canvasRef.current;
              const cam = state.current.camera;
              return {
                x: cam.x,
                y: cam.y,
                w: (c?.clientWidth ?? 0) / cam.zoom,
                h: (c?.clientHeight ?? 0) / cam.zoom,
              };
            }}
            onPick={(p) => walkTo(p)}
            label={t("room.minimap")}
          />
        )}
        <div className="zoom">
          <button onClick={() => zoomBy(1.2)} aria-label={t("room.zoomIn")}>
            +
          </button>
          <button onClick={() => zoomBy(1 / 1.2)} aria-label={t("room.zoomOut")}>
            −
          </button>
        </div>
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
            <span className="live-dot" /> <b>{t("media.presenting", { name: presenterName ?? "" })}</b>
          </div>
          <VideoEl stream={presenter.screen!} />
        </div>
      )}

      {hint && (
        <div ref={hintRef} className="hint-pop" role="dialog" aria-label={t(hint.obj.label!)}>
          <div className="title">
            <span className="hint-icon" aria-hidden>
              ✨
            </span>
            {t(hint.obj.label!)}
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

      {emoteOpen && (
        <div className="emote-pop" role="menu" aria-label={t("emote.title")}>
          {EMOTES.map((e) => (
            <button key={e} role="menuitem" onClick={() => sendEmote(e)} aria-label={e}>
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="dock" role="toolbar" aria-label={t("room.controls")}>
        <div className="dock-group">
          <button
            className={`dock-btn mic ${self?.media.mic ? "on" : "off"}`}
            onClick={() => void toggle("mic")}
            aria-pressed={!!self?.media.mic}
            aria-label={self?.media.mic ? t("media.micOn") : t("media.micOff")}
            title={self?.media.mic ? t("media.micOn") : t("media.micOff")}
          >
            <Icon name={self?.media.mic ? "mic" : "micOff"} size={20} />
            <span className="lbl">{self?.media.mic ? t("media.mute") : t("media.unmute")}</span>
          </button>
          <button
            className={`dock-btn ${self?.media.cam ? "active" : ""}`}
            onClick={() => void toggle("cam")}
            aria-pressed={!!self?.media.cam}
            aria-label={t("media.camera")}
            title={t("media.camera")}
          >
            <Icon name={self?.media.cam ? "cam" : "camOff"} />
          </button>
          <button
            className={`dock-btn hide-sm ${self?.media.screen ? "active" : ""}`}
            onClick={() => void toggle("screen")}
            aria-pressed={!!self?.media.screen}
            aria-label={self?.media.screen ? t("media.stopShare") : t("media.share")}
            title={self?.media.screen ? t("media.stopShare") : t("media.share")}
          >
            <Icon name="screen" />
          </button>
        </div>
        <div className="dock-group">
          <button
            className={`dock-btn ${emoteOpen ? "active" : ""}`}
            onClick={() => setEmoteOpen((v) => !v)}
            aria-expanded={emoteOpen}
            aria-label={t("emote.title")}
            title={t("emote.title")}
          >
            <span style={{ fontSize: 18 }}>😊</span>
          </button>
          <label className="dock-select" title={t("status.label")}>
            <span className={`status-dot s-${self?.status ?? "active"}`} />
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
        </div>
        <div className="dock-group">
          <label className="dock-select hide-sm" title={t("room.goTo")}>
            <Icon name="pin" size={16} />
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
          <button
            className="dock-btn"
            onClick={onOpenNotes}
            aria-label={t("notes.title")}
            title={t("notes.title")}
          >
            <Icon name="notes" />
          </button>
          <button
            className="dock-btn"
            onClick={onOpenDevices}
            aria-label={t("devices.title")}
            title={t("devices.title")}
          >
            <Icon name="settings" />
          </button>
          <button
            className="dock-btn hide-sm"
            onClick={onHelp}
            aria-label={t("tips.title")}
            title={t("tips.title")}
          >
            <Icon name="help" />
          </button>
        </div>
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
