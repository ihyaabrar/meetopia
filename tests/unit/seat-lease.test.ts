import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
vi.mock("@/server/env", () => ({ redisUrl: () => "" }));
import { getKv } from "@/server/kv";
describe("atomic seat ownership", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());
  it("only one of simultaneous claimants acquires a seat", async () => {
    const kv = await getKv(),
      key = "qa-seat-race";
    await kv.del(key);
    expect(await Promise.all([kv.claim(key, "a", 90), kv.claim(key, "b", 90)])).toEqual([true, false]);
    await kv.release(key, "b");
    expect(await kv.get(key)).toBe("a");
    await kv.release(key, "a");
    expect(await kv.claim(key, "b", 90)).toBe(true);
  });
  it("renews for the same owner and recovers an expired lease", async () => {
    const kv = await getKv(),
      key = "qa-seat-expiry";
    await kv.del(key);
    expect(await kv.claim(key, "a", 1)).toBe(true);
    vi.advanceTimersByTime(800);
    expect(await kv.claim(key, "a", 1)).toBe(true);
    vi.advanceTimersByTime(800);
    expect(await kv.claim(key, "b", 1)).toBe(false);
    vi.advanceTimersByTime(201);
    expect(await kv.claim(key, "b", 1)).toBe(true);
    await kv.release(key, "a");
    expect(await kv.get(key)).toBe("b");
  });
});
