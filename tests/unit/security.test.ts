import { afterEach, describe, expect, it, vi } from "vitest";
import { authSecret, pgConnectionString } from "@/server/env";
import { ApiError, clientIp, rateCount, rateHit, rateLimit } from "@/server/api";

describe("rahasia sesi", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("memakai AUTH_SECRET bila ada", () => {
    vi.stubEnv("AUTH_SECRET", "x".repeat(40));
    expect(new TextDecoder().decode(authSecret())).toBe("x".repeat(40));
  });

  it("rahasia pengembangan hanya untuk localhost", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    expect(authSecret().length).toBeGreaterThan(0);
    vi.stubEnv("APP_URL", "https://kantor.contoh.id");
    expect(() => authSecret()).toThrow("authSecretMissing");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => authSecret()).toThrow("authSecretMissing");
  });
});

describe("pembatas laju", () => {
  it("menghitung per kunci dan menolak setelah batas", async () => {
    const key = `uji-${Math.random()}`;
    for (let i = 0; i < 3; i++) await rateLimit(key, 3, 60_000);
    await expect(rateLimit(key, 3, 60_000)).rejects.toBeInstanceOf(ApiError);
    expect(await rateCount(key, 60_000)).toBe(4);
    expect(await rateCount(`${key}-lain`, 60_000)).toBe(0);
    expect(await rateHit(`${key}-lain`, 60_000)).toBe(1);
  });

  it("IP klien diambil dari proxy", () => {
    const req = (h: Record<string, string>) => new Request("http://x", { headers: h });
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientIp(req({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(req({}))).toBe("local");
  });
});

describe("koneksi PostgreSQL", () => {
  it("sslmode=require ditulis eksplisit sebagai verify-full", () => {
    const neon = "postgresql://u:p@ep-x.neon.tech/db?sslmode=require&channel_binding=require";
    expect(pgConnectionString(neon)).toBe("postgresql://u:p@ep-x.neon.tech/db?sslmode=verify-full&channel_binding=require");
    expect(pgConnectionString("postgres://h/db?a=1&sslmode=prefer")).toBe("postgres://h/db?a=1&sslmode=verify-full");
  });
  it("URL lain tidak diubah", () => {
    for (const url of ["postgres://h/db", "postgres://h/db?sslmode=disable", "postgres://h/db?uselibpqcompat=true&sslmode=require"])
      expect(pgConnectionString(url)).toBe(url);
  });
});
