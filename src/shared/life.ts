/**
 * Karakter hidup dan ekonomi koin (Fase 2 PRD: FR-50 sampai FR-55).
 *
 * - Tiga bar kebutuhan 0..100: energi, lapar (kenyang), haus (segar). Turun pelan hanya selama online.
 * - Duduk memulihkan energi; sofa/beanbag lebih cepat, kasur paling cepat (FR-52).
 * - Bar yang hampir kosong memberi efek ringan dengan batas minimum (aturan 6): jalan sedikit lebih
 *   lambat, suara orang lain mengecil paling banyak 50%, layar sedikit buram. Chat dan berbagi layar
 *   tidak pernah terkunci. Semua efek bisa dimatikan admin (per grup) dan pengguna (per perangkat).
 * - Gaji koin per menit aktif dengan batas harian (FR-53). Koin hanya virtual (aturan 5).
 *
 * Logika di sini murni (tanpa I/O) agar server dan klien menghitung hal yang sama.
 */
import { z } from "zod";
import type { MapData, MapObject, ObjectKind } from "./map";

export const NEED_KEYS = ["energy", "hunger", "thirst"] as const;
export type NeedKey = (typeof NEED_KEYS)[number];
export type Needs = Record<NeedKey, number>;

export const FULL_NEEDS: Needs = { energy: 100, hunger: 100, thirst: 100 };

export const DECAY_SPEEDS = ["slow", "normal", "fast"] as const;
export type DecaySpeed = (typeof DECAY_SPEEDS)[number];

export const lifeSettingsSchema = z.object({
  /** Bar kebutuhan, kantin, dan mesin penjual aktif. */
  enabled: z.boolean(),
  decay: z.enum(DECAY_SPEEDS),
  /** Efek ringan saat bar hampir kosong. */
  effects: z.boolean(),
  /** Gaji koin per menit aktif. */
  salary: z.boolean(),
  coinsPerHour: z.number().int().min(0).max(600),
  dailyCap: z.number().int().min(0).max(5000),
});
export type LifeSettings = z.infer<typeof lifeSettingsSchema>;

export const DEFAULT_LIFE: LifeSettings = {
  enabled: true,
  decay: "normal",
  effects: true,
  salary: true,
  coinsPerHour: 60,
  dailyCap: 480,
};

/** Nilai tersimpan (bisa dari versi lama atau rusak) digabung dengan bawaan. */
export function sanitizeLife(raw: unknown): LifeSettings {
  const merged = { ...DEFAULT_LIFE, ...(raw && typeof raw === "object" ? raw : {}) };
  const parsed = lifeSettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : { ...DEFAULT_LIFE };
}

/** Koin awal untuk dompet baru, agar bisa langsung mencoba mesin penjual. */
export const STARTING_COINS = 50;

/** Penurunan per jam pada kecepatan "normal": bar penuh habis dalam sekitar 5-10 jam online. */
const BASE_DECAY: Needs = { energy: 10, hunger: 14, thirst: 18 };
const DECAY_MULT: Record<DecaySpeed, number> = { slow: 0.5, normal: 1, fast: 2 };

/** Tempat istirahat: kursi biasa, perabot empuk (sofa, beanbag), kasur. */
export type RestKind = "none" | "seat" | "comfy" | "bed";
/** Pemulihan energi per jam saat duduk/berbaring. */
const REST_GAIN: Record<RestKind, number> = { none: 0, seat: 15, comfy: 30, bed: 60 };

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const HOUR = 3_600_000;

/** Bar tersimpan (dari Redis) yang rusak atau tidak ada dianggap penuh. */
export function sanitizeNeeds(raw: unknown): Needs {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const v = (k: NeedKey) => (typeof o[k] === "number" && Number.isFinite(o[k]) ? clamp(o[k]) : 100);
  return { energy: v("energy"), hunger: v("hunger"), thirst: v("thirst") };
}

/** Kebutuhan setelah `dtMs` berlalu. Saat beristirahat energi naik, bukan turun. */
export function tickNeeds(n: Needs, dtMs: number, settings: LifeSettings, rest: RestKind): Needs {
  if (!settings.enabled || dtMs <= 0) return n;
  const h = Math.min(dtMs, 6 * HOUR) / HOUR;
  const m = DECAY_MULT[settings.decay];
  return {
    energy: clamp(rest === "none" ? n.energy - BASE_DECAY.energy * m * h : n.energy + REST_GAIN[rest] * h),
    hunger: clamp(n.hunger - BASE_DECAY.hunger * m * h),
    thirst: clamp(n.thirst - BASE_DECAY.thirst * m * h),
  };
}

/** Jenis istirahat untuk avatar yang sedang duduk di titik (x, y). */
export function restKindAt(map: MapData, x: number, y: number, sitting: boolean): RestKind {
  if (!sitting) return "none";
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const seat = map.objects.find(
    (o) => o.actions?.includes("sit") && tx >= o.x && tx < o.x + o.w && ty >= o.y && ty < o.y + o.h,
  );
  if (!seat) return "seat";
  if (seat.kind === "bed") return "bed";
  if (seat.kind === "sofa" || seat.kind === "beanbag") return "comfy";
  return "seat";
}

/** Di bawah nilai ini efek mulai terasa, makin kuat sampai bar kosong. */
export const LOW_NEED = 15;

export interface LifeEffects {
  /** Pengali kecepatan jalan (minimal 0,7). */
  speed: number;
  /** Pengali volume suara orang lain (minimal 0,5; PRD FR-50). */
  volume: number;
  /** Buram layar dalam piksel (maksimal 1,5). */
  blur: number;
}

export const NO_EFFECTS: LifeEffects = { speed: 1, volume: 1, blur: 0 };

const lowness = (v: number) => Math.max(0, Math.min(1, (LOW_NEED - v) / LOW_NEED));

export function lifeEffects(n: Needs): LifeEffects {
  const tired = lowness(n.energy);
  const body = lowness(Math.min(n.hunger, n.thirst));
  return {
    speed: 1 - 0.3 * tired,
    volume: 1 - 0.5 * body,
    blur: Math.round(15 * Math.max(tired, body)) / 10,
  };
}

// ---------------------------------------------------------------- makanan & minuman

export const ITEM_IDS = [
  "water",
  "icedTea",
  "coffee",
  "energyDrink",
  "chips",
  "sandwich",
  "chickenRice",
] as const;
export type ItemId = (typeof ITEM_IDS)[number];

export interface Item {
  id: ItemId;
  emoji: string;
  kind: "drink" | "snack" | "meal";
  effect: Partial<Needs>;
}

/** Efek tiap item (tabel contoh di PRD, skala 0..100). */
export const ITEMS: Record<ItemId, Item> = {
  water: { id: "water", emoji: "💧", kind: "drink", effect: { thirst: 30 } },
  icedTea: { id: "icedTea", emoji: "🧋", kind: "drink", effect: { energy: 5, thirst: 25 } },
  coffee: { id: "coffee", emoji: "☕", kind: "drink", effect: { energy: 20, thirst: 10 } },
  energyDrink: { id: "energyDrink", emoji: "🥤", kind: "drink", effect: { energy: 35, thirst: 5 } },
  chips: { id: "chips", emoji: "🍟", kind: "snack", effect: { energy: 5, hunger: 15, thirst: -10 } },
  sandwich: { id: "sandwich", emoji: "🥪", kind: "snack", effect: { energy: 10, hunger: 25 } },
  chickenRice: {
    id: "chickenRice",
    emoji: "🍛",
    kind: "meal",
    effect: { energy: 30, hunger: 60, thirst: -5 },
  },
};

export function applyItem(n: Needs, item: Item): Needs {
  return {
    energy: clamp(n.energy + (item.effect.energy ?? 0)),
    hunger: clamp(n.hunger + (item.effect.hunger ?? 0)),
    thirst: clamp(n.thirst + (item.effect.thirst ?? 0)),
  };
}

/**
 * Tempat membeli. Mesin penjual: instan tetapi pilihan terbatas dan lebih mahal. Dapur/kantin: menu
 * lengkap dan lebih murah, tetapi harus menunggu sebentar. Dispenser dan kulkas: air gratis.
 */
export type Venue = "vending" | "coffee" | "cooler" | "fridge" | "kitchen";

export interface MenuEntry {
  item: ItemId;
  price: number;
  /** Lama menunggu sebelum item siap (ms). */
  waitMs: number;
}

export const MENUS: Record<Venue, MenuEntry[]> = {
  vending: [
    { item: "water", price: 8, waitMs: 0 },
    { item: "icedTea", price: 12, waitMs: 0 },
    { item: "energyDrink", price: 20, waitMs: 0 },
    { item: "chips", price: 12, waitMs: 0 },
  ],
  coffee: [{ item: "coffee", price: 6, waitMs: 3_000 }],
  cooler: [{ item: "water", price: 0, waitMs: 0 }],
  fridge: [
    { item: "water", price: 0, waitMs: 0 },
    { item: "icedTea", price: 5, waitMs: 0 },
  ],
  kitchen: [
    { item: "water", price: 0, waitMs: 0 },
    { item: "icedTea", price: 5, waitMs: 2_000 },
    { item: "coffee", price: 4, waitMs: 3_000 },
    { item: "chips", price: 6, waitMs: 2_000 },
    { item: "sandwich", price: 8, waitMs: 5_000 },
    { item: "chickenRice", price: 15, waitMs: 8_000 },
  ],
};

const VENUE_OF: Partial<Record<ObjectKind, Venue>> = {
  vending: "vending",
  coffee: "coffee",
  cooler: "cooler",
  fridge: "fridge",
  counter: "kitchen",
};

export function venueOf(obj: Pick<MapObject, "kind">): Venue | null {
  return VENUE_OF[obj.kind] ?? null;
}

export function menuEntry(venue: Venue, item: string): MenuEntry | null {
  return MENUS[venue].find((e) => e.item === item) ?? null;
}

/** Jarak maksimal (tile) dari tempat membeli; sedikit lebih longgar dari jangkauan petunjuk. */
export const SHOP_RANGE = 2.2;

// ---------------------------------------------------------------- gaji

/** Hari gaji dihitung menurut WIB (UTC+7), karena pengguna utama di Indonesia. */
export function dayKey(now: number): string {
  return new Date(now + 7 * HOUR).toISOString().slice(0, 10);
}

/** Lama aktif (ms) yang dibutuhkan untuk satu koin. */
export function msPerCoin(settings: LifeSettings): number {
  return settings.coinsPerHour > 0 ? HOUR / settings.coinsPerHour : Infinity;
}

/** Status yang dikirim server ke pemiliknya saja (orang lain tidak melihat bar atau saldo). */
export interface LifeState {
  needs: Needs;
  coins: number;
  earnedToday: number;
  /** Sedang duduk di tempat istirahat apa (untuk prediksi di klien). */
  rest: RestKind;
  settings: LifeSettings;
}
