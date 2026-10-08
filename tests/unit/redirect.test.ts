import { describe, expect, it } from "vitest";
import { safeNext } from "@/shared/redirect";

describe("tujuan setelah login (?next=)", () => {
  it("menerima path di situs ini", () => {
    expect(safeNext("/invite/ABC123")).toBe("/invite/ABC123");
    expect(safeNext(null)).toBe("/app");
  });
  it("menolak alamat situs lain (open redirect)", () => {
    for (const bad of [
      "//evil.com",
      String.raw`/\evil.com`,
      "https://evil.com",
      "javascript:alert(1)",
      "evil.com",
    ])
      expect(safeNext(bad)).toBe("/app");
  });
});
