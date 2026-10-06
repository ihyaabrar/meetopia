import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { onVercel, redisEnvNames, redisUrl } from "@/server/env";

/**
 * Cek konfigurasi server tanpa membuka rahasia apa pun. Buka /api/health setelah deploy
 * untuk melihat env mana yang belum diisi.
 */
export async function GET(req: Request) {
  let database: "ok" | "notConfigured" | "error" = "ok";
  let databaseError: string | undefined;
  try {
    await (await getDb()).query("SELECT 1");
  } catch (e) {
    const code = (e as { code?: string }).code;
    database = (e as Error).message === "dbNotConfigured" ? "notConfigured" : "error";
    if (database === "error") databaseError = code ?? (e as Error).name;
  }
  // Uji koneksi Redis sungguhan (PING) bila URL tersedia.
  let redisPing: "ok" | "error" | "notConfigured" = "notConfigured";
  let redisError: string | undefined;
  const rurl = redisUrl();
  if (rurl) {
    const { Redis } = await import("ioredis");
    const r = new Redis(rurl, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 5000 });
    try {
      await r.connect();
      redisPing = (await r.ping()) === "PONG" ? "ok" : "error";
    } catch (e) {
      redisPing = "error";
      redisError = (e as { code?: string }).code ?? (e as Error).name;
    } finally {
      r.disconnect();
    }
  }
  const ok =
    database === "ok" &&
    (!!process.env.AUTH_SECRET || process.env.NODE_ENV !== "production") &&
    (!onVercel || redisPing === "ok");
  // Ringkasan publik: cukup untuk tahu env mana yang belum benar, tanpa membuka detail server.
  const summary = {
    ok,
    database,
    authSecret: !!process.env.AUTH_SECRET,
    redis: redisPing,
    appUrl: !!process.env.APP_URL,
    realtime: process.env.NEXT_PUBLIC_REALTIME_URL ? "external" : "builtin",
    // Commit yang sedang aktif (disediakan Vercel), untuk memastikan redeploy sudah terjadi.
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  };
  // Rincian diagnostik (kode galat, NAMA env tanpa nilai) hanya saat pengembangan atau dengan
  // ?token= yang cocok dengan HEALTH_TOKEN.
  const token = new URL(req.url).searchParams.get("token");
  const detailed =
    process.env.NODE_ENV !== "production" ||
    (!!process.env.HEALTH_TOKEN && token === process.env.HEALTH_TOKEN);
  const body = detailed
    ? {
        ...summary,
        vercel: onVercel,
        databaseError,
        redisConfigured: !!rurl,
        redisError,
        envNames: Object.keys(process.env)
          .filter((k) => /(DATABASE|POSTGRES|NEON|PGHOST|REDIS|KV_|UPSTASH|AUTH_SECRET|APP_URL)/.test(k))
          .sort(),
        redisEnvNames: redisEnvNames(),
      }
    : summary;
  return NextResponse.json(body, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
