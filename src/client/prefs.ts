/**
 * Preferensi pribadi yang hanya berlaku di perangkat ini (perangkat audio, volume, suara notifikasi).
 * Disimpan di localStorage; bila tidak tersedia (mode privat), nilai bawaan tetap dipakai.
 */
import { useSyncExternalStore } from "react";

export interface Prefs {
  micDeviceId: string;
  camDeviceId: string;
  speakerDeviceId: string;
  /** Nyalakan mikrofon otomatis saat masuk ruangan (bawaan mati, aturan 8 PRD). */
  micOnJoin: boolean;
  noiseSuppression: boolean;
  /** Pengali volume suara orang lain, 0..1. */
  othersVolume: number;
  /** Pengali volume musik dari speaker di ruangan, 0..1. */
  musicVolume: number;
  soundKnock: boolean;
  soundDm: boolean;
  soundMention: boolean;
  /** Notifikasi browser saat tab tidak aktif. */
  desktopNotify: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  micDeviceId: "",
  camDeviceId: "",
  speakerDeviceId: "",
  micOnJoin: false,
  noiseSuppression: true,
  othersVolume: 1,
  musicVolume: 0.7,
  soundKnock: true,
  soundDm: true,
  soundMention: true,
  desktopNotify: false,
  reducedMotion: false,
};

const KEY = "mt_prefs";
let current: Prefs = DEFAULT_PREFS;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) current = { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {}
}

export function getPrefs(): Prefs {
  load();
  return current;
}

export function setPrefs(patch: Partial<Prefs>) {
  load();
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {}
  applyPrefsToDocument(current);
  listeners.forEach((f) => f());
}

export function subscribePrefs(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Preferensi yang memengaruhi tampilan halaman. */
export function applyPrefsToDocument(p: Prefs = getPrefs()) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.motion = p.reducedMotion ? "reduced" : "";
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribePrefs, getPrefs, () => DEFAULT_PREFS);
}

/** Tema disimpan per perangkat di cookie agar halaman pertama langsung tampil benar. */
export function applyTheme(theme: string, cookieName: string) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${cookieName}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

export function applyContrast(high: boolean) {
  document.documentElement.dataset.contrast = high ? "high" : "";
}
