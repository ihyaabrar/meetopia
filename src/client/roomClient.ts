/**
 * Koneksi WebSocket ke ruangan grup, dengan sambung ulang otomatis (aturan 2 PRD).
 * Menyimpan status ruangan (peserta, peta, catatan bersama) dan memancarkan event ke UI.
 */
import type { ChatMessage, ClientMessage, Presence, ServerMessage, SharedNote } from "@/shared/protocol";
import type { MapData } from "@/shared/map";

export type ConnState = "connecting" | "open" | "reconnecting" | "closed";

export interface RoomSnapshot {
  conn: ConnState;
  selfId: string | null;
  peers: Map<string, Presence>;
  map: MapData | null;
  sharedNote: SharedNote | null;
  version: number;
}

type EventMap = {
  chat: ChatMessage;
  signal: { from: string; data: unknown };
  knock: Extract<ServerMessage, { t: "knock" }>;
  knockResult: Extract<ServerMessage, { t: "knockResult" }>;
  moveRejected: Extract<ServerMessage, { t: "moveRejected" }>;
  screenRejected: Extract<ServerMessage, { t: "screenRejected" }>;
  kicked: string;
  error: string;
  welcome: void;
};

type Listener<K extends keyof EventMap> = (e: EventMap[K]) => void;

function realtimeUrl(token: string): string {
  // Khusus pengembangan/tes: paksa instance real-time tertentu (uji multi-instance lewat Redis).
  const devOverride =
    process.env.NODE_ENV !== "production"
      ? (window as unknown as { __MEETOPIA_RT_URL?: string }).__MEETOPIA_RT_URL
      : undefined;
  const base = devOverride || process.env.NEXT_PUBLIC_REALTIME_URL;
  if (base) return `${base.replace(/\/$/, "")}/ws?token=${encodeURIComponent(token)}`;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws?token=${encodeURIComponent(token)}`;
}

export class RoomClient {
  private ws: WebSocket | null = null;
  private closedByUser = false;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Map<keyof EventMap, Set<Listener<never>>>();
  private storeListeners = new Set<() => void>();
  /** Waktu terakhir terputus, untuk mengukur durasi putus (catatan spike M2). */
  disconnectedAt: number | null = null;

  snapshot: RoomSnapshot = {
    conn: "connecting",
    selfId: null,
    peers: new Map(),
    map: null,
    sharedNote: null,
    version: 0,
  };

  constructor(public readonly groupId: string) {}

  // ----- penyimpanan untuk useSyncExternalStore -----
  subscribe = (fn: () => void) => {
    this.storeListeners.add(fn);
    return () => this.storeListeners.delete(fn);
  };
  getSnapshot = () => this.snapshot;
  private commit(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch, version: this.snapshot.version + 1 };
    this.storeListeners.forEach((f) => f());
  }

  on<K extends keyof EventMap>(event: K, fn: Listener<K>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn as Listener<never>);
    return () => this.listeners.get(event)?.delete(fn as Listener<never>);
  }
  private emit<K extends keyof EventMap>(event: K, data: EventMap[K]) {
    this.listeners.get(event)?.forEach((fn) => (fn as Listener<K>)(data));
  }

  get self(): Presence | null {
    return this.snapshot.selfId ? (this.snapshot.peers.get(this.snapshot.selfId) ?? null) : null;
  }

  async connect() {
    this.closedByUser = false;
    let token: string;
    try {
      const res = await fetch(`/api/groups/${this.groupId}/realtime-token`, { method: "POST" });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        this.commit({ conn: "closed" });
        this.emit("kicked", "forbidden");
        return;
      }
      token = (await res.json()).token;
    } catch {
      return this.scheduleReconnect();
    }
    if (this.closedByUser) return;
    const ws = new WebSocket(realtimeUrl(token));
    this.ws = ws;
    ws.onmessage = (ev) => this.onMessage(JSON.parse(String(ev.data)) as ServerMessage);
    ws.onopen = () => {
      this.retry = 0;
      this.pingTimer = setInterval(() => this.send({ t: "ping" }), 25_000);
    };
    ws.onclose = (ev) => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.closedByUser || ev.code === 4000 || ev.code === 4003) {
        this.commit({ conn: "closed" });
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.closedByUser) return;
    this.disconnectedAt ??= Date.now();
    this.commit({ conn: "reconnecting" });
    const delay = Math.min(10_000, 500 * 2 ** this.retry) + Math.random() * 300;
    this.retry++;
    this.retryTimer = setTimeout(() => void this.connect(), delay);
  }

  close() {
    this.closedByUser = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close(1000);
    this.ws = null;
    this.commit({ conn: "closed" });
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** Memperbarui posisi diri secara lokal (prediksi) sebelum dikirim ke server. */
  updateSelf(patch: Partial<Presence>) {
    const self = this.self;
    if (!self) return;
    const peers = new Map(this.snapshot.peers);
    peers.set(self.id, { ...self, ...patch });
    this.commit({ peers });
  }

  private onMessage(m: ServerMessage) {
    switch (m.t) {
      case "welcome": {
        const peers = new Map(m.peers.map((p) => [p.id, p]));
        this.commit({ conn: "open", selfId: m.selfId, peers, map: m.map, sharedNote: m.sharedNote });
        if (this.disconnectedAt) {
          console.info(`[meetopia] tersambung lagi setelah ${Date.now() - this.disconnectedAt} ms`);
          this.disconnectedAt = null;
        }
        this.emit("welcome", undefined);
        return;
      }
      case "join":
      case "update": {
        const peers = new Map(this.snapshot.peers);
        const existing = peers.get(m.peer.id);
        if (m.peer.id === this.snapshot.selfId && existing) {
          // Posisi diri dikendalikan lokal; ambil bagian lain dari server.
          peers.set(m.peer.id, {
            ...m.peer,
            x: existing.x,
            y: existing.y,
            dir: existing.dir,
            moving: existing.moving,
          });
        } else {
          peers.set(m.peer.id, m.peer);
        }
        this.commit({ peers });
        return;
      }
      case "leave": {
        const p = this.snapshot.peers.get(m.id);
        if (!p || p.conn !== m.conn || m.id === this.snapshot.selfId) return;
        const peers = new Map(this.snapshot.peers);
        peers.delete(m.id);
        this.commit({ peers });
        return;
      }
      case "chat":
        return this.emit("chat", m.message);
      case "signal":
        return this.emit("signal", { from: m.from, data: m.data });
      case "knock":
        return this.emit("knock", m);
      case "knockResult":
        return this.emit("knockResult", m);
      case "moveRejected":
        this.updateSelf({ x: m.x, y: m.y, moving: false });
        return this.emit("moveRejected", m);
      case "screenRejected":
        return this.emit("screenRejected", m);
      case "sharedNote":
        return this.commit({ sharedNote: m.note });
      case "map":
        return this.commit({ map: m.map });
      case "kicked":
        this.closedByUser = true;
        this.commit({ conn: "closed" });
        return this.emit("kicked", m.reason);
      case "error":
        return this.emit("error", m.code);
      case "pong":
        return;
    }
  }
}
