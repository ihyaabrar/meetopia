/**
 * Notifikasi di dalam aplikasi (ikon lonceng): orang masuk ruangan, pesan langsung, ketukan, sebutan.
 * Disimpan per pengguna di browser ini (maks. 50), tidak dikirim ke server.
 */
import { useSyncExternalStore } from "react";

export type NotifKind = "join" | "dm" | "knock" | "mention";

export interface Notif {
  id: string;
  kind: NotifKind;
  /** Nama pelaku. */
  name: string;
  userId?: string;
  groupId: string;
  groupName: string;
  /** Teks tambahan: cuplikan pesan atau nama kanal. */
  extra?: string;
  at: string;
  read: boolean;
}

const MAX = 50;
const EMPTY: Notif[] = [];
let owner: string | null = null;
let items: Notif[] = EMPTY;
const listeners = new Set<() => void>();

const key = (u: string) => `mt_notif_${u}`;

export function initNotifications(userId: string) {
  if (owner === userId) return;
  owner = userId;
  try {
    items = JSON.parse(localStorage.getItem(key(userId)) ?? "[]") as Notif[];
  } catch {
    items = [];
  }
  listeners.forEach((f) => f());
}

function save() {
  if (!owner) return;
  try {
    localStorage.setItem(key(owner), JSON.stringify(items));
  } catch {}
  listeners.forEach((f) => f());
}

export function pushNotification(n: Omit<Notif, "id" | "at" | "read">) {
  items = [{ ...n, id: crypto.randomUUID(), at: new Date().toISOString(), read: false }, ...items].slice(
    0,
    MAX,
  );
  save();
}

export function markAllRead() {
  items = items.map((n) => (n.read ? n : { ...n, read: true }));
  save();
}

export function clearNotifications() {
  items = [];
  save();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export function useNotifications(): Notif[] {
  return useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );
}
