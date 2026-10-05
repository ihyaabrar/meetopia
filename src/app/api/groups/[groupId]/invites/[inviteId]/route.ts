import { ApiError, ok, requirePermission, route } from "@/server/api";
import { revokeInvite } from "@/server/repo";

type Ctx = { params: Promise<{ groupId: string; inviteId: string }> };

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { groupId, inviteId } = await params;
  await requirePermission(groupId, "createInvite");
  if (!(await revokeInvite(groupId, inviteId))) throw new ApiError(404, "notFound");
  return ok({ ok: true });
});
