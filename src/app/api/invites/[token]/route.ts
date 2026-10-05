import { ApiError, ok, requireUser, route } from "@/server/api";
import { acceptInvite, checkInvite } from "@/server/repo";

type Ctx = { params: Promise<{ token: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { token } = await params;
  const r = await checkInvite(token);
  if (!r.ok) return ok({ ok: false, reason: r.reason });
  return ok({ ok: true, groupName: r.groupName });
});

export const POST = route<Ctx>(async (_req, { params }) => {
  const { token } = await params;
  const user = await requireUser();
  const r = await acceptInvite(token, user.id);
  if (!r.ok) throw new ApiError(410, r.reason);
  return ok({ groupId: r.groupId });
});
