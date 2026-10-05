const DEV_SECRET = "dev-only-secret-change-me-dev-only-secret-change-me";

export function authSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET wajib diisi di produksi");
    return new TextEncoder().encode(DEV_SECRET);
  }
  return new TextEncoder().encode(s);
}

/** URL publik aplikasi. Tanpa APP_URL, dipakai origin permintaan (bila ada) atau localhost:3000. */
export function appUrl(req?: Request): string {
  const fromReq = req ? new URL(req.url).origin : undefined;
  return (process.env.APP_URL || fromReq || "http://localhost:3000").replace(/\/$/, "");
}

export const isDev = process.env.NODE_ENV !== "production";
