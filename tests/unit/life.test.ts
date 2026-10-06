import { describe, expect, it } from "vitest";
import { TEMPLATE_IDS, buildTemplate } from "@/shared/templates";
import {
  DEFAULT_LIFE,
  FULL_NEEDS,
  ITEMS,
  MENUS,
  applyItem,
  dayKey,
  lifeEffects,
  menuEntry,
  msPerCoin,
  restKindAt,
  sanitizeLife,
  sanitizeNeeds,
  tickNeeds,
  venueOf,
  type Venue,
} from "@/shared/life";

const HOUR = 3_600_000;

describe("bar kebutuhan (FR-50, FR-52)", () => {
  it("turun pelan selama online dan tidak pernah di bawah 0", () => {
    const after1h = tickNeeds(FULL_NEEDS, HOUR, DEFAULT_LIFE, "none");
    for (const k of ["energy", "hunger", "thirst"] as const) {
      expect(after1h[k]).toBeLessThan(100);
      expect(after1h[k]).toBeGreaterThan(70);
    }
    let n = FULL_NEEDS;
    for (let i = 0; i < 20; i++) n = tickNeeds(n, 5 * HOUR, DEFAULT_LIFE, "none");
    expect(n).toEqual({ energy: 0, hunger: 0, thirst: 0 });
  });

  it("kecepatan bisa diatur admin; dimatikan berarti tidak berubah", () => {
    const slow = tickNeeds(FULL_NEEDS, HOUR, { ...DEFAULT_LIFE, decay: "slow" }, "none");
    const fast = tickNeeds(FULL_NEEDS, HOUR, { ...DEFAULT_LIFE, decay: "fast" }, "none");
    expect(slow.thirst).toBeGreaterThan(fast.thirst);
    expect(tickNeeds(FULL_NEEDS, HOUR, { ...DEFAULT_LIFE, enabled: false }, "none")).toEqual(FULL_NEEDS);
  });

  it("duduk memulihkan energi; kasur paling cepat", () => {
    const tired = { energy: 20, hunger: 80, thirst: 80 };
    const seat = tickNeeds(tired, HOUR, DEFAULT_LIFE, "seat").energy;
    const comfy = tickNeeds(tired, HOUR, DEFAULT_LIFE, "comfy").energy;
    const bed = tickNeeds(tired, HOUR, DEFAULT_LIFE, "bed").energy;
    expect(seat).toBeGreaterThan(20);
    expect(comfy).toBeGreaterThan(seat);
    expect(bed).toBeGreaterThan(comfy);
    expect(tickNeeds(tired, 6 * HOUR, DEFAULT_LIFE, "bed").energy).toBe(100);
  });

  it("jenis istirahat dikenali dari perabot di peta", () => {
    const office = buildTemplate("office");
    const sofa = office.objects.find((o) => o.kind === "sofa")!;
    const chair = office.objects.find((o) => o.kind === "chair")!;
    expect(restKindAt(office, sofa.x + 0.5, sofa.y + 0.5, true)).toBe("comfy");
    expect(restKindAt(office, chair.x + 0.5, chair.y + 0.5, true)).toBe("seat");
    expect(restKindAt(office, sofa.x + 0.5, sofa.y + 0.5, false)).toBe("none");
    const home = buildTemplate("home");
    const bed = home.objects.find((o) => o.kind === "bed")!;
    expect(restKindAt(home, bed.x + 0.5, bed.y + 0.5, true)).toBe("bed");
  });

  it("data tersimpan yang rusak dianggap penuh / bawaan", () => {
    expect(sanitizeNeeds(null)).toEqual(FULL_NEEDS);
    expect(sanitizeNeeds({ energy: 40, hunger: "x", thirst: 500 })).toEqual({
      energy: 40,
      hunger: 100,
      thirst: 100,
    });
    expect(sanitizeLife({ decay: "turbo", coinsPerHour: 30 })).toEqual(DEFAULT_LIFE);
    expect(sanitizeLife({ salary: false })).toEqual({ ...DEFAULT_LIFE, salary: false });
  });
});

describe("efek ringan saat bar kosong (aturan 6)", () => {
  it("tidak ada efek saat bar cukup", () => {
    expect(lifeEffects(FULL_NEEDS)).toEqual({ speed: 1, volume: 1, blur: 0 });
  });

  it("punya batas minimum: jalan >= 70%, suara >= 50%, buram <= 1,5 px", () => {
    const e = lifeEffects({ energy: 0, hunger: 0, thirst: 0 });
    expect(e.speed).toBeCloseTo(0.7);
    expect(e.volume).toBeCloseTo(0.5);
    expect(e.blur).toBeLessThanOrEqual(1.5);
    expect(e.blur).toBeGreaterThan(0);
  });
});

describe("makanan, minuman, dan tempat membeli (FR-51, FR-55)", () => {
  it("efek item mengikuti tabel PRD dan tetap di 0..100", () => {
    expect(applyItem({ energy: 50, hunger: 50, thirst: 50 }, ITEMS.coffee)).toEqual({
      energy: 70,
      hunger: 50,
      thirst: 60,
    });
    expect(applyItem({ energy: 90, hunger: 90, thirst: 5 }, ITEMS.chickenRice)).toEqual({
      energy: 100,
      hunger: 100,
      thirst: 0,
    });
  });

  it("mesin penjual lebih mahal dan instan; kantin lebih murah tapi menunggu", () => {
    for (const e of MENUS.vending) {
      expect(e.waitMs).toBe(0);
      const kitchen = menuEntry("kitchen", e.item);
      if (kitchen) {
        expect(kitchen.price).toBeLessThan(e.price);
      }
    }
    expect(MENUS.kitchen.length).toBeGreaterThan(MENUS.vending.length);
    expect(MENUS.kitchen.some((e) => e.waitMs > 0)).toBe(true);
    expect(menuEntry("cooler", "coffee")).toBeNull();
  });

  it("setiap template punya tempat minum, dan setiap tempat bisa diinteraksi", () => {
    const actionFor: Record<Venue, string> = {
      vending: "buy",
      coffee: "brew",
      cooler: "drink",
      fridge: "drink",
      kitchen: "cook",
    };
    for (const id of TEMPLATE_IDS) {
      const venues = buildTemplate(id)
        .objects.map((o) => ({ o, v: venueOf(o) }))
        .filter((x) => x.v);
      expect(venues.length).toBeGreaterThan(0);
      for (const { o, v } of venues) expect(o.actions).toContain(actionFor[v!]);
    }
  });
});

describe("gaji koin (FR-53)", () => {
  it("hari dihitung menurut WIB", () => {
    expect(dayKey(Date.parse("2026-10-06T16:59:00Z"))).toBe("2026-10-06");
    expect(dayKey(Date.parse("2026-10-06T17:00:00Z"))).toBe("2026-10-07");
  });

  it("koin per jam menjadi lama aktif per koin", () => {
    expect(msPerCoin({ ...DEFAULT_LIFE, coinsPerHour: 60 })).toBe(60_000);
    expect(msPerCoin({ ...DEFAULT_LIFE, coinsPerHour: 0 })).toBe(Infinity);
  });
});
