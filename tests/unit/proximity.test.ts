import { describe, expect, it } from "vitest";
import { OFFICE_TEMPLATE } from "@/shared/templates";
import { audiblePeers, pairVolume, volumeForDistance, type Positioned } from "@/shared/proximity";

const map = OFFICE_TEMPLATE;
const p = (id: string, x: number, y: number, extra: Partial<Positioned> = {}): Positioned => ({
  id,
  x,
  y,
  status: "active",
  ...extra,
});

describe("audio berdasarkan jarak (FR-20)", () => {
  it("penuh di dekat, hilang di luar radius, turun monoton", () => {
    const a = map.audio;
    expect(volumeForDistance(0, a)).toBe(1);
    expect(volumeForDistance(a.fullVolumeRadius, a)).toBe(1);
    expect(volumeForDistance(a.radius, a)).toBe(0);
    expect(volumeForDistance(a.radius + 5, a)).toBe(0);
    let last = 1;
    for (let d = a.fullVolumeRadius; d <= a.radius; d += 0.25) {
      const v = volumeForDistance(d, a);
      expect(v).toBeLessThanOrEqual(last);
      last = v;
    }
  });

  it("simetris antara dua orang", () => {
    const a = p("a", 5.5, 20.5);
    const b = p("b", 8.5, 21.5);
    expect(pairVolume(map, a, b)).toBeCloseTo(pairVolume(map, b, a));
    expect(pairVolume(map, a, b)).toBeGreaterThan(0);
  });
});

describe("ruang privat (FR-23)", () => {
  it("orang di luar tidak mendengar walau berdekatan", () => {
    const inside = p("a", 32.5, 9.5); // ruang rapat, dekat pintu
    const outside = p("b", 32.5, 12.5); // lounge, tepat di luar pintu
    expect(pairVolume(map, inside, outside)).toBe(0);
  });

  it("orang di ruang privat yang sama mendengar dengan volume penuh", () => {
    const meeting = map.zones.find((z) => z.id === "meeting")!;
    expect(
      pairVolume(
        map,
        p("a", meeting.x + 0.5, meeting.y + 0.5),
        p("b", meeting.x + meeting.w - 0.5, meeting.y + meeting.h - 0.5),
      ),
    ).toBe(1);
  });
});

describe("status sibuk dan ketuk (FR-31)", () => {
  it("orang sibuk tidak tersambung sampai ketukan diterima", () => {
    const busy = p("a", 5.5, 20.5, { status: "busy" });
    const other = p("b", 6.5, 20.5);
    expect(pairVolume(map, busy, other)).toBe(0);
    expect(pairVolume(map, { ...busy, allowedPeers: ["b"] }, other)).toBe(1);
  });
});

describe("batas peserta (FR-21)", () => {
  it("maksimal 16 audio, diurutkan dari yang terdekat", () => {
    const self = p("self", 10.5, 20.5);
    const others = Array.from({ length: 25 }, (_, i) =>
      p(`o${i}`, 10.5 + (i % 5) * 0.2, 20.5 + Math.floor(i / 5) * 0.2),
    );
    const list = audiblePeers(map, self, others);
    expect(list).toHaveLength(16);
    for (let i = 1; i < list.length; i++)
      expect(list[i].distance).toBeGreaterThanOrEqual(list[i - 1].distance);
  });
});
