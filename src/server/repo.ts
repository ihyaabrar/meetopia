/** Kueri database untuk grup, kanal, keanggotaan, peta, undangan, pesan, dan catatan. */
import { one, sql } from "./db";
import { newId, newToken, hashToken } from "./ids";
import type { MapData } from "@/shared/map";
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

export interface GroupSummary {
  id: string;
  name: string;
  role: Role;
  iconColor: string;
  iconSymbol: string;
}

export interface Member {
  id: string;
  name: string;
  avatar: AvatarConfig;
  role: Role;
  joinedAt: string;
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
  await sql("INSERT INTO groups (id, name, owner_id, icon_color, icon_symbol) VALUES ($1, $2, $3, $4, $5)", [
    groupId,
    name,
    ownerId,
    icon?.color ?? defaultGroupColor(groupId),
    icon?.symbol ?? "initials",
  ]);
  await sql("INSERT INTO memberships (user_id, group_id, role) VALUES ($1, $2, 'owner')", [ownerId, groupId]);
  // FR-72 & FR-73: ruangan 2D dan kanal "umum" dibuat otomatis.
  await sql("INSERT INTO channels (id, group_id, name) VALUES ($1, $2, 'umum')", [newId(), groupId]);
  await sql("INSERT INTO maps (id, group_id, version, data) VALUES ($1, $2, 1, $3)", [
    newId(),
    groupId,
    JSON.stringify(buildTemplate(template)),
  ]);
  return groupId;
}

export async function listGroups(userId: string): Promise<GroupSummary[]> {
  const rows = await sql<{
    id: string;
    name: string;
    role: Role;
    icon_color: string | null;
    icon_symbol: string;
  }>(
    `SELECT g.id, g.name, m.role, g.icon_color, g.icon_symbol FROM memberships m JOIN groups g ON g.id = m.group_id
     WHERE m.user_id = $1 ORDER BY m.created_at`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    iconColor: r.icon_color ?? defaultGroupColor(r.id),
    iconSymbol: r.icon_symbol,
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
  }>(
    `SELECT u.id, u.name, u.avatar, m.role, m.created_at FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.group_id = $1 ORDER BY u.name`,
    [groupId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    avatar: sanitizeAvatar(r.avatar),
    joinedAt: new Date(r.created_at).toISOString(),
  }));
}

export async function getMap(groupId: string): Promise<MapData> {
  const r = await one<{ data: MapData }>("SELECT data FROM maps WHERE group_id = $1", [groupId]);
  if (!r) return OFFICE_TEMPLATE;
  // Peta dari template lama (belum ada editor peta) ikut diperbarui; pengaturan audio dipertahankan.
  const template = templateOf(r.data);
  if ((r.data.templateRev ?? 1) < TEMPLATE_REVS[template]) {
    const upgraded: MapData = {
      ...buildTemplate(template),
      audio: r.data.audio ?? OFFICE_TEMPLATE.audio,
      version: r.data.version + 1,
    };
    await sql("UPDATE maps SET data = $2, version = $3, updated_at = now() WHERE group_id = $1", [
      groupId,
      JSON.stringify(upgraded),
      upgraded.version,
    ]);
    return upgraded;
  }
  return r.data;
}

/** Ganti jenis ruangan (tata ruang baru); pengaturan audio dipertahankan. */
export async function replaceMapTemplate(groupId: string, template: TemplateId): Promise<MapData> {
  const map = await getMap(groupId);
  const next: MapData = { ...buildTemplate(template), audio: map.audio, version: map.version + 1 };
  await sql("UPDATE maps SET data = $2, version = $3, updated_at = now() WHERE group_id = $1", [
    groupId,
    JSON.stringify(next),
    next.version,
  ]);
  return next;
}

export async function updateMapAudio(groupId: string, audio: MapData["audio"]): Promise<MapData> {
  const map = await getMap(groupId);
  const next: MapData = { ...map, audio, version: map.version + 1 };
  await sql("UPDATE maps SET data = $2, version = $3, updated_at = now() WHERE group_id = $1", [
    groupId,
    JSON.stringify(next),
    next.version,
  ]);
  return next;
}

// ---------- Undangan (FR-02) ----------

export interface Invite {
  id: string;
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
  await sql(
    `INSERT INTO invites (id, token_hash, group_id, role, created_by, expires_at, max_uses)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, hashToken(token), groupId, opts.role, createdBy, expires, opts.maxUses],
  );
  return {
    token,
    invite: {
      id,
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
    role: Role;
    expires_at: string | Date;
    max_uses: number | null;
    uses: number;
    revoked_at: string | null;
    created_at: string | Date;
  }>("SELECT * FROM invites WHERE group_id = $1 ORDER BY created_at DESC", [groupId]);
  return rows.map((r) => ({
    id: r.id,
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

export async function checkInvite(token: string): Promise<InviteCheck> {
  const r = await one<{
    id: string;
    group_id: string;
    role: Role;
    expires_at: string | Date;
    max_uses: number | null;
    uses: number;
    revoked_at: string | null;
    name: string;
  }>("SELECT i.*, g.name FROM invites i JOIN groups g ON g.id = i.group_id WHERE token_hash = $1", [
    hashToken(token),
  ]);
  if (!r) return { ok: false, reason: "notFound" };
  if (r.revoked_at) return { ok: false, reason: "revoked" };
  if (new Date(r.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (r.max_uses !== null && r.uses >= r.max_uses) return { ok: false, reason: "used" };
  return { ok: true, inviteId: r.id, groupId: r.group_id, groupName: r.name, role: r.role };
}

export async function acceptInvite(token: string, userId: string): Promise<InviteCheck> {
  const check = await checkInvite(token);
  if (!check.ok) return check;
  const existing = await getRole(userId, check.groupId);
  if (!existing) {
    await sql("INSERT INTO memberships (user_id, group_id, role) VALUES ($1, $2, $3)", [
      userId,
      check.groupId,
      check.role,
    ]);
    await sql("UPDATE invites SET uses = uses + 1 WHERE id = $1", [check.inviteId]);
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
