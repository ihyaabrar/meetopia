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
import { getKv, keys, type Kv } from "@/server/kv";
import { one } from "@/server/db";
import { newId } from "@/server/ids";
import * as repo from "@/server/repo";
import { buildWalkable, distanceToObject, privateZoneAt, type MapData } from "@/shared/map";
import { SPEAKER_CONTROL_RANGE, type MusicState } from "@/shared/music";
import { pairVolume } from "@/shared/proximity";
import { sanitizeAvatar } from "@/shared/avatar";
import { can, type Role } from "@/shared/roles";
import {
  clientMessageSchema,
  type ChatMessage,
  type ClientMessage,
  type Presence,
  type ServerMessage,
} from "@/shared/protocol";
import { publishToRoom, type Envelope } from "./bus";

const AWAY_AFTER_MS = 5 * 60_000;
const PRESENCE_STALE_MS = 90_000;
const HEARTBEAT_MS = 20_000;
const LEAVE_GRACE_MS = 3_000;
const LAST_POSITION_TTL = 24 * 3600;
const CHAT_WINDOW_MS = 5_000;
const CHAT_MAX_PER_WINDOW = 6;

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
}

interface Room {
  groupId: string;
  conns: Map<string, Conn>;
  map: MapData;
  walkable: boolean[][];
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
          const map = await repo.getMap(groupId);
          const kv = await this.kv();
          const room: Room = {
            groupId,
            conns: new Map(),
            map,
            walkable: buildWalkable(map),
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
    const user = await one<{ name: string; avatar: unknown }>(
      "SELECT name, avatar FROM users WHERE id = $1",
      [auth.userId],
    );
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
    if (!saved || (z && all.some((p) => privateZoneAt(room.map, p.x, p.y)?.id === z.id))) {
      pos = this.freeSpawn(room, all);
    }

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
      // Aturan 8: mikrofon dan kamera mati saat masuk.
      media: { mic: false, cam: false, screen: false },
      allowedZone: privateZoneAt(room.map, pos.x, pos.y)?.id ?? null,
      allowedPeers: [],
      lastActive: Date.now(),
    };

    // Satu koneksi per pengguna per grup: tutup koneksi lama (di instance mana pun).
    const old = room.conns.get(auth.userId);
    if (old) this.closeConn(room, old, "replaced", false);
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
    };
    room.conns.set(auth.userId, conn);
    await this.writePresence(conn);

    const peers = (await this.readPresence(room)).filter((p) => p.id !== auth.userId);
    send(ws, {
      t: "welcome",
      selfId: auth.userId,
      peers,
      map: room.map,
      sharedNote: await repo.getSharedNote(auth.groupId),
      music: await this.readMusic(room),
      serverNow: Date.now(),
    });
    await publishToRoom(auth.groupId, { msg: { t: "join", peer: presence } });

    ws.on("message", (raw) => {
      let data: unknown;
      try {
        data = JSON.parse(String(raw));
      } catch {
        return;
      }
      const parsed = clientMessageSchema.safeParse(data);
      if (!parsed.success) return send(ws, { t: "error", code: "badMessage" });
      void this.onMessage(room, conn, parsed.data).catch((e) => console.error("[realtime] pesan gagal", e));
    });
    ws.on("close", () => {
      if (room.conns.get(conn.userId) === conn) this.scheduleLeave(room, conn);
    });
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
    await kv.hset(
      keys.presence(conn.groupId),
      conn.userId,
      JSON.stringify({ p: conn.presence, seen: Date.now() }),
    );
  }

  private async broadcastUpdate(conn: Conn) {
    await this.writePresence(conn);
    await publishToRoom(conn.groupId, { msg: { t: "update", peer: conn.presence } });
  }

  private scheduleLeave(room: Room, conn: Conn) {
    room.conns.delete(conn.userId);
    setTimeout(() => void this.finalizeLeave(room, conn), LEAVE_GRACE_MS);
  }

  private async finalizeLeave(room: Room, conn: Conn) {
    const kv = await this.kv();
    await kv.set(
      keys.lastPosition(conn.groupId, conn.userId),
      JSON.stringify({ x: conn.presence.x, y: conn.presence.y }),
      LAST_POSITION_TTL,
    );
    const raw = await kv.hget(keys.presence(conn.groupId), conn.userId);
    if (raw && (JSON.parse(raw) as { p: Presence }).p.conn === conn.presence.conn) {
      await kv.hdel(keys.presence(conn.groupId), conn.userId);
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

      case "move": {
        if (!this.isWalkable(room, m.x, m.y))
          return send(conn.ws, { t: "moveRejected", x: p.x, y: p.y, reason: "privateZone" });
        const zone = privateZoneAt(room.map, m.x, m.y);
        if (zone && p.allowedZone !== zone.id) {
          const others = (await this.readPresence(room)).filter(
            (o) => o.id !== conn.userId && privateZoneAt(room.map, o.x, o.y)?.id === zone.id,
          );
          if (others.length > 0) {
            // Ruang privat terisi dan belum "diketuk": tolak di server (FR-23, FR-31).
            return send(conn.ws, { t: "moveRejected", x: p.x, y: p.y, reason: "privateZone" });
          }
          p.allowedZone = zone.id;
        }
        // Izin masuk dicabut setelah benar-benar keluar dari ruang privat (bukan saat masih di depan pintu).
        if (!zone && privateZoneAt(room.map, p.x, p.y)) p.allowedZone = null;
        p.x = m.x;
        p.y = m.y;
        p.dir = m.dir;
        p.moving = m.moving;
        if (m.moving) p.sitting = false;
        await this.broadcastUpdate(conn);
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

      case "sit":
        p.sitting = m.sitting;
        return this.broadcastUpdate(conn);

      case "status":
        p.status = m.status;
        p.manualStatus = m.manual;
        conn.autoAway = false;
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
        const others = await this.readPresence(room);
        const target = others.find((o) => o.id === m.to);
        if (!target) return;
        const isBye =
          typeof m.data === "object" && m.data !== null && (m.data as { type?: string }).type === "bye";
        // Server hanya meneruskan sinyal WebRTC antara orang yang memang boleh saling mendengar.
        if (!isBye && !this.canSignal(room, p, target)) return;
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

      case "knockReply":
        return this.onKnockReply(room, conn, m);
    }
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
      if (!to.length) {
        // Kosong: langsung boleh masuk.
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
    if (ctl.kind === "map") {
      room.map = ctl.map;
      room.walkable = buildWalkable(ctl.map);
      for (const c of room.conns.values()) send(c.ws, { t: "map", map: ctl.map });
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
        if (conn.presence.conn !== ctl.conn) this.closeConn(room, conn, "replaced", false);
        return;
      case "membership":
        if (!ctl.role) return this.closeConn(room, conn, "removed");
        conn.role = ctl.role;
        conn.presence.role = ctl.role;
        return this.broadcastUpdate(conn);
      case "profile":
        conn.presence.name = ctl.name;
        conn.presence.avatar = ctl.avatar;
        return this.broadcastUpdate(conn);
      case "grantZone":
        conn.presence.allowedZone = ctl.zoneId;
        return this.broadcastUpdate(conn);
      case "grantPeer":
        if (!conn.presence.allowedPeers.includes(ctl.peerId)) conn.presence.allowedPeers.push(ctl.peerId);
        return this.broadcastUpdate(conn);
    }
  }

  private async heartbeat() {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      for (const conn of room.conns.values()) {
        const p = conn.presence;
        // FR-30: otomatis "jauh dari layar" setelah 5 menit tanpa aktivitas dalam aplikasi.
        if (p.status === "active" && now - p.lastActive > AWAY_AFTER_MS) {
          p.status = "away";
          conn.autoAway = true;
          await this.broadcastUpdate(conn);
        } else {
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
