import { ApiError, ok, requireUser, route } from "@/server/api";
import { acceptInvite, acceptInviteCode, checkInvite, checkInviteCode } from "@/server/repo";

/** Tautan undangan bisa memakai token panjang atau kode pendek (mis. /invite/K7Q2MX). */
const isCode = (v: string) => v.length <= 12;

type Ctx = { params: Promise<{ token: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { token } = await params;
  const r = isCode(token) ? await checkInviteCode(token) : await checkInvite(token);
  if (!r.ok) return ok({ ok: false, reason: r.reason });
  return ok({ ok: true, groupName: r.groupName });
});

export const POST = route<Ctx>(async (_req, { params }) => {
  const { token } = await params;
  const user = await requireUser();
  const r = isCode(token) ? await acceptInviteCode(token, user.id) : await acceptInvite(token, user.id);
  if (!r.ok) throw new ApiError(410, r.reason);
  return ok({ groupId: r.groupId });
});
