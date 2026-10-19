import { ApiError, clientIp, ok, rateLimit, requireUser, route } from "@/server/api";
import { acceptInvite, acceptInviteCode, checkInvite, checkInviteCode } from "@/server/repo";

/** Tautan undangan bisa memakai token panjang atau kode pendek (mis. /invite/K7Q2MX). */
const isCode = (v: string) => v.length <= 12;

type Ctx = { params: Promise<{ token: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { token } = await params;
  // Kode pendek bisa ditebak: batasi per IP (GET tanpa login juga membocorkan nama workspace).
  if (isCode(token)) await rateLimit(`inviteCode-ip:${clientIp(req)}`, 20, 10 * 60_000);
  const r = isCode(token) ? await checkInviteCode(token) : await checkInvite(token);
  if (!r.ok) return ok({ ok: false, reason: r.reason });
  return ok({ ok: true, groupName: r.groupName });
});

export const POST = route<Ctx>(async (_req, { params }) => {
  const { token } = await params;
  const user = await requireUser();
  // Kunci yang sama dengan /api/invites/join, supaya batasnya tidak bisa diakali lewat rute ini.
  if (isCode(token)) await rateLimit(`joinCode:${user.id}`, 10, 10 * 60_000);
  const r = isCode(token) ? await acceptInviteCode(token, user.id) : await acceptInvite(token, user.id);
  if (!r.ok) throw new ApiError(410, r.reason);
  return ok({ groupId: r.groupId });
});
