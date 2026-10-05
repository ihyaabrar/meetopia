/** Utilitas route API: respons JSON, autentikasi, dan pemeriksaan peran di server (aturan 4). */
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getSessionUser, type SessionUser } from "./auth";
import { getRole } from "./repo";
import { can, type Permission, type Role } from "@/shared/roles";
import { ConfigError } from "./env";

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

// Pembatas laju sederhana per proses (cukup untuk skala beberapa puluh pengguna).
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) throw new ApiError(429, "rateLimited");
  list.push(now);
  buckets.set(key, list);
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
