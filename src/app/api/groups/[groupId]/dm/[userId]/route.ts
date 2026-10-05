import { ok, requirePermission, route } from "@/server/api";
import { dmHistory } from "@/server/repo";

type Ctx = { params: Promise<{ groupId: string; userId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { groupId, userId } = await params;
  const { user } = await requirePermission(groupId, "enterRoom");
  return ok({ messages: await dmHistory(groupId, user.id, userId) });
});
