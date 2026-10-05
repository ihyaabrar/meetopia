import { z } from "zod";
import { one, sql } from "@/server/db";
import { ApiError, ok, parseBody, requirePermission, route } from "@/server/api";
import { channelInGroup, normalizeChannelName } from "@/server/repo";
import { notifyGroupChanged } from "@/realtime/bus";

type Ctx = { params: Promise<{ groupId: string; channelId: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { groupId, channelId } = await params;
  await requirePermission(groupId, "manageGroup");
  if (!(await channelInGroup(channelId, groupId))) throw new ApiError(404, "notFound");
  const body = await parseBody(req, z.object({ name: z.string().max(60) }));
  const name = normalizeChannelName(body.name);
  if (!name) throw new ApiError(400, "badRequest");
  await sql("UPDATE channels SET name = $2 WHERE id = $1", [channelId, name]);
  await notifyGroupChanged(groupId);
  return ok({ ok: true });
});

/** Menghapus kanal beserta pesannya. Kanal terakhir tidak bisa dihapus. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { groupId, channelId } = await params;
  await requirePermission(groupId, "manageGroup");
  if (!(await channelInGroup(channelId, groupId))) throw new ApiError(404, "notFound");
  const count = await one<{ n: number }>("SELECT COUNT(*)::int AS n FROM channels WHERE group_id = $1", [
    groupId,
  ]);
  if ((count?.n ?? 0) <= 1) throw new ApiError(409, "lastChannel");
  await sql("DELETE FROM channels WHERE id = $1", [channelId]);
  await notifyGroupChanged(groupId);
  return ok({ ok: true });
});
