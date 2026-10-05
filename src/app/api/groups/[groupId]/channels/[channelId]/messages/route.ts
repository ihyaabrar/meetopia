import { ApiError, ok, requirePermission, route } from "@/server/api";
import { channelHistory, channelInGroup } from "@/server/repo";

type Ctx = { params: Promise<{ groupId: string; channelId: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { groupId, channelId } = await params;
  await requirePermission(groupId, "readChannel");
  if (!(await channelInGroup(channelId, groupId))) throw new ApiError(404, "notFound");
  const before = new URL(req.url).searchParams.get("before") ?? undefined;
  return ok({ messages: await channelHistory(channelId, 50, before) });
});
