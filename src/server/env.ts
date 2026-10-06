const DEV_SECRET = "dev-only-secret-change-me-dev-only-secret-change-me";

/** Galat konfigurasi server (env belum diisi). Ditampilkan ke pengguna dengan pesan yang jelas. */
export class ConfigError extends Error {
  constructor(public code: "dbNotConfigured" | "authSecretMissing" | "realtimeNotConfigured") {
    super(code);
  }
}

export const onVercel = !!process.env.VERCEL;

/** Verifikasi email dimatikan dulu (keputusan pemilik). Nyalakan dengan EMAIL_VERIFICATION=on. */
export const emailVerificationEnabled = () => process.env.EMAIL_VERIFICATION === "on";

/** APP_URL kosong atau mengarah ke mesin sendiri (localhost, 127.0.0.1, *.localhost). */
function appIsLocal(): boolean {
  const u = process.env.APP_URL;
  if (!u) return true;
  try {
    const h = new URL(u).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".localhost");
  } catch {
    return false;
  }
}

let devSecretWarned = false;

/**
 * Rahasia penanda tangan sesi. Rahasia bawaan pengembangan ada di repo publik, jadi hanya boleh dipakai
 * saat benar-benar pengembangan lokal: bukan produksi, bukan Vercel, dan APP_URL (bila ada) localhost.
 * Selain itu server menolak jalan sampai AUTH_SECRET diisi, agar sesi tidak bisa dipalsukan.
 */
export function authSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (s) return new TextEncoder().encode(s);
  if (process.env.NODE_ENV === "production" || onVercel || !appIsLocal())
    throw new ConfigError("authSecretMissing");
  if (!devSecretWarned) {
    devSecretWarned = true;
    console.warn("[auth] AUTH_SECRET kosong: memakai rahasia pengembangan (hanya untuk localhost).");
  }
  return new TextEncoder().encode(DEV_SECRET);
}

/** URL publik aplikasi. Tanpa APP_URL, dipakai origin permintaan (bila ada) atau localhost:3000. */
export function appUrl(req?: Request): string {
  const fromReq = req ? new URL(req.url).origin : undefined;
  return (process.env.APP_URL || fromReq || "http://localhost:3000").replace(/\/$/, "");
}

export const isDev = process.env.NODE_ENV !== "production";

/**
 * URL database & Redis. Selain nama standar, nama dari integrasi Marketplace Vercel juga diterima
 * (Neon: POSTGRES_URL; Upstash/KV: KV_URL), jadi env yang diisi otomatis langsung terpakai.
 */
export const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
export const redisUrl = () =>
  process.env.REDIS_URL || process.env.KV_URL || process.env.UPSTASH_REDIS_URL || anyRedisUrl() || "";

/** Integrasi Vercel bisa memberi awalan nama sendiri (mis. STORAGE_URL): cari nilai berformat redis:// apa pun. */
function anyRedisUrl(): string {
  for (const v of Object.values(process.env)) if (v && /^rediss?:\/\//.test(v)) return v;
  return "";
}

/** Nama env yang nilainya URL Redis (nama saja, untuk diagnostik). */
export const redisEnvNames = () =>
  Object.entries(process.env)
    .filter(([, v]) => v && /^rediss?:\/\//.test(v))
    .map(([k]) => k);
