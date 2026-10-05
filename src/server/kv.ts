/**
 * Penyimpanan kehadiran + pub/sub (aturan 1 & 3 di PRD).
 * Produksi: Redis (REDIS_URL) agar beberapa instance server real-time tetap sinkron.
 * Pengembangan: implementasi dalam memori (hanya valid untuk satu proses).
 */
import { EventEmitter } from "node:events";
import { redisUrl } from "./env";

export interface Kv {
  hset(key: string, field: string, value: string): Promise<void>;
  hget(key: string, field: string): Promise<string | null>;
  hdel(key: string, field: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  publish(channel: string, message: string): Promise<void>;
  /** Mengembalikan fungsi untuk berhenti berlangganan. */
  subscribe(channel: string, handler: (message: string) => void): Promise<() => Promise<void>>;
}

class MemoryKv implements Kv {
  private hashes = new Map<string, Map<string, string>>();
  private values = new Map<string, { v: string; exp: number }>();
  private bus = new EventEmitter().setMaxListeners(0);

  async hset(key: string, field: string, value: string) {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    this.hashes.get(key)!.set(field, value);
  }
  async hget(key: string, field: string) {
    return this.hashes.get(key)?.get(field) ?? null;
  }
  async hdel(key: string, field: string) {
    this.hashes.get(key)?.delete(field);
  }
  async hgetall(key: string) {
    return Object.fromEntries(this.hashes.get(key) ?? []);
  }
  async set(key: string, value: string, ttl: number) {
    this.values.set(key, { v: value, exp: Date.now() + ttl * 1000 });
  }
  async get(key: string) {
    const e = this.values.get(key);
    if (!e) return null;
    if (e.exp < Date.now()) {
      this.values.delete(key);
      return null;
    }
    return e.v;
  }
  async del(key: string) {
    this.values.delete(key);
  }
  async publish(channel: string, message: string) {
    // Asinkron seperti Redis sungguhan.
    queueMicrotask(() => this.bus.emit(channel, message));
  }
  async subscribe(channel: string, handler: (m: string) => void) {
    this.bus.on(channel, handler);
    return async () => {
      this.bus.off(channel, handler);
    };
  }
}

async function createRedisKv(url: string): Promise<Kv> {
  const { Redis } = await import("ioredis");
  const cmd = new Redis(url, { maxRetriesPerRequest: 3 });
  const sub = new Redis(url, { maxRetriesPerRequest: null });
  const handlers = new Map<string, Set<(m: string) => void>>();
  sub.on("message", (ch: string, msg: string) => handlers.get(ch)?.forEach((h) => h(msg)));
  return {
    async hset(k, f, v) {
      await cmd.hset(k, f, v);
    },
    hget: (k, f) => cmd.hget(k, f),
    async hdel(k, f) {
      await cmd.hdel(k, f);
    },
    hgetall: (k) => cmd.hgetall(k),
    async set(k, v, ttl) {
      await cmd.set(k, v, "EX", ttl);
    },
    get: (k) => cmd.get(k),
    async del(k) {
      await cmd.del(k);
    },
    async publish(ch, m) {
      await cmd.publish(ch, m);
    },
    async subscribe(ch, h) {
      if (!handlers.has(ch)) {
        handlers.set(ch, new Set());
        await sub.subscribe(ch);
      }
      handlers.get(ch)!.add(h);
      return async () => {
        const set = handlers.get(ch);
        set?.delete(h);
        if (set && set.size === 0) {
          handlers.delete(ch);
          await sub.unsubscribe(ch);
        }
      };
    },
  };
}

const g = globalThis as unknown as { __meetopiaKv?: Promise<Kv> };

export function getKv(): Promise<Kv> {
  if (!g.__meetopiaKv) {
    const url = redisUrl();
    g.__meetopiaKv = url ? createRedisKv(url) : Promise.resolve(new MemoryKv());
  }
  return g.__meetopiaKv;
}

export const keys = {
  presence: (groupId: string) => `presence:${groupId}`,
  lastPosition: (groupId: string, userId: string) => `lastpos:${groupId}:${userId}`,
  roomChannel: (groupId: string) => `room:${groupId}`,
  knock: (knockId: string) => `knock:${knockId}`,
  music: (groupId: string) => `music:${groupId}`,
  locks: (groupId: string) => `locks:${groupId}`,
  tv: (groupId: string) => `tv:${groupId}`,
};
