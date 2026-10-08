/**
 * Server real-time Meetopia (M2, M4, M6-M8).
 *
 * - Setiap koneksi WebSocket = satu pengguna di satu ruangan grup.
 * - Kehadiran dan posisi disimpan di Redis (atau memori saat pengembangan), BUKAN di Neon.
 * - Semua instance berlangganan kanal `room:<groupId>` sehingga pengguna di instance berbeda saling melihat.
 * - Hak akses diperiksa di sini untuk setiap pesan (aturan 4).
 * - Instance pemilik soket adalah satu-satunya penulis data kehadiran pengguna tersebut.
 */
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { verifyRealtimeToken } from "@/server/tokens";
import { activeStatus } from "@/shared/status";
import { getKv, keys, type Kv } from "@/server/kv";
import { one } from "@/server/db";
import { newId } from "@/server/ids";
import * as repo from "@/server/repo";
import {
  buildWalkable,
  distanceToObject,
  isLockable,
  privateZoneAt,
  type MapData,
  type Zone,
} from "@/shared/map";
import { SPEAKER_CONTROL_RANGE, type MusicState } from "@/shared/music";
import { TV_CONTROL_RANGE, youtubeId, type TvState } from "@/shared/tv";
import { pairVolume } from "@/shared/proximity";
import { sanitizeAvatar } from "@/shared/avatar";
import { can, type Role } from "@/shared/roles";
import {
  FULL_NEEDS,
  ITEMS,
  SHOP_RANGE,
  applyItem,
  dayKey,
  menuEntry,
  msPerCoin,
  restKindAt,
  sanitizeNeeds,
  tickNeeds,
  venueOf,
  type LifeSettings,
  type LifeState,
  type Needs,
} from "@/shared/life";
import {
  clientMessageSchema,
  type ChatMessage,
  type ClientMessage,
  type Presence,
  type ServerMessage,
  type ZoneLock,
} from "@/shared/protocol";
import { createHash } from "node:crypto";
import { canSitAt, seatPose } from "@/shared/seats";
import { directionFrom } from "@/shared/avatar-animation";
import { OrderedQueue } from "./ordered-queue";

/** Status ruangan di Redis: pemegang, kunci, dan hash PIN (hanya di server). */
interface StoredZone extends ZoneLock {
  pinHash?: string;
}

const pinHash = (groupId: string, zoneId: string, pin: string) =>
  createHash("sha256").update(`${groupId}:${zoneId}:${pin}`).digest("hex");
import { publishToRoom, type Envelope } from "./bus";

const AWAY_AFTER_MS = 5 * 60_000;
const PRESENCE_STALE_MS = 90_000;
const HEARTBEAT_MS = 20_000;
/**
 * Hemat perintah Redis (paket gratis dibatasi per bulan): kehadiran yang tidak berubah cukup
 * disegarkan tiap 45 detik (masih jauh di bawah batas basi 90 detik), posisi saat berjalan ditulis
 * ke hash paling sering tiap 1 detik (pub/sub tetap tiap pesan), dan bar kebutuhan tiap 5 menit.
 */
const PRESENCE_REFRESH_MS = 45_000;
const MOVING_WRITE_MS = 1_000;
const NEEDS_SAVE_MS = 5 * 60_000;
/** Daftar kehadiran untuk meneruskan sinyal WebRTC boleh berumur sebentar (banyak sinyal per detik). */
const PRESENCE_CACHE_MS = 1_000;
const LEAVE_GRACE_MS = 3_000;
const LAST_POSITION_TTL = 24 * 3600;
const CHAT_WINDOW_MS = 5_000;
const CHAT_MAX_PER_WINDOW = 6;
const NEEDS_TTL = 30 * 24 * 3600;
/** Gaji dicairkan ke Neon setiap terkumpul sekian koin (sekitar 10 menit), bukan tiap menit. */
const WALLET_FLUSH_COINS = 10;

interface Conn {
  ws: WebSocket;
  userId: string;
  groupId: string;
  role: Role;
  presence: Presence;
  autoAway: boolean;
  chatTimes: number[];
  emoteTimes: number[];
  musicTimes: number[];
  lastPosSave: number;
  /** Kapan kehadiran terakhir ditulis ke Redis. */
  presenceWrittenAt: number;
  needsSavedAt: number;
  statusExpiresAt: number | null;
  pinTimes: number[];
  /** Status "rapat" dipasang otomatis karena masuk ruang privat (dicabut saat keluar). */
  autoMeeting: boolean;
  /** Karakter hidup (Fase 2): bar kebutuhan dan kapan terakhir dihitung. */
  needs: Needs;
  needsAt: number;
  wallet: repo.Wallet;
  /** Koin gaji yang sudah terlihat di saldo tetapi belum dicairkan ke Neon. */
  pendingCoins: number;
  /** Waktu aktif (ms) yang belum menjadi koin. */
  activeMs: number;
  shopTimes: number[];
  shopBusy: boolean;
  /** Pesanan kantin/kopi yang sedang disiapkan. */
  order: { timer: NodeJS.Timeout; serve: () => Promise<void> } | null;
  /** Bar & gaji koneksi ini sudah disimpan saat dilepas (jangan menimpa koneksi baru). */
  lifeSaved: boolean;
}

interface Room {
  groupId: string;
  conns: Map<string, Conn>;
  /** Koneksi yang baru tertutup dan masih dalam masa tenggang sebelum benar-benar keluar. */
  leaving: Map<string, Conn>;
  map: MapData;
  walkable: boolean[][];
  life: LifeSettings;
  unsubscribe: () => Promise<void>;
}

const send = (ws: WebSocket, msg: ServerMessage) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
};

export class RealtimeHub {
  private wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  private rooms = new Map<string, Room>();
  private roomLoading = new Map<string, Promise<Room>>();
  private pendingMessages: ChatMessage[] = [];
  private timers: NodeJS.Timeout[] = [];
  private kvPromise = getKv();

  constructor() {
    this.timers.push(setInterval(() => void this.heartbeat(), HEARTBEAT_MS));
    this.timers.push(setInterval(() => void this.flushMessages(), 1_000));
    this.timers.push(setInterval(() => void repo.pruneOldMessages().catch(() => {}), 6 * 3600_000));
  }

  private kv(): Promise<Kv> {
    return this.kvPromise;
  }

  /** Dipanggil dari event `upgrade` server HTTP (server lokal / server real-time mandiri). */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    this.wss.handleUpgrade(req, socket, head, (ws) => this.accept(ws, req.url ?? "/"));
  }

  /** Menerima soket yang sudah di-upgrade, mis. dari `experimental_upgradeWebSocket` di Vercel. */
  accept(ws: WebSocket, url: string) {
    void this.onConnection(ws, url).catch((e) => {
      console.error("[realtime] gagal menerima koneksi", e);
      send(ws, { t: "error", code: "server" });
      ws.close(1011);
    });
  }

  private async loadRoom(groupId: string): Promise<Room> {
    const existing = this.rooms.get(groupId);
    if (existing) return existing;
    if (!this.roomLoading.has(groupId)) {
      this.roomLoading.set(
        groupId,
        (async () => {
          const [map, life] = await Promise.all([repo.getMap(groupId), repo.getLifeSettings(groupId)]);
          const kv = await this.kv();
          const room: Room = {
            groupId,
            conns: new Map(),
            leaving: new Map(),
            map,
            walkable: buildWalkable(map),
            life,
            unsubscribe: async () => {},
          };
          room.unsubscribe = await kv.subscribe(keys.roomChannel(groupId), (raw) => this.onBus(room, raw));
          this.rooms.set(groupId, room);
          this.roomLoading.delete(groupId);
          return room;
        })(),
      );
    }
    return this.roomLoading.get(groupId)!;
  }

  private async onConnection(ws: WebSocket, rawUrl: string) {
    const url = new URL(rawUrl, "http://x");
    const auth = await verifyRealtimeToken(url.searchParams.get("token") ?? "");
    if (!auth) {
      send(ws, { t: "error", code: "unauthorized" });
      return ws.close(4001);
    }
    const role = await repo.getRole(auth.userId, auth.groupId);
    if (!role || !can(role, "enterRoom")) {
      send(ws, { t: "error", code: "forbidden" });
      return ws.close(4003);
    }
    const user = await one<{
      name: string;
      avatar: unknown;
      status_text: string | null;
      status_expires_at: string | Date | null;
    }>("SELECT name, avatar, status_text, status_expires_at FROM users WHERE id = $1", [auth.userId]);
    if (!user) return ws.close(4001);

    const room = await this.loadRoom(auth.groupId);
    const kv = await this.kv();

    // Pulihkan posisi terakhir (sambung ulang otomatis, aturan 2).
    let pos = room.map.spawn ? { x: room.map.spawn.x + 0.5, y: room.map.spawn.y + 0.5 } : { x: 1.5, y: 1.5 };
    const saved = await kv.get(keys.lastPosition(auth.groupId, auth.userId));
    if (saved) {
      const p = JSON.parse(saved) as { x: number; y: number };
      if (this.isWalkable(room, p.x, p.y)) pos = p;
    }
    // Jangan muncul di dalam ruang privat yang sedang dipakai orang lain.
    const all = (await this.readPresence(room)).filter((p) => p.id !== auth.userId);
    const z = privateZoneAt(room.map, pos.x, pos.y);
    if (!saved || (z && (await this.lockOf(room, z.id)))) {
      pos = this.freeSpawn(room, all);
    }

    const status = activeStatus(user.status_text, user.status_expires_at);
    const presence: Presence = {
      id: auth.userId,
      conn: newId(),
      name: user.name,
      avatar: sanitizeAvatar(user.avatar),
      role,
      x: pos.x,
      y: pos.y,
      dir: "down",
      moving: false,
      sitting: false,
      status: "active",
      manualStatus: false,
      statusText: status.statusText,
      // Aturan 8: mikrofon dan kamera mati saat masuk.
      media: { mic: false, cam: false, screen: false },
      allowedZone: privateZoneAt(room.map, pos.x, pos.y)?.id ?? null,
      allowedPeers: [],
      lastActive: Date.now(),
    };

    // Satu koneksi per pengguna per grup: tutup koneksi lama (di instance mana pun).
    const old = room.conns.get(auth.userId);
    if (old) this.closeConn(room, old, "replaced", false);
    // Gaji dan bar dari koneksi sebelumnya (mis. muat ulang halaman) disimpan dulu sebelum dibaca lagi.
    const prev = old ?? room.leaving.get(auth.userId);
    if (prev) await this.persistLife(room, prev).catch(() => {});
    const [rawNeeds, wallet] = await Promise.all([
      kv.get(keys.needs(auth.groupId, auth.userId)),
      repo.getWallet(auth.userId, auth.groupId),
    ]);
    await publishToRoom(auth.groupId, {
      control: { kind: "replaced", userId: auth.userId, conn: presence.conn },
    });

    const conn: Conn = {
      ws,
      userId: auth.userId,
      groupId: auth.groupId,
      role,
      presence,
      autoAway: false,
      chatTimes: [],
      emoteTimes: [],
      musicTimes: [],
      lastPosSave: 0,
      presenceWrittenAt: 0,
      needsSavedAt: Date.now(),
      statusExpiresAt: status.statusExpiresAt ? Date.parse(status.statusExpiresAt) : null,
      autoMeeting: false,
      pinTimes: [],
      needs: rawNeeds ? sanitizeNeeds(JSON.parse(rawNeeds)) : { ...FULL_NEEDS },
      needsAt: Date.now(),
      wallet,
      pendingCoins: 0,
      activeMs: 0,
      shopTimes: [],
      shopBusy: false,
      order: null,
      lifeSaved: false,
    };
    room.conns.set(auth.userId, conn);
    await this.writePresence(conn);

    // Install before welcome: clients can send immediately when it arrives. Async commands must
    // preserve websocket order (stand → move → invite), not race through Redis operations.
    const commands = new OrderedQueue((e) => console.error("[realtime] pesan gagal", e));
    let queuedMove: { message: Extract<ClientMessage, { t: "move" }> } | null = null;
    ws.on("message", (raw) => {
      let data: unknown;
      try {
        data = JSON.parse(String(raw));
      } catch {
        return;
      }
      const parsed = clientMessageSchema.safeParse(data);
      if (!parsed.success) return send(ws, { t: "error", code: "badMessage" });
      const message = parsed.data;
      if (message.t === "ping") return send(ws, { t: "pong" });
      // Movement is sent ~11x per second. While a move still waits in the queue, a newer one simply
      // replaces it (only the latest position matters), so a slow Redis (e.g. Upstash from Vercel)
      // cannot build a backlog that delays positions by seconds or overflows the queue.
      if (message.t === "move" && queuedMove) {
        queuedMove.message = message;
        return;
      }
      if (message.t === "move") {
        const slot = { message };
        queuedMove = slot;
        if (
          !commands.enqueue(async () => {
            if (queuedMove === slot) queuedMove = null;
            if (room.conns.get(conn.userId) === conn) await this.onMessage(room, conn, slot.message);
          })
        ) {
          queuedMove = null;
          send(ws, { t: "error", code: "rateLimited" });
        }
        return;
      }
      // Any other command seals the pending move, so later moves stay after it (stand → move → sit).
      queuedMove = null;
      if (
        !commands.enqueue(async () => {
          if (room.conns.get(conn.userId) === conn) await this.onMessage(room, conn, message);
        })
      )
        send(ws, { t: "error", code: "rateLimited" });
    });
    ws.on("close", () => {
      if (room.conns.get(conn.userId) === conn) this.scheduleLeave(room, conn);
    });

    const peers = (await this.readPresence(room)).filter((p) => p.id !== auth.userId);
    send(ws, {
      t: "welcome",
      selfId: auth.userId,
      peers: [presence, ...peers],
      map: room.map,
      sharedNote: await repo.getSharedNote(auth.groupId),
      music: await this.readMusic(room),
      locks: await this.readLocks(room),
      tv: await this.readTv(room),
      serverNow: Date.now(),
    });
    this.sendLife(room, conn);
    await publishToRoom(auth.groupId, { msg: { t: "join", peer: presence } });
    const startZone = privateZoneAt(room.map, presence.x, presence.y);
    if (startZone) await this.enterZone(room, conn, startZone);
  }

  /** Titik muncul di sekitar spawn yang tidak ditempati orang lain (agar avatar tidak menumpuk). */
  private freeSpawn(room: Room, others: Presence[]): { x: number; y: number } {
    const { x: sx, y: sy } = room.map.spawn;
    const candidates: Array<{ x: number; y: number }> = [];
    // Kandidat berjarak 2 tile agar avatar dan labelnya tidak saling menutupi.
    for (let r = 0; r <= 6 && candidates.length < 6; r += 2)
      for (let dy = -r; dy <= r; dy += 2)
        for (let dx = -r; dx <= r; dx += 2) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = sx + dx + 0.5;
          const y = sy + dy + 0.5;
          if (!this.isWalkable(room, x, y) || privateZoneAt(room.map, x, y)) continue;
          if (others.some((o) => Math.hypot(o.x - x, o.y - y) < 1.5)) continue;
          candidates.push({ x, y });
        }
    return candidates.length
      ? candidates[Math.floor(Math.random() * Math.min(3, candidates.length))]
      : { x: sx + 0.5, y: sy + 0.5 };
  }

  private isWalkable(room: Room, x: number, y: number): boolean {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    return !!room.walkable[ty]?.[tx];
  }

  private async readPresence(room: Room): Promise<Presence[]> {
    const kv = await this.kv();
    const raw = await kv.hgetall(keys.presence(room.groupId));
    const now = Date.now();
    const out: Presence[] = [];
    for (const [id, v] of Object.entries(raw)) {
      const entry = JSON.parse(v) as { p: Presence; seen: number };
      if (now - entry.seen > PRESENCE_STALE_MS) {
        // Sisa dari instance yang mati.
        await kv.hdel(keys.presence(room.groupId), id);
        continue;
      }
      out.push(entry.p);
    }
    return out;
  }

  private async writePresence(conn: Conn) {
    const kv = await this.kv();
    const p = conn.presence;
    if (
      p.sitting &&
      p.seatId &&
      !(await kv.claim(`seat:${conn.groupId}:${p.seatId}:${p.seatIndex ?? 0}`, p.conn, 90))
    ) {
      p.sitting = false;
      delete p.seatId;
      delete p.seatIndex;
      send(conn.ws, { t: "seatRejected", reason: "occupied" });
    }
    conn.presenceWrittenAt = Date.now();
    await kv.hset(
      keys.presence(conn.groupId),
      conn.userId,
      JSON.stringify({ p: conn.presence, seen: Date.now() }),
    );
  }

  private async releaseSeat(conn: Conn) {
    const p = conn.presence;
    if (p.seatId)
      await (await this.kv()).release(`seat:${conn.groupId}:${p.seatId}:${p.seatIndex ?? 0}`, p.conn);
  }

  /**
   * `motionOnly`: hanya posisi yang berubah di tengah jalan. Semua orang tetap menerima lewat pub/sub,
   * tetapi hash kehadiran di Redis cukup ditulis paling sering tiap MOVING_WRITE_MS.
   */
  private async broadcastUpdate(conn: Conn, motionOnly = false) {
    if (!motionOnly || Date.now() - conn.presenceWrittenAt >= MOVING_WRITE_MS) await this.writePresence(conn);
    await publishToRoom(conn.groupId, { msg: { t: "update", peer: conn.presence } });
  }

  private presenceCache = new Map<string, { at: number; list: Promise<Presence[]> }>();

  /** Kehadiran yang boleh sedikit basi; dipakai untuk pesan yang sangat sering (sinyal WebRTC). */
  private readPresenceCached(room: Room): Promise<Presence[]> {
    const hit = this.presenceCache.get(room.groupId);
    if (hit && Date.now() - hit.at < PRESENCE_CACHE_MS) return hit.list;
    const list = this.readPresence(room);
    this.presenceCache.set(room.groupId, { at: Date.now(), list });
    list.catch(() => this.presenceCache.delete(room.groupId));
    return list;
  }

  private scheduleLeave(room: Room, conn: Conn) {
    void this.releaseSeat(conn);
    room.conns.delete(conn.userId);
    room.leaving.set(conn.userId, conn);
    setTimeout(() => void this.finalizeLeave(room, conn), LEAVE_GRACE_MS);
  }

  private async finalizeLeave(room: Room, conn: Conn) {
    if (room.leaving.get(conn.userId) === conn) room.leaving.delete(conn.userId);
    await this.persistLife(room, conn).catch((e) => console.error("[realtime] gagal menyimpan dompet", e));
    const kv = await this.kv();
    await kv.set(
      keys.lastPosition(conn.groupId, conn.userId),
      JSON.stringify({ x: conn.presence.x, y: conn.presence.y }),
      LAST_POSITION_TTL,
    );
    const raw = await kv.hget(keys.presence(conn.groupId), conn.userId);
    if (raw && (JSON.parse(raw) as { p: Presence }).p.conn === conn.presence.conn) {
      await kv.hdel(keys.presence(conn.groupId), conn.userId);
      await repo.touchLastSeen(conn.groupId, conn.userId).catch(() => {});
      const zone = privateZoneAt(room.map, conn.presence.x, conn.presence.y);
      if (zone) await this.leaveZone(room, conn.userId, zone);
    }
    await publishToRoom(conn.groupId, { msg: { t: "leave", id: conn.userId, conn: conn.presence.conn } });
    // Di Vercel instance bisa dibekukan setelah koneksi terakhir tutup: simpan pesan sekarang.
    await this.flushMessages();
    if (room.conns.size === 0 && this.rooms.get(room.groupId) === room) {
      this.rooms.delete(room.groupId);
      await room.unsubscribe();
    }
  }

  private closeConn(room: Room, conn: Conn, reason: string, leave = true) {
    void this.releaseSeat(conn);
    send(conn.ws, { t: "kicked", reason });
    if (room.conns.get(conn.userId) === conn) {
      if (leave) this.scheduleLeave(room, conn);
      else room.conns.delete(conn.userId);
    }
    conn.ws.close(4000, reason);
  }

  private markActive(conn: Conn): boolean {
    conn.presence.lastActive = Date.now();
    if (conn.autoAway && conn.presence.status === "away") {
      conn.autoAway = false;
      conn.presence.status = "active";
      return true;
    }
    return false;
  }

  private async onMessage(room: Room, conn: Conn, m: ClientMessage) {
    if (m.t === "ping") return send(conn.ws, { t: "pong" });
    const statusChanged = this.markActive(conn);
    const p = conn.presence;

    switch (m.t) {
      case "activity":
        if (statusChanged) await this.broadcastUpdate(conn);
        return;

      case "avatarAction": {
        const now = Date.now();
        conn.emoteTimes = conn.emoteTimes.filter((t) => now - t < CHAT_WINDOW_MS);
        if (conn.emoteTimes.length >= CHAT_MAX_PER_WINDOW) return;
        conn.emoteTimes.push(now);
        p.avatarAction = m.action;
        delete p.pairedAction;
        return this.broadcastUpdate(conn);
      }

      case "pairInvite": {
        const target = (await this.readPresence(room)).find(
          (other) => other.id === m.toUserId && other.id !== p.id,
        );
        if (
          !target ||
          target.sitting ||
          p.sitting ||
          Math.hypot(target.x - p.x, target.y - p.y) > 1.5 ||
          pairVolume(room.map, p, target) <= 0
        )
          return send(conn.ws, { t: "pairResult", accepted: false, reason: "tooFar" });
        const kv = await this.kv();
        if ((await kv.incr(`pair-rate:${conn.groupId}:${p.id}`, 10)) > 3)
          return send(conn.ws, { t: "pairResult", accepted: false, reason: "rateLimited" });
        const requestId = newId(),
          expiresAt = Date.now() + 30_000;
        await kv.set(
          `pair:${conn.groupId}:${requestId}`,
          JSON.stringify({ from: p.id, to: target.id, action: m.action, expiresAt }),
          30,
        );
        await publishToRoom(conn.groupId, {
          to: [target.id],
          msg: { t: "pairInvite", requestId, fromId: p.id, fromName: p.name, action: m.action, expiresAt },
        });
        return;
      }
      case "pairReply": {
        const kv = await this.kv(),
          key = `pair:${conn.groupId}:${m.requestId}`;
        const raw = await kv.get(key);
        if (!raw) return send(conn.ws, { t: "pairResult", accepted: false, reason: "expired" });
        const req = JSON.parse(raw) as {
          from: string;
          to: string;
          action: "handshake" | "high-five" | "fist-bump";
          expiresAt: number;
        };
        if (req.to !== p.id || (await kv.incr(`${key}:claim`, 30)) > 1) return;
        await kv.del(key);
        const other = (await this.readPresence(room)).find((o) => o.id === req.from);
        const near =
          other &&
          !p.sitting &&
          !other.sitting &&
          Math.hypot(other.x - p.x, other.y - p.y) <= 1.5 &&
          pairVolume(room.map, p, other) > 0;
        if (!m.accept || !near)
          return publishToRoom(conn.groupId, {
            to: [p.id, req.from],
            msg: { t: "pairResult", accepted: false, reason: m.accept ? "tooFar" : "declined" },
          });
        const startedAt = Date.now() + 250;
        await publishToRoom(conn.groupId, {
          control: {
            kind: "pairPose",
            a: req.from,
            b: p.id,
            action: req.action,
            startedAt,
            expiresAt: startedAt + 2200,
            ax: other!.x,
            ay: other!.y,
            bx: p.x,
            by: p.y,
          },
        });
        return publishToRoom(conn.groupId, {
          to: [p.id, req.from],
          msg: { t: "pairResult", accepted: true },
        });
      }

      case "move": {
        this.tickLife(room, conn);
        if (!this.isWalkable(room, m.x, m.y))
          return send(conn.ws, { t: "moveRejected", x: p.x, y: p.y, reason: "privateZone" });
        const zone = privateZoneAt(room.map, m.x, m.y);
        const prevZone = privateZoneAt(room.map, p.x, p.y);
        if (zone && p.allowedZone !== zone.id) {
          // Ruang yang sedang dikunci dan belum "diketuk": tolak di server (FR-23, FR-31).
          if (isLockable(zone) && (await this.lockOf(room, zone.id)))
            return send(conn.ws, { t: "moveRejected", x: p.x, y: p.y, reason: "privateZone" });
          p.allowedZone = zone.id;
        }
        // Izin masuk dicabut setelah benar-benar keluar dari ruang privat (bukan saat masih di depan pintu).
        if (!zone && prevZone) p.allowedZone = null;
        p.x = m.x;
        p.y = m.y;
        p.dir = m.dir;
        p.moving = m.moving;
        if (m.moving) p.avatarAction = "idle";
        const stoodUp = m.moving && p.sitting;
        if (m.moving) {
          await this.releaseSeat(conn);
          p.sitting = false;
          delete p.seatId;
          delete p.seatIndex;
          delete p.pairedAction;
        }
        if (stoodUp) this.sendLife(room, conn);
        const statusBefore = p.status;
        this.autoMeetingStatus(room, conn);
        const zoneChanged = (prevZone?.id ?? null) !== (zone?.id ?? null);
        await this.broadcastUpdate(conn, m.moving && !zoneChanged && !stoodUp && p.status === statusBefore);
        if (prevZone && prevZone.id !== zone?.id) await this.leaveZone(room, conn.userId, prevZone);
        if (zone && zone.id !== prevZone?.id) await this.enterZone(room, conn, zone);
        if (!m.moving || Date.now() - conn.lastPosSave > 10_000) {
          conn.lastPosSave = Date.now();
          const kv = await this.kv();
          await kv.set(
            keys.lastPosition(conn.groupId, conn.userId),
            JSON.stringify({ x: p.x, y: p.y }),
            LAST_POSITION_TTL,
          );
        }
        return;
      }

      case "sit": {
        this.tickLife(room, conn);
        if (m.sitting) {
          const obj = m.objectId
            ? room.map.objects.find((o) => o.id === m.objectId)
            : room.map.objects.find((o) => o.actions?.includes("sit") && distanceToObject(o, p.x, p.y) < 0.8);
          if (!canSitAt(room.map, obj, p.x, p.y, m.seatIndex))
            return send(conn.ws, { t: "seatRejected", reason: "tooFar" });
          const seat = seatPose(room.map, obj!, m.seatIndex);
          const peers = await this.readPresence(room);
          if (
            peers.some(
              (other) =>
                other.id !== p.id &&
                other.sitting &&
                other.seatId === seat.seatId &&
                (other.seatIndex ?? 0) === seat.seatIndex,
            )
          )
            return send(conn.ws, { t: "seatRejected", reason: "occupied" });
          const kv = await this.kv();
          if (!(await kv.claim(`seat:${conn.groupId}:${seat.seatId}:${seat.seatIndex}`, p.conn, 90)))
            return send(conn.ws, { t: "seatRejected", reason: "occupied" });
          if (p.seatId && (p.seatId !== seat.seatId || p.seatIndex !== seat.seatIndex))
            await this.releaseSeat(conn);
          Object.assign(p, seat, { moving: false });
        } else {
          await this.releaseSeat(conn);
          delete p.seatId;
          delete p.seatIndex;
        }
        p.sitting = m.sitting;
        p.avatarAction = "idle";
        this.sendLife(room, conn);
        return this.broadcastUpdate(conn);
      }

      case "status":
        p.status = m.status;
        p.manualStatus = m.manual;
        conn.autoAway = false;
        conn.autoMeeting = false;
        if (m.status !== "busy") p.allowedPeers = [];
        return this.broadcastUpdate(conn);

      case "media": {
        if (!can(conn.role, "useMedia")) return;
        let screen = m.screen;
        if (screen && !p.media.screen) {
          // FR-24: satu penyaji aktif per percakapan sekitar.
          const others = await this.readPresence(room);
          const presenter = others.find(
            (o) => o.id !== p.id && o.media.screen && pairVolume(room.map, p, o) > 0,
          );
          if (presenter) {
            screen = false;
            send(conn.ws, { t: "screenRejected", presenterId: presenter.id });
          }
        }
        p.media = { mic: m.mic, cam: m.cam, screen };
        return this.broadcastUpdate(conn);
      }

      case "chat":
        return this.onChat(room, conn, m);

      case "emote": {
        const now = Date.now();
        conn.emoteTimes = conn.emoteTimes.filter((t) => now - t < CHAT_WINDOW_MS);
        if (conn.emoteTimes.length >= CHAT_MAX_PER_WINDOW) return;
        conn.emoteTimes.push(now);
        await publishToRoom(conn.groupId, { msg: { t: "emote", id: conn.userId, emoji: m.emoji } });
        return;
      }

      case "signal": {
        const isBye =
          typeof m.data === "object" && m.data !== null && (m.data as { type?: string }).type === "bye";
        // Server hanya meneruskan sinyal WebRTC antara orang yang memang boleh saling mendengar.
        // Cache dipakai dulu; bila tujuan belum ada (baru masuk) atau belum lolos, baca ulang dari Redis.
        const allowed = (list: Presence[]) => {
          const target = list.find((o) => o.id === m.to);
          return !!target && (isBye || this.canSignal(room, p, target));
        };
        if (!allowed(await this.readPresenceCached(room))) {
          this.presenceCache.delete(room.groupId);
          if (!allowed(await this.readPresenceCached(room))) return;
        }
        await publishToRoom(conn.groupId, {
          to: [m.to],
          msg: { t: "signal", from: conn.userId, data: m.data },
        });
        return;
      }

      case "knock":
        return this.onKnock(room, conn, m);

      case "music":
        return this.onMusic(room, conn, m);

      case "teleport":
        this.tickLife(room, conn);
        return this.onTeleport(room, conn, m.toUserId);

      case "consume":
        return this.onConsume(room, conn, m);

      case "tv":
        return this.onTv(room, conn, m);

      case "lockZone": {
        // Hanya pemegang ruangan (orang pertama yang masuk) yang bisa mengunci/membuka, dari dalam.
        const zone = room.map.zones.find((z) => z.id === m.zoneId);
        if (!zone || !isLockable(zone) || privateZoneAt(room.map, p.x, p.y)?.id !== zone.id) return;
        const st = await this.zoneState(room, zone.id);
        if (!st || st.masterId !== conn.userId) return send(conn.ws, { t: "error", code: "notRoomMaster" });
        if (m.locked) {
          if (!m.pin || !/^\d{4,6}$/.test(m.pin)) return send(conn.ws, { t: "error", code: "badPin" });
          await this.saveZone(room, zone.id, {
            ...st,
            locked: true,
            pinHash: pinHash(room.groupId, zone.id, m.pin),
          });
        } else await this.saveZone(room, zone.id, { ...st, locked: false, pinHash: undefined });
        return this.publishLocks(room);
      }

      case "zonePin": {
        const zone = room.map.zones.find((z) => z.id === m.zoneId);
        if (!zone || !isLockable(zone)) return;
        const now = Date.now();
        conn.pinTimes = conn.pinTimes.filter((t) => now - t < 60_000);
        if (conn.pinTimes.length >= 5) return send(conn.ws, { t: "error", code: "rateLimited" });
        conn.pinTimes.push(now);
        const st = await this.zoneState(room, zone.id);
        const ok = !st?.locked || st.pinHash === pinHash(room.groupId, zone.id, m.pin);
        if (ok) {
          p.allowedZone = zone.id;
          await this.broadcastUpdate(conn);
        }
        return send(conn.ws, { t: "pinResult", zoneId: zone.id, ok });
      }

      case "knockReply":
        return this.onKnockReply(room, conn, m);
    }
  }

  private async readLocks(room: Room): Promise<Record<string, ZoneLock>> {
    const kv = await this.kv();
    const raw = await kv.hgetall(keys.locks(room.groupId));
    const out: Record<string, ZoneLock> = {};
    for (const [id, v] of Object.entries(raw)) {
      if (!room.map.zones.some((z) => z.id === id && isLockable(z))) continue;
      const st = JSON.parse(v) as StoredZone;
      // PIN tidak pernah dikirim ke klien.
      out[id] = { masterId: st.masterId, masterName: st.masterName, locked: st.locked };
    }
    return out;
  }

  private async zoneState(room: Room, zoneId: string): Promise<StoredZone | null> {
    const kv = await this.kv();
    const raw = await kv.hget(keys.locks(room.groupId), zoneId);
    return raw ? (JSON.parse(raw) as StoredZone) : null;
  }

  /** Terkunci = ada pemegang dan sudah diberi PIN. */
  private async lockOf(room: Room, zoneId: string): Promise<boolean> {
    return !!(await this.zoneState(room, zoneId))?.locked;
  }

  private async saveZone(room: Room, zoneId: string, st: StoredZone | null) {
    const kv = await this.kv();
    if (st) await kv.hset(keys.locks(room.groupId), zoneId, JSON.stringify(st));
    else await kv.hdel(keys.locks(room.groupId), zoneId);
  }

  private async publishLocks(room: Room) {
    await publishToRoom(room.groupId, { msg: { t: "locks", locks: await this.readLocks(room) } });
  }

  /** Orang pertama yang masuk ruangan yang bisa dikunci menjadi pemegangnya. */
  private async enterZone(room: Room, conn: Conn, zone: Zone) {
    if (!isLockable(zone)) return;
    const st = await this.zoneState(room, zone.id);
    if (st) {
      const masterInside = (await this.readPresence(room)).some(
        (o) => o.id === st.masterId && privateZoneAt(room.map, o.x, o.y)?.id === zone.id,
      );
      if (masterInside) return;
    }
    await this.saveZone(room, zone.id, {
      masterId: conn.userId,
      masterName: conn.presence.name,
      locked: st?.locked ?? false,
      pinHash: st?.pinHash,
    });
    await this.publishLocks(room);
  }

  /**
   * Pemegang keluar: peran (beserta kunci & PIN) pindah ke orang lain yang masih di dalam;
   * bila ruangan kosong, kunci direset.
   */
  private async leaveZone(room: Room, userId: string, zone: Zone) {
    if (!isLockable(zone)) return;
    const st = await this.zoneState(room, zone.id);
    if (!st) return;
    // Kehadiran orang yang baru pindah/keluar sudah ditulis sebelum fungsi ini dipanggil.
    const inside = (await this.readPresence(room)).filter(
      (o) => o.id !== userId && privateZoneAt(room.map, o.x, o.y)?.id === zone.id,
    );
    if (!inside.length) {
      await this.saveZone(room, zone.id, null);
      return this.publishLocks(room);
    }
    if (st.masterId !== userId) return;
    const next = inside[0];
    await this.saveZone(room, zone.id, { ...st, masterId: next.id, masterName: next.name });
    await this.publishLocks(room);
  }

  /** Masuk ruang privat (rapat) otomatis menjadi "sedang rapat"; keluar mengembalikan "aktif". */
  private autoMeetingStatus(room: Room, conn: Conn) {
    const p = conn.presence;
    const inMeeting = !!privateZoneAt(room.map, p.x, p.y);
    if (inMeeting && p.status === "active") {
      p.status = "meeting";
      conn.autoMeeting = true;
    } else if (!inMeeting && conn.autoMeeting) {
      if (p.status === "meeting") p.status = "active";
      conn.autoMeeting = false;
    }
  }

  /**
   * Lompat ke dekat rekan (FR-32): ditolak bila rekan sedang sibuk (kecuali sudah diizinkan lewat ketuk),
   * atau bila rekan ada di ruang privat yang belum mengizinkan kita.
   */
  private async onTeleport(room: Room, conn: Conn, toUserId: string) {
    const p = conn.presence;
    const others = (await this.readPresence(room)).filter((o) => o.id !== conn.userId);
    const target = others.find((o) => o.id === toUserId);
    const reject = (reason: "busy" | "privateZone" | "noSpace" | "offline") =>
      send(conn.ws, { t: "teleportRejected", reason });
    if (!target) return reject("offline");
    const allowed = target.allowedPeers.includes(p.id) || p.allowedPeers.includes(target.id);
    if (target.status === "busy" && !allowed) return reject("busy");
    const zone = privateZoneAt(room.map, target.x, target.y);
    if (zone && p.allowedZone !== zone.id && !allowed && (await this.lockOf(room, zone.id)))
      return reject("privateZone");
    const fromZone = privateZoneAt(room.map, p.x, p.y);

    // Tile kosong terdekat di sekitar rekan, di area yang sama.
    const tx = Math.floor(target.x);
    const ty = Math.floor(target.y);
    let spot: { x: number; y: number } | null = null;
    for (let r = 1; r <= 3 && !spot; r++)
      for (const [dx, dy] of [
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
        [r, r],
        [-r, r],
        [r, -r],
        [-r, -r],
      ]) {
        const x = tx + dx + 0.5;
        const y = ty + dy + 0.5;
        if (!this.isWalkable(room, x, y)) continue;
        if (privateZoneAt(room.map, x, y)?.id !== zone?.id) continue;
        if (others.some((o) => Math.hypot(o.x - x, o.y - y) < 0.8)) continue;
        spot = { x, y };
        break;
      }
    if (!spot) return reject("noSpace");
    if (zone) p.allowedZone = zone.id;
    else if (privateZoneAt(room.map, p.x, p.y)) p.allowedZone = null;
    p.x = spot.x;
    p.y = spot.y;
    p.moving = false;
    p.sitting = false;
    p.dir = target.x > spot.x ? "right" : target.x < spot.x ? "left" : target.y > spot.y ? "down" : "up";
    this.autoMeetingStatus(room, conn);
    send(conn.ws, { t: "teleported", x: spot.x, y: spot.y, toName: target.name });
    await this.broadcastUpdate(conn);
    if (fromZone && fromZone.id !== zone?.id) await this.leaveZone(room, conn.userId, fromZone);
    if (zone && zone.id !== fromZone?.id) await this.enterZone(room, conn, zone);
  }

  private async readTv(room: Room): Promise<TvState[]> {
    const kv = await this.kv();
    const raw = await kv.hgetall(keys.tv(room.groupId));
    return Object.values(raw)
      .map((v) => JSON.parse(v) as TvState)
      .filter((s) => room.map.objects.some((o) => o.id === s.objectId && o.kind === "tv"));
  }

  /** Putar/hentikan video YouTube di TV. Hanya anggota (bukan tamu) yang berdiri di dekat TV. */
  private async onTv(room: Room, conn: Conn, m: Extract<ClientMessage, { t: "tv" }>) {
    if (!can(conn.role, "controlMusic")) return send(conn.ws, { t: "error", code: "forbidden" });
    const obj = room.map.objects.find((o) => o.id === m.objectId && o.kind === "tv");
    if (!obj) return;
    if (distanceToObject(obj, conn.presence.x, conn.presence.y) > TV_CONTROL_RANGE)
      return send(conn.ws, { t: "error", code: "tooFar" });
    const now = Date.now();
    conn.musicTimes = conn.musicTimes.filter((t) => now - t < 10_000);
    if (conn.musicTimes.length >= 6) return send(conn.ws, { t: "error", code: "rateLimited" });
    conn.musicTimes.push(now);
    const kv = await this.kv();
    let state: TvState | null = null;
    if (m.action === "play") {
      const videoId = youtubeId(m.url ?? "");
      if (!videoId) return send(conn.ws, { t: "error", code: "badVideo" });
      state = { objectId: obj.id, videoId, startedAt: now, by: conn.userId, byName: conn.presence.name };
      await kv.hset(keys.tv(room.groupId), obj.id, JSON.stringify(state));
    } else await kv.hdel(keys.tv(room.groupId), obj.id);
    await publishToRoom(conn.groupId, { msg: { t: "tv", objectId: obj.id, state, serverNow: Date.now() } });
  }

  private async readMusic(room: Room): Promise<MusicState[]> {
    const kv = await this.kv();
    const raw = await kv.hgetall(keys.music(room.groupId));
    return Object.values(raw)
      .map((v) => JSON.parse(v) as MusicState)
      .filter((s) => room.map.objects.some((o) => o.id === s.objectId && o.kind === "speaker"));
  }

  /** Putar/hentikan musik di speaker. Hanya anggota (bukan tamu) yang berdiri di dekat speaker. */
  private async onMusic(room: Room, conn: Conn, m: Extract<ClientMessage, { t: "music" }>) {
    if (!can(conn.role, "controlMusic")) return send(conn.ws, { t: "error", code: "forbidden" });
    const obj = room.map.objects.find((o) => o.id === m.objectId && o.kind === "speaker");
    if (!obj) return;
    if (distanceToObject(obj, conn.presence.x, conn.presence.y) > SPEAKER_CONTROL_RANGE)
      return send(conn.ws, { t: "error", code: "tooFar" });
    const now = Date.now();
    conn.musicTimes = conn.musicTimes.filter((t) => now - t < 10_000);
    if (conn.musicTimes.length >= 6) return send(conn.ws, { t: "error", code: "rateLimited" });
    conn.musicTimes.push(now);

    const kv = await this.kv();
    let state: MusicState | null = null;
    if (m.action === "play" && m.source) {
      state = {
        objectId: obj.id,
        source: m.source,
        startedAt: now,
        by: conn.userId,
        byName: conn.presence.name,
      };
      await kv.hset(keys.music(room.groupId), obj.id, JSON.stringify(state));
    } else {
      await kv.hdel(keys.music(room.groupId), obj.id);
    }
    await publishToRoom(conn.groupId, {
      msg: { t: "music", objectId: obj.id, state, serverNow: Date.now() },
    });
  }

  private canSignal(room: Room, a: Presence, b: Presence): boolean {
    if (pairVolume(room.map, a, b) > 0) return true;
    // Sedikit toleransi agar negosiasi tidak gagal saat seseorang berada tepat di batas radius.
    const slack = { ...room.map, audio: { ...room.map.audio, radius: room.map.audio.radius + 2 } };
    return pairVolume(slack, a, b) > 0;
  }

  private async onChat(room: Room, conn: Conn, m: Extract<ClientMessage, { t: "chat" }>) {
    const now = Date.now();
    conn.chatTimes = conn.chatTimes.filter((t) => now - t < CHAT_WINDOW_MS);
    if (conn.chatTimes.length >= CHAT_MAX_PER_WINDOW)
      return send(conn.ws, { t: "error", code: "rateLimited" });
    conn.chatTimes.push(now);

    const body = m.body.trim();
    if (!body) return;
    const msg: ChatMessage = {
      id: newId(),
      groupId: conn.groupId,
      kind: m.kind,
      channelId: null,
      toUserId: null,
      senderId: conn.userId,
      senderName: conn.presence.name,
      body,
      createdAt: new Date().toISOString(),
    };

    if (m.kind === "channel") {
      if (!can(conn.role, "sendChannelMessage")) return send(conn.ws, { t: "error", code: "forbidden" });
      if (!m.channelId || !(await repo.channelInGroup(m.channelId, conn.groupId))) return;
      msg.channelId = m.channelId;
      this.pendingMessages.push(msg);
      await publishToRoom(conn.groupId, { msg: { t: "chat", message: msg } });
    } else if (m.kind === "dm") {
      if (!m.toUserId || m.toUserId === conn.userId || !(await repo.getRole(m.toUserId, conn.groupId)))
        return;
      msg.toUserId = m.toUserId;
      this.pendingMessages.push(msg);
      await publishToRoom(conn.groupId, { to: [conn.userId, m.toUserId], msg: { t: "chat", message: msg } });
    } else {
      // Percakapan sekitar: hanya untuk orang yang sedang bisa didengar; tidak disimpan.
      const others = await this.readPresence(room);
      const to = others
        .filter((o) => o.id === conn.userId || pairVolume(room.map, conn.presence, o) > 0)
        .map((o) => o.id);
      await publishToRoom(conn.groupId, { to, msg: { t: "chat", message: msg } });
    }
  }

  private async onKnock(room: Room, conn: Conn, m: Extract<ClientMessage, { t: "knock" }>) {
    const kv = await this.kv();
    const others = (await this.readPresence(room)).filter((o) => o.id !== conn.userId);
    let to: string[] = [];
    let zoneId: string | null = null;
    if (m.zoneId) {
      const zone = room.map.zones.find((z) => z.id === m.zoneId && z.private);
      if (!zone) return;
      zoneId = zone.id;
      to = others.filter((o) => privateZoneAt(room.map, o.x, o.y)?.id === zone.id).map((o) => o.id);
      if (!to.length || !(await this.lockOf(room, zone.id))) {
        // Tidak dikunci (atau kosong): langsung boleh masuk.
        conn.presence.allowedZone = zone.id;
        await this.broadcastUpdate(conn);
        return send(conn.ws, { t: "knockResult", knockId: "", accept: true, byName: "", zoneId });
      }
    } else if (m.toUserId) {
      if (!others.some((o) => o.id === m.toUserId)) return;
      to = [m.toUserId];
    } else return;

    const knockId = newId();
    await kv.set(
      keys.knock(knockId),
      JSON.stringify({ from: conn.userId, fromName: conn.presence.name, zoneId, to }),
      120,
    );
    await publishToRoom(conn.groupId, {
      to,
      msg: { t: "knock", knockId, from: conn.userId, fromName: conn.presence.name, zoneId },
    });
  }

  private async onKnockReply(room: Room, conn: Conn, m: Extract<ClientMessage, { t: "knockReply" }>) {
    const kv = await this.kv();
    const raw = await kv.get(keys.knock(m.knockId));
    if (!raw) return;
    const knock = JSON.parse(raw) as { from: string; zoneId: string | null; to: string[] };
    if (!knock.to.includes(conn.userId)) return;
    await kv.del(keys.knock(m.knockId));
    if (m.accept) {
      if (knock.zoneId) {
        await publishToRoom(conn.groupId, {
          control: { kind: "grantZone", userId: knock.from, zoneId: knock.zoneId },
        });
      } else {
        await publishToRoom(conn.groupId, {
          control: { kind: "grantPeer", userId: knock.from, peerId: conn.userId },
        });
        await publishToRoom(conn.groupId, {
          control: { kind: "grantPeer", userId: conn.userId, peerId: knock.from },
        });
      }
    }
    const result: ServerMessage = {
      t: "knockResult",
      knockId: m.knockId,
      accept: m.accept,
      byName: conn.presence.name,
      zoneId: knock.zoneId,
    };
    // Penerima ketuk lain juga diberi tahu agar dialognya tertutup.
    await publishToRoom(conn.groupId, {
      to: [knock.from, ...knock.to.filter((id) => id !== conn.userId)],
      msg: result,
    });
  }

  /** Pesan dari kanal pub/sub ruangan (bisa berasal dari instance lain atau dari route API). */
  private onBus(room: Room, raw: string) {
    const env = JSON.parse(raw) as Envelope;
    if (env.control) void this.onControl(room, env.control);
    if (!env.msg) return;
    const data = JSON.stringify(env.msg);
    for (const c of room.conns.values()) {
      if (env.to && !env.to.includes(c.userId)) continue;
      if (c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
    }
  }

  private async onControl(room: Room, ctl: NonNullable<Envelope["control"]>) {
    if (ctl.kind === "pairPose") {
      for (const id of [ctl.a, ctl.b]) {
        const conn = room.conns.get(id);
        if (!conn) continue;
        const first = id === ctl.a;
        Object.assign(conn.presence, {
          moving: false,
          dir: directionFrom(
            first ? ctl.bx - ctl.ax : ctl.ax - ctl.bx,
            first ? ctl.by - ctl.ay : ctl.ay - ctl.by,
            conn.presence.dir,
          ),
          avatarAction: ctl.action,
          pairedAction: {
            partnerId: first ? ctl.b : ctl.a,
            startedAt: ctl.startedAt,
            expiresAt: ctl.expiresAt,
          },
        });
        await this.broadcastUpdate(conn);
        const timer = setTimeout(
          () => {
            if (
              conn.ws.readyState !== WebSocket.OPEN ||
              conn.presence.pairedAction?.startedAt !== ctl.startedAt
            )
              return;
            delete conn.presence.pairedAction;
            conn.presence.avatarAction = "idle";
            void this.broadcastUpdate(conn);
          },
          Math.max(0, ctl.expiresAt - Date.now()),
        );
        timer.unref();
      }
      return;
    }
    if (ctl.kind === "map") {
      const templateChanged = room.map.template !== ctl.map.template;
      const geometryChanged =
        room.map.width !== ctl.map.width ||
        room.map.height !== ctl.map.height ||
        room.map.tiles.join("") !== ctl.map.tiles.join("");
      room.map = ctl.map;
      room.walkable = buildWalkable(ctl.map);
      for (const c of room.conns.values()) send(c.ws, { t: "map", map: ctl.map });
      if (!templateChanged && !geometryChanged) {
        for (const c of room.conns.values()) {
          const seat = ctl.map.objects.find((o) => o.id === c.presence.seatId);
          if (c.presence.sitting && seat) {
            await this.releaseSeat(c);
            Object.assign(c.presence, seatPose(ctl.map, seat, c.presence.seatIndex));
            send(c.ws, { t: "teleported", x: c.presence.x, y: c.presence.y, toName: "" });
            await this.broadcastUpdate(c);
          } else if (!this.isWalkable(room, c.presence.x, c.presence.y) || (c.presence.sitting && !seat)) {
            await this.releaseSeat(c);
            const spot = this.freeSpawn(room, []);
            Object.assign(c.presence, spot, { sitting: false, moving: false });
            delete c.presence.seatId;
            send(c.ws, { t: "teleported", x: spot.x, y: spot.y, toName: "" });
            await this.broadcastUpdate(c);
          }
        }
        return;
      }
      // Tata ruang baru: pindahkan semua orang ke titik muncul baru, buka semua kunci.
      const kv = await this.kv();
      for (const id of Object.keys(await kv.hgetall(keys.locks(room.groupId))))
        await kv.hdel(keys.locks(room.groupId), id);
      const placed: Presence[] = [];
      for (const c of room.conns.values()) {
        await this.releaseSeat(c);
        const spot = this.freeSpawn(room, placed);
        Object.assign(c.presence, {
          ...spot,
          moving: false,
          sitting: false,
          allowedZone: null,
          avatarAction: "idle",
        });
        delete c.presence.seatId;
        delete c.presence.seatIndex;
        delete c.presence.pairedAction;
        placed.push(c.presence);
        send(c.ws, { t: "teleported", x: spot.x, y: spot.y, toName: "" });
        await this.broadcastUpdate(c);
      }
      for (const c of room.conns.values()) send(c.ws, { t: "locks", locks: {} });
      return;
    }
    if (ctl.kind === "life") {
      // Hitung sampai sekarang dengan pengaturan lama, lalu pakai yang baru.
      for (const c of room.conns.values()) this.tickLife(room, c);
      room.life = ctl.life;
      for (const c of room.conns.values()) this.sendLife(room, c);
      return;
    }
    if (ctl.kind === "groupDeleted") {
      for (const c of [...room.conns.values()]) this.closeConn(room, c, "groupDeleted");
      return;
    }
    const conn = room.conns.get(ctl.userId);
    if (!conn) return;
    switch (ctl.kind) {
      case "replaced":
        if (conn.presence.conn === ctl.conn) return;
        this.closeConn(room, conn, "replaced", false);
        // Koneksi baru ada di instance lain: simpan gaji & bar koneksi lama (kredit koin bersifat relatif).
        return this.persistLife(room, conn).catch(() => {});
      case "membership":
        if (!ctl.role) return this.closeConn(room, conn, "removed");
        conn.role = ctl.role;
        conn.presence.role = ctl.role;
        return this.broadcastUpdate(conn);
      case "profile":
        conn.presence.name = ctl.name;
        conn.presence.avatar = ctl.avatar;
        conn.presence.statusText = ctl.statusText;
        conn.statusExpiresAt = ctl.statusExpiresAt ? Date.parse(ctl.statusExpiresAt) : null;
        return this.broadcastUpdate(conn);
      case "grantZone":
        conn.presence.allowedZone = ctl.zoneId;
        return this.broadcastUpdate(conn);
      case "grantPeer":
        if (!conn.presence.allowedPeers.includes(ctl.peerId)) conn.presence.allowedPeers.push(ctl.peerId);
        return this.broadcastUpdate(conn);
    }
  }

  // ------------------------------------------------------------ karakter hidup & koin (Fase 2)

  private lifeState(room: Room, conn: Conn): LifeState {
    const p = conn.presence;
    return {
      needs: conn.needs,
      coins: conn.wallet.coins,
      earnedToday: conn.wallet.earnedDay === dayKey(Date.now()) ? conn.wallet.earnedToday : 0,
      rest: restKindAt(room.map, p.x, p.y, p.sitting),
      settings: room.life,
    };
  }

  private sendLife(room: Room, conn: Conn) {
    send(conn.ws, { t: "life", life: this.lifeState(room, conn) });
  }

  /** Hitung bar kebutuhan dan gaji sampai sekarang (murah: hanya aritmetika, tanpa I/O). */
  private tickLife(room: Room, conn: Conn, now = Date.now()) {
    const dt = now - conn.needsAt;
    conn.needsAt = now;
    if (dt <= 0) return;
    const p = conn.presence;
    conn.needs = tickNeeds(conn.needs, dt, room.life, restKindAt(room.map, p.x, p.y, p.sitting));

    // FR-53: gaji hanya untuk waktu aktif (ada aktivitas dalam aplikasi), tidak saat jauh dari layar.
    const s = room.life;
    if (!s.enabled || !s.salary || p.status === "away" || now - p.lastActive > AWAY_AFTER_MS) return;
    conn.activeMs += dt;
    const per = msPerCoin(s);
    const earned = Math.floor(conn.activeMs / per);
    if (earned <= 0) return;
    conn.activeMs -= earned * per;
    const day = dayKey(now);
    if (conn.wallet.earnedDay !== day) conn.wallet = { ...conn.wallet, earnedDay: day, earnedToday: 0 };
    const add = Math.min(earned, Math.max(0, s.dailyCap - conn.wallet.earnedToday));
    if (add <= 0) return;
    conn.wallet.earnedToday += add;
    conn.wallet.coins += add;
    conn.pendingCoins += add;
  }

  private async saveNeeds(conn: Conn) {
    conn.needsSavedAt = Date.now();
    const kv = await this.kv();
    await kv.set(keys.needs(conn.groupId, conn.userId), JSON.stringify(conn.needs), NEEDS_TTL);
  }

  private async flushWallet(conn: Conn) {
    const amount = conn.pendingCoins;
    if (amount <= 0) return;
    conn.pendingCoins = 0;
    try {
      const w = await repo.creditWallet(conn.userId, conn.groupId, amount, dayKey(Date.now()));
      if (w) conn.wallet = { ...w, coins: w.coins + conn.pendingCoins };
    } catch (e) {
      conn.pendingCoins += amount;
      throw e;
    }
  }

  /** Simpan semuanya sebelum koneksi dilepas: pesanan yang sudah dibayar langsung disajikan. */
  private async persistLife(room: Room, conn: Conn) {
    if (conn.lifeSaved) return;
    conn.lifeSaved = true;
    if (conn.order) {
      clearTimeout(conn.order.timer);
      await conn.order.serve();
    }
    this.tickLife(room, conn);
    await this.saveNeeds(conn);
    await this.flushWallet(conn);
  }

  /** Makan/minum dari mesin penjual, mesin kopi, dispenser, kulkas, atau dapur (FR-51, FR-54, FR-55). */
  private async onConsume(room: Room, conn: Conn, m: Extract<ClientMessage, { t: "consume" }>) {
    const p = conn.presence;
    const reject = (reason: "coins" | "tooFar" | "disabled" | "busy") =>
      send(conn.ws, { t: "shopRejected", reason });
    if (!room.life.enabled) return reject("disabled");
    const obj = room.map.objects.find((o) => o.id === m.objectId);
    const venue = obj ? venueOf(obj) : null;
    const entry = venue ? menuEntry(venue, m.item) : null;
    if (!obj || !entry) return;
    if (distanceToObject(obj, p.x, p.y) > SHOP_RANGE) return reject("tooFar");
    const now = Date.now();
    conn.shopTimes = conn.shopTimes.filter((t) => now - t < 10_000);
    if (conn.order || conn.shopBusy || conn.shopTimes.length >= 6) return reject("busy");
    conn.shopTimes.push(now);
    conn.shopBusy = true;
    try {
      this.tickLife(room, conn);
      if (entry.price > 0) {
        await this.flushWallet(conn);
        const coins = await repo.spendWallet(conn.userId, conn.groupId, entry.price);
        if (coins === null) {
          this.sendLife(room, conn);
          return reject("coins");
        }
        conn.wallet = { ...conn.wallet, coins: coins + conn.pendingCoins };
      }
      const item = ITEMS[entry.item];
      const serve = async () => {
        conn.order = null;
        this.tickLife(room, conn);
        conn.needs = applyItem(conn.needs, item);
        send(conn.ws, { t: "consumed", item: item.id, price: entry.price });
        this.sendLife(room, conn);
        await this.saveNeeds(conn);
        await publishToRoom(conn.groupId, { msg: { t: "emote", id: conn.userId, emoji: item.emoji } });
      };
      if (entry.waitMs > 0) {
        // Kantin & mesin kopi: dibayar sekarang, siap setelah menunggu sebentar.
        send(conn.ws, { t: "order", item: item.id, waitMs: entry.waitMs });
        this.sendLife(room, conn);
        conn.order = {
          serve,
          timer: setTimeout(
            () => void serve().catch((e) => console.error("[realtime] pesanan gagal", e)),
            entry.waitMs,
          ),
        };
      } else await serve();
    } finally {
      conn.shopBusy = false;
    }
  }

  private async heartbeat() {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      for (const conn of room.conns.values()) {
        const p = conn.presence;
        this.tickLife(room, conn, now);
        if (now - conn.needsSavedAt >= NEEDS_SAVE_MS) await this.saveNeeds(conn);
        if (conn.pendingCoins >= WALLET_FLUSH_COINS)
          await this.flushWallet(conn).catch((e) => console.error("[realtime] gagal mencairkan gaji", e));
        this.sendLife(room, conn);
        // Status kustom yang sudah lewat waktunya dihapus dari tampilan.
        if (conn.statusExpiresAt && now >= conn.statusExpiresAt) {
          conn.statusExpiresAt = null;
          p.statusText = null;
          await this.broadcastUpdate(conn);
          continue;
        }
        // FR-30: otomatis "jauh dari layar" setelah 5 menit tanpa aktivitas dalam aplikasi.
        if (p.status === "active" && now - p.lastActive > AWAY_AFTER_MS) {
          p.status = "away";
          conn.autoAway = true;
          await this.broadcastUpdate(conn);
        } else if (now - conn.presenceWrittenAt >= PRESENCE_REFRESH_MS) {
          await this.writePresence(conn);
        }
      }
    }
  }

  async flushMessages() {
    if (!this.pendingMessages.length) return;
    const batch = this.pendingMessages.splice(0, this.pendingMessages.length);
    try {
      await repo.insertMessages(batch);
    } catch (e) {
      // Satu pesan yang kanalnya/pengirimnya sudah dihapus (pelanggaran foreign key) jangan
      // sampai menahan pesan lain: simpan satu per satu, buang yang memang tidak bisa disimpan.
      if ((e as { code?: string }).code !== "23503") {
        console.error("[realtime] gagal menyimpan pesan, dicoba lagi", e);
        this.pendingMessages.unshift(...batch);
        return;
      }
      for (const m of batch) await repo.insertMessages([m]).catch(() => {});
    }
  }

  async close() {
    this.timers.forEach(clearInterval);
    await this.flushMessages();
    for (const room of this.rooms.values()) for (const c of room.conns.values()) c.ws.close(1001);
    this.wss.close();
  }
}

const g = globalThis as unknown as { __meetopiaHub?: RealtimeHub };
export function getHub(): RealtimeHub {
  if (!g.__meetopiaHub) g.__meetopiaHub = new RealtimeHub();
  return g.__meetopiaHub;
}
