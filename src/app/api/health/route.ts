import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { onVercel, redisUrl } from "@/server/env";

/**
 * Cek konfigurasi server tanpa membuka rahasia apa pun. Buka /api/health setelah deploy
 * untuk melihat env mana yang belum diisi.
 */
export async function GET() {
  let database: "ok" | "notConfigured" | "error" = "ok";
  let databaseError: string | undefined;
  try {
    await (await getDb()).query("SELECT 1");
  } catch (e) {
    const code = (e as { code?: string }).code;
    database = (e as Error).message === "dbNotConfigured" ? "notConfigured" : "error";
    if (database === "error") databaseError = code ?? (e as Error).name;
  }
  const checks = {
    vercel: onVercel,
    database,
    databaseError,
    authSecret: !!process.env.AUTH_SECRET,
    redis: !!redisUrl(),
    appUrl: !!process.env.APP_URL,
    realtime: process.env.NEXT_PUBLIC_REALTIME_URL ? "external" : "builtin",
    // Commit yang sedang aktif (disediakan Vercel), untuk memastikan redeploy sudah terjadi.
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    // Hanya NAMA variabel yang mirip database/Redis, tanpa nilainya, untuk melacak awalan dari integrasi.
    envNames: Object.keys(process.env)
      .filter((k) => /(DATABASE|POSTGRES|NEON|PGHOST|REDIS|KV_|UPSTASH|AUTH_SECRET|APP_URL)/.test(k))
      .sort(),
  };
  const ok =
    database === "ok" &&
    (checks.authSecret || process.env.NODE_ENV !== "production") &&
    (!onVercel || checks.redis);
  return NextResponse.json({ ok, ...checks }, { status: ok ? 200 : 503 });
}
