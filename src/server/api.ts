/** Utilitas route API: respons JSON, autentikasi, dan pemeriksaan peran di server (aturan 4). */
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getSessionUser, type SessionUser } from "./auth";
import { getRole } from "./repo";
import { can, type Permission, type Role } from "@/shared/roles";
import { ConfigError } from "./env";
import { getKv } from "./kv";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "unauthorized");
  return user;
}

export async function requirePermission(
  groupId: string,
  permission: Permission,
): Promise<{ user: SessionUser; role: Role }> {
  const user = await requireUser();
  const role = await getRole(user.id, groupId);
  if (!role) throw new ApiError(404, "notFound");
  if (!can(role, permission)) throw new ApiError(403, "forbidden");
  return { user, role };
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw new ApiError(400, "badRequest");
  }
  const r = schema.safeParse(data);
  if (!r.success) throw new ApiError(400, "badRequest");
  return r.data;
}

// ---------- Pembatas laju ----------
// Penghitung disimpan di Redis agar berlaku di semua instance (di Vercel tiap permintaan bisa jatuh ke
// instance berbeda). Jendela tetap per `windowMs`. Bila Redis gagal, dipakai memori proses ini saja.
const memBuckets = new Map<string, { n: number; exp: number }>();

function bucketKey(key: string, windowMs: number) {
  return `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
}

/** Menambah hitungan `key` di jendela ini dan mengembalikan totalnya. */
export async function rateHit(key: string, windowMs: number): Promise<number> {
  const k = bucketKey(key, windowMs);
  try {
    return await (await getKv()).incr(k, Math.ceil(windowMs / 1000));
  } catch {
    const now = Date.now();
    const e = memBuckets.get(k);
    const n = e && e.exp > now ? e.n + 1 : 1;
    memBuckets.set(k, { n, exp: now + windowMs });
    return n;
  }
}

/** Hitungan `key` di jendela ini tanpa menambahnya. */
export async function rateCount(key: string, windowMs: number): Promise<number> {
  const k = bucketKey(key, windowMs);
  try {
    return Number((await (await getKv()).get(k)) ?? 0);
  } catch {
    const e = memBuckets.get(k);
    return e && e.exp > Date.now() ? e.n : 0;
  }
}

export async function rateLimit(key: string, max: number, windowMs: number) {
  if ((await rateHit(key, windowMs)) > max) throw new ApiError(429, "rateLimited");
}

/** IP klien dari proxy (Vercel mengisi x-forwarded-for); "local" bila tidak ada. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "local";
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Membungkus handler agar ApiError menjadi respons JSON yang rapi. */
export function route<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.code }, { status: e.status });
      if (e instanceof ConfigError) {
        console.error(`[config] ${e.code}: lihat README bagian Deploy ke Vercel`);
        return NextResponse.json({ error: e.code }, { status: 503 });
      }
      console.error(e);
      return NextResponse.json({ error: "server" }, { status: 500 });
    }
  };
}
