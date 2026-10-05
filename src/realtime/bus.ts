/**
 * Format pesan pub/sub antar-instance (aturan 3 PRD). Dipakai server real-time dan route API
 * (misalnya saat catatan bersama disimpan atau peran anggota diubah).
 */
import { getKv, keys } from "@/server/kv";
import type { AvatarConfig } from "@/shared/avatar";
import type { MapData } from "@/shared/map";
import type { ServerMessage } from "@/shared/protocol";
import type { Role } from "@/shared/roles";

export type Control =
  | { kind: "replaced"; userId: string; conn: string }
  | { kind: "membership"; userId: string; role: Role | null }
  | { kind: "profile"; userId: string; name: string; avatar: AvatarConfig }
  | { kind: "grantZone"; userId: string; zoneId: string }
  | { kind: "grantPeer"; userId: string; peerId: string }
  | { kind: "map"; map: MapData }
  | { kind: "groupDeleted" };

export interface Envelope {
  /** Bila diisi, hanya dikirim ke pengguna ini. */
  to?: string[];
  msg?: ServerMessage;
  control?: Control;
}

export async function publishToRoom(groupId: string, env: Envelope): Promise<void> {
  const kv = await getKv();
  await kv.publish(keys.roomChannel(groupId), JSON.stringify(env));
}
