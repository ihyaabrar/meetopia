/** Kueri database untuk grup, kanal, keanggotaan, peta, undangan, pesan, dan catatan. */
import { one, sql, transaction } from "./db";
import { newId, newToken, hashToken } from "./ids";
import type { MapData } from "@/shared/map";
import { resizeMap } from "@/shared/map-edit";
import {
  OFFICE_TEMPLATE,
  TEMPLATE_REVS,
  buildTemplate,
  templateOf,
  type TemplateId,
} from "@/shared/templates";
import { sanitizeAvatar, type AvatarConfig } from "@/shared/avatar";
import type { Role } from "@/shared/roles";
import { defaultGroupColor, type GroupColor, type GroupSymbol } from "@/shared/groupIcon";
import type { ChatMessage, SharedNote } from "@/shared/protocol";
import { STARTING_COINS, sanitizeLife, type LifeSettings } from "@/shared/life";

export interface GroupSummary {
  id: string;
  name: string;
  role: Role;
  iconColor: string;
  iconSymbol: string;
  description: string;
  template: string;
  memberCount: number;
}

export interface Member {
  id: string;
  name: string;
  avatar: AvatarConfig;
  role: Role;
  joinedAt: string;
  lastSeenAt: string | null;
}

export interface Channel {
  id: string;
  name: string;
  kind: string;
}

export async function createGroup(
  ownerId: string,
  name: string,
  icon?: { color?: GroupColor; symbol?: GroupSymbol },
  template: TemplateId = "office",
): Promise<string> {
  const groupId = newId();
  // Satu transaksi: tidak ada grup setengah jadi (tanpa pemilik, kanal, atau peta) bila ada yang gagal.
  await transaction(async (q) => {
    await q.query(
      "INSERT INTO groups (id, name, owner_id, icon_color, icon_symbol) VALUES ($1, $2, $3, $4, $5)",
      [groupId, name, ownerId, icon?.color ?? defaultGroupColor(groupId), icon?.symbol ?? "initials"],
    );
    await q.query("INSERT INTO memberships (user_id, group_id, role) VALUES ($1, $2, 'owner')", [
      ownerId,
      groupId,
    ]);
    // FR-72 & FR-73: ruangan 2D dan kanal "umum" dibuat otomatis.
    await q.query("INSERT INTO channels (id, group_id, name) VALUES ($1, $2, 'umum')", [newId(), groupId]);
    await q.query("INSERT INTO maps (id, group_id, version, data) VALUES ($1, $2, 1, $3)", [
      newId(),
      groupId,
      JSON.stringify(buildTemplate(template)),
    ]);
  });
  return groupId;
}

export async function listGroups(userId: string): Promise<GroupSummary[]> {
  const rows = await sql<{
    id: string;
    name: string;
    role: Role;
    icon_color: string | null;
    icon_symbol: string;
    description: string;
    template: string | null;
    member_count: number;
  }>(
    `SELECT g.id, g.name, m.role, g.icon_color, g.icon_symbol, g.description,
       mp.data->>'template' AS template,
       (SELECT COUNT(*)::int FROM memberships x WHERE x.group_id = g.id) AS member_count
     FROM memberships m JOIN groups g ON g.id = m.group_id LEFT JOIN maps mp ON mp.group_id = g.id
     WHERE m.user_id = $1 ORDER BY m.created_at`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    iconColor: r.icon_color ?? defaultGroupColor(r.id),
    iconSymbol: r.icon_symbol,
    description: r.description ?? "",
    template: r.template ?? "office",
    memberCount: r.member_count,
  }));
}

export async function getRole(userId: string, groupId: string): Promise<Role | null> {
  const r = await one<{ role: Role }>("SELECT role FROM memberships WHERE user_id = $1 AND group_id = $2", [
    userId,
    groupId,
  ]);
  return r?.role ?? null;
}

export interface GroupRow {
  id: string;
  name: string;
  owner_id: string;
  recording_policy: string;
  description: string;
  icon_color: string | null;
  icon_symbol: string;
}

export async function getGroup(groupId: string) {
  return one<GroupRow>(
    "SELECT id, name, owner_id, recording_policy, description, icon_color, icon_symbol FROM groups WHERE id = $1",
    [groupId],
  );
}

export const MAX_CHANNELS = 20;

/** Nama kanal gaya Discord: huruf kecil, spasi jadi tanda hubung. */
export function normalizeChannelName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export async function createChannel(groupId: string, name: string): Promise<Channel> {
  const id = newId();
  await sql("INSERT INTO channels (id, group_id, name) VALUES ($1, $2, $3)", [id, groupId, name]);
  return { id, name, kind: "text" };
}

export async function listChannels(groupId: string): Promise<Channel[]> {
  return sql<Channel>("SELECT id, name, kind FROM channels WHERE group_id = $1 ORDER BY created_at", [
    groupId,
  ]);
}

export async function channelInGroup(channelId: string, groupId: string): Promise<boolean> {
  return !!(await one("SELECT 1 FROM channels WHERE id = $1 AND group_id = $2", [channelId, groupId]));
}

export async function listMembers(groupId: string): Promise<Member[]> {
  const rows = await sql<{
    id: string;
    name: string;
    avatar: unknown;
    role: Role;
    created_at: string | Date;
    last_seen_at: string | Date | null;
  }>(
    `SELECT u.id, u.name, u.avatar, m.role, m.created_at, m.last_seen_at FROM memberships m
     JOIN users u ON u.id = m.user_id WHERE m.group_id = $1
     ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END, u.name`,
    [groupId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    avatar: sanitizeAvatar(r.avatar),
    joinedAt: new Date(r.created_at).toISOString(),
    lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : null,
  }));
}

export async function touchLastSeen(groupId: string, userId: string): Promise<void> {
  await sql("UPDATE memberships SET last_seen_at = now() WHERE group_id = $1 AND user_id = $2", [
    groupId,
    userId,
  ]);
}

export async function getMap(groupId: string): Promise<MapData> {
  const r = await one<{ data: MapData }>("SELECT data FROM maps WHERE group_id = $1", [groupId]);
  if (!r) return OFFICE_TEMPLATE;
  // Peta dari template lama (belum ada editor peta) ikut diperbarui; pengaturan audio dipertahankan.
  const template = templateOf(r.data);
  if (!r.data.customLayout && (r.data.templateRev ?? 1) < TEMPLATE_REVS[template]) {
    const upgraded: MapData = {
      ...resizeMap(buildTemplate(template), r.data.appearance?.roomSize ?? "medium"),
      audio: r.data.audio ?? OFFICE_TEMPLATE.audio,
      appearance: r.data.appearance,
      version: r.data.version + 1,
    };
    const updated = await sql(
      "UPDATE maps SET data = $2, version = $3, updated_at = now() WHERE group_id = $1 AND version = $4 RETURNING id",
      [groupId, JSON.stringify(upgraded), upgraded.version, r.data.version],
    );
    if (!updated.length) return getMap(groupId);
    return upgraded;
  }
  return r.data;
}

/** Ganti jenis ruangan (tata ruang baru); pengaturan audio dipertahankan. */
export async function replaceMapTemplate(groupId: string, template: TemplateId): Promise<MapData> {
  return transaction(async (q) => {
    const rows = await q.query<{ data: MapData }>("SELECT data FROM maps WHERE group_id = $1 FOR UPDATE", [
      groupId,
    ]);
    const map = rows[0]?.data ?? OFFICE_TEMPLATE;
    const next: MapData = {
      ...resizeMap(buildTemplate(template), map.appearance?.roomSize ?? "medium"),
      audio: map.audio,
      appearance: map.appearance,
      version: map.version + 1,
    };
    await q.query("UPDATE maps SET data = $2, version = $3, updated_at = now() WHERE group_id = $1", [
      groupId,
      JSON.stringify(next),
      next.version,
    ]);
    return next;
  });
}

export async function updateMapAudio(groupId: string, audio: MapData["audio"]): Promise<MapData> {
  return transaction(async (q) => {
    const rows = await q.query<{ data: MapData }>("SELECT data FROM maps WHERE group_id = $1 FOR UPDATE", [
      groupId,
    ]);
    const map = rows[0]?.data ?? OFFICE_TEMPLATE;
    const next: MapData = { ...map, audio, version: map.version + 1 };
    await q.query("UPDATE maps SET data = $2, version = $3, updated_at = now() WHERE group_id = $1", [
      groupId,
      JSON.stringify(next),
      next.version,
    ]);
    return next;
  });
}

// ---------- Undangan (FR-02) ----------

export interface Invite {
  id: string;
  code: string | null;
  role: Role;
  expiresAt: string;
  maxUses: number | null;
  uses: number;
  revoked: boolean;
  createdAt: string;
}

export async function createInvite(
  groupId: string,
  createdBy: string,
  opts: { expiresInHours: number; maxUses: number | null; role: Role },
): Promise<{ token: string; invite: Invite }> {
  const token = newToken();
  const id = newId();
  const expires = new Date(Date.now() + opts.expiresInHours * 3600_000).toISOString();
  let code = inviteCode();
  for (let attempt = 0; ; attempt++) {
    try {
      await sql(
        `INSERT INTO invites (id, token_hash, group_id, role, created_by, expires_at, max_uses, code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, hashToken(token), groupId, opts.role, createdBy, expires, opts.maxUses, code],
      );
      break;
    } catch (e) {
      // Kode bentrok (sangat jarang): coba kode lain.
      if (attempt >= 4 || (e as { code?: string }).code !== "23505") throw e;
      code = inviteCode();
    }
  }
  return {
    token,
    invite: {
      id,
      code,
      role: opts.role,
      expiresAt: expires,
      maxUses: opts.maxUses,
      uses: 0,
      revoked: false,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function listInvites(groupId: string): Promise<Invite[]> {
  const rows = await sql<{
    id: string;
    code: string | null;
    role: Role;
    expires_at: string | Date;
    max_uses: number | null;
    uses: number;
    revoked_at: string | null;
    created_at: string | Date;
  }>("SELECT * FROM invites WHERE group_id = $1 ORDER BY created_at DESC", [groupId]);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    role: r.role,
    expiresAt: new Date(r.expires_at).toISOString(),
    maxUses: r.max_uses,
    uses: r.uses,
    revoked: !!r.revoked_at,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function revokeInvite(groupId: string, inviteId: string): Promise<boolean> {
  const rows = await sql(
    "UPDATE invites SET revoked_at = now() WHERE id = $1 AND group_id = $2 RETURNING id",
    [inviteId, groupId],
  );
  return rows.length > 0;
}

export type InviteCheck =
  | { ok: true; inviteId: string; groupId: string; groupName: string; role: Role }
  | { ok: false; reason: "notFound" | "expired" | "revoked" | "used" };

/** Kode 6 karakter tanpa huruf/angka yang mudah tertukar (0/O, 1/I/L). */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function inviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export const normalizeInviteCode = (raw: string) =>
  raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

export async function checkInvite(token: string): Promise<InviteCheck> {
  return checkInviteBy("token_hash = $1", hashToken(token));
}

export async function checkInviteCode(code: string): Promise<InviteCheck> {
  return checkInviteBy("code = $1", normalizeInviteCode(code));
}

async function checkInviteBy(where: string, value: string): Promise<InviteCheck> {
  const r = await one<{
    id: string;
    group_id: string;
    role: Role;
    expires_at: string | Date;
    max_uses: number | null;
    uses: number;
    revoked_at: string | null;
    name: string;
  }>(`SELECT i.*, g.name FROM invites i JOIN groups g ON g.id = i.group_id WHERE ${where}`, [value]);
  if (!r) return { ok: false, reason: "notFound" };
  if (r.revoked_at) return { ok: false, reason: "revoked" };
  if (new Date(r.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (r.max_uses !== null && r.uses >= r.max_uses) return { ok: false, reason: "used" };
  return { ok: true, inviteId: r.id, groupId: r.group_id, groupName: r.name, role: r.role };
}

export async function acceptInvite(token: string, userId: string): Promise<InviteCheck> {
  return joinWithInvite(await checkInvite(token), userId);
}

export async function acceptInviteCode(code: string, userId: string): Promise<InviteCheck> {
  return joinWithInvite(await checkInviteCode(code), userId);
}

class InviteUsedUp extends Error {}

async function joinWithInvite(check: InviteCheck, userId: string): Promise<InviteCheck> {
  if (!check.ok) return check;
  if (await getRole(userId, check.groupId)) return check;
  try {
    // Atomik: jatah pakai hanya bertambah bila masih tersedia, jadi batas tidak terlewati walau
    // beberapa orang bergabung bersamaan; anggota tidak dobel bila tombol diklik dua kali.
    await transaction(async (q) => {
      const joined = await q.query(
        "INSERT INTO memberships (user_id, group_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING user_id",
        [userId, check.groupId, check.role],
      );
      if (!joined.length) return;
      const used = await q.query(
        `UPDATE invites SET uses = uses + 1
         WHERE id = $1 AND revoked_at IS NULL AND expires_at > now() AND (max_uses IS NULL OR uses < max_uses)
         RETURNING id`,
        [check.inviteId],
      );
      if (!used.length) throw new InviteUsedUp();
    });
  } catch (e) {
    if (e instanceof InviteUsedUp) return { ok: false, reason: "used" };
    throw e;
  }
  return check;
}

// ---------- Pesan (FR-25) ----------

export const MESSAGE_RETENTION_DAYS = 30;

interface MessageRow {
  id: string;
  group_id: string;
  kind: "channel" | "dm";
  channel_id: string | null;
  to_user_id: string | null;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string | Date;
}

const toMessage = (r: MessageRow): ChatMessage => ({
  id: r.id,
  groupId: r.group_id,
  kind: r.kind,
  channelId: r.channel_id,
  toUserId: r.to_user_id,
  senderId: r.sender_id,
  senderName: r.sender_name,
  body: r.body,
  createdAt: new Date(r.created_at).toISOString(),
});

export async function insertMessages(msgs: ChatMessage[]): Promise<void> {
  if (!msgs.length) return;
  const values: unknown[] = [];
  const rows = msgs.map((m, i) => {
    values.push(m.id, m.groupId, m.kind, m.channelId, m.senderId, m.toUserId, m.body, m.createdAt);
    const b = i * 8;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8})`;
  });
  await sql(
    `INSERT INTO messages (id, group_id, kind, channel_id, sender_id, to_user_id, body, created_at)
     VALUES ${rows.join(", ")} ON CONFLICT (id) DO NOTHING`,
    values,
  );
}

export async function pruneOldMessages(): Promise<void> {
  await sql(`DELETE FROM messages WHERE created_at < now() - interval '${MESSAGE_RETENTION_DAYS} days'`);
}

export async function channelHistory(channelId: string, limit = 50, before?: string): Promise<ChatMessage[]> {
  const rows = await sql<MessageRow>(
    `SELECT m.*, u.name AS sender_name FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.channel_id = $1 AND ($2::timestamptz IS NULL OR m.created_at < $2)
     ORDER BY m.created_at DESC LIMIT $3`,
    [channelId, before ?? null, limit],
  );
  return rows.reverse().map(toMessage);
}

export async function dmHistory(groupId: string, a: string, b: string, limit = 50): Promise<ChatMessage[]> {
  const rows = await sql<MessageRow>(
    `SELECT m.*, u.name AS sender_name FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.group_id = $1 AND m.kind = 'dm'
       AND ((m.sender_id = $2 AND m.to_user_id = $3) OR (m.sender_id = $3 AND m.to_user_id = $2))
     ORDER BY m.created_at DESC LIMIT $4`,
    [groupId, a, b, limit],
  );
  return rows.reverse().map(toMessage);
}

// ---------- Catatan (FR-66, FR-67) ----------

export async function getPrivateNote(userId: string): Promise<{ content: string; updatedAt: string | null }> {
  const r = await one<{ content: string; updated_at: string | Date }>(
    "SELECT content, updated_at FROM notes WHERE owner_user_id = $1",
    [userId],
  );
  return { content: r?.content ?? "", updatedAt: r ? new Date(r.updated_at).toISOString() : null };
}

export async function savePrivateNote(userId: string, content: string): Promise<string> {
  const r = await one<{ updated_at: string | Date }>(
    `INSERT INTO notes (id, owner_user_id, content, updated_by, updated_at) VALUES ($1, $2, $3, $2, now())
     ON CONFLICT (owner_user_id) WHERE owner_user_id IS NOT NULL
     DO UPDATE SET content = EXCLUDED.content, updated_at = now() RETURNING updated_at`,
    [newId(), userId, content],
  );
  return new Date(r!.updated_at).toISOString();
}

export async function getSharedNote(groupId: string): Promise<SharedNote> {
  const r = await one<{
    content: string;
    updated_at: string | Date;
    updated_by: string | null;
    name: string | null;
  }>(
    `SELECT n.content, n.updated_at, n.updated_by, u.name FROM notes n LEFT JOIN users u ON u.id = n.updated_by
     WHERE n.group_id = $1`,
    [groupId],
  );
  if (!r) return { content: "", updatedAt: null, updatedBy: null, updatedByName: null };
  return {
    content: r.content,
    updatedAt: new Date(r.updated_at).toISOString(),
    updatedBy: r.updated_by,
    updatedByName: r.name,
  };
}

/** Tulisan terakhir yang disimpan menang (FR-67). */
export async function saveSharedNote(groupId: string, userId: string, content: string): Promise<SharedNote> {
  await sql(
    `INSERT INTO notes (id, group_id, content, updated_by, updated_at) VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (group_id) WHERE group_id IS NOT NULL
     DO UPDATE SET content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [newId(), groupId, content, userId],
  );
  return getSharedNote(groupId);
}

// ---------- Karakter hidup & koin (Fase 2: FR-50 sampai FR-55) ----------

export async function getLifeSettings(groupId: string): Promise<LifeSettings> {
  const r = await one<{ life: unknown }>("SELECT life FROM groups WHERE id = $1", [groupId]);
  return sanitizeLife(r?.life);
}

export async function saveLifeSettings(groupId: string, life: LifeSettings): Promise<void> {
  await sql("UPDATE groups SET life = $2 WHERE id = $1", [groupId, JSON.stringify(life)]);
}

export interface Wallet {
  coins: number;
  earnedToday: number;
  earnedDay: string;
}

/** Dompet anggota di grup ini; dibuat dengan koin awal saat pertama kali masuk ruangan. */
export async function getWallet(userId: string, groupId: string): Promise<Wallet> {
  const read = () =>
    one<{ coins: number; earned_today: number; earned_day: string }>(
      "SELECT coins, earned_today, earned_day FROM wallets WHERE user_id = $1 AND group_id = $2",
      [userId, groupId],
    );
  let r = await read();
  if (!r) {
    await sql("INSERT INTO wallets (user_id, group_id, coins) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [
      userId,
      groupId,
      STARTING_COINS,
    ]);
    r = await read();
  }
  return { coins: r?.coins ?? 0, earnedToday: r?.earned_today ?? 0, earnedDay: r?.earned_day ?? "" };
}

/**
 * Cairkan gaji yang terkumpul. Perolehan hari ini dihitung di database (bukan ditimpa) agar tetap benar
 * saat koneksi lama dan baru sama-sama mencairkan setelah sambung ulang.
 */
export async function creditWallet(
  userId: string,
  groupId: string,
  amount: number,
  day: string,
): Promise<Wallet | null> {
  const r = await one<{ coins: number; earned_today: number; earned_day: string }>(
    `UPDATE wallets SET coins = coins + $3,
       earned_today = CASE WHEN earned_day = $4 THEN earned_today + $3 ELSE $3 END,
       earned_day = $4, updated_at = now()
     WHERE user_id = $1 AND group_id = $2 RETURNING coins, earned_today, earned_day`,
    [userId, groupId, amount, day],
  );
  return r ? { coins: r.coins, earnedToday: r.earned_today, earnedDay: r.earned_day } : null;
}

/** Bayar dengan koin. Saldo tidak bisa negatif (FR-54): null bila koin kurang. */
export async function spendWallet(userId: string, groupId: string, price: number): Promise<number | null> {
  const r = await one<{ coins: number }>(
    `UPDATE wallets SET coins = coins - $3, updated_at = now()
     WHERE user_id = $1 AND group_id = $2 AND coins >= $3 RETURNING coins`,
    [userId, groupId, price],
  );
  return r?.coins ?? null;
}
