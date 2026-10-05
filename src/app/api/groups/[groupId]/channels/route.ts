import { z } from "zod";
import { one } from "@/server/db";
import { ApiError, ok, parseBody, requirePermission, route } from "@/server/api";
import { MAX_CHANNELS, createChannel, normalizeChannelName } from "@/server/repo";
import { notifyGroupChanged } from "@/realtime/bus";

type Ctx = { params: Promise<{ groupId: string }> };

/** Membuat kanal teks baru (admin ke atas). */
export const POST = route<Ctx>(async (req, { params }) => {
  const { groupId } = await params;
  await requirePermission(groupId, "manageGroup");
  const body = await parseBody(req, z.object({ name: z.string().max(60) }));
  const name = normalizeChannelName(body.name);
  if (!name) throw new ApiError(400, "badRequest");
  const count = await one<{ n: number }>("SELECT COUNT(*)::int AS n FROM channels WHERE group_id = $1", [
    groupId,
  ]);
  if ((count?.n ?? 0) >= MAX_CHANNELS) throw new ApiError(409, "tooManyChannels");
  const channel = await createChannel(groupId, name);
  await notifyGroupChanged(groupId);
  return ok({ channel });
});
