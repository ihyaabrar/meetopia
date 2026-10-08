import { z } from "zod";
import { ok, route, parseBody, requirePermission, ApiError } from "@/server/api";
import { sql, one } from "@/server/db";
import { can } from "@/shared/roles";
import { publishToRoom } from "@/realtime/bus";
type Ctx = { params: Promise<{ groupId: string; entryId: string }> };
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { groupId, entryId } = await params;
  await requirePermission(groupId, "editSharedNote");
  const body = await parseBody(req, z.object({ completed: z.boolean() }));
  const rows = await sql(
    "UPDATE workspace_entries SET completed=$3 WHERE id=$1 AND group_id=$2 AND kind='task' RETURNING id",
    [entryId, groupId, body.completed],
  );
  if (!rows.length) throw new ApiError(404, "notFound");
  await publishToRoom(groupId, { msg: { t: "workspaceChanged" } });
  return ok({ ok: true });
});
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { groupId, entryId } = await params;
  const { user, role } = await requirePermission(groupId, "editSharedNote");
  const entry = await one<{ created_by: string }>(
    "SELECT created_by FROM workspace_entries WHERE id=$1 AND group_id=$2",
    [entryId, groupId],
  );
  if (!entry) throw new ApiError(404, "notFound");
  if (entry.created_by !== user.id && !can(role, "manageGroup")) throw new ApiError(403, "forbidden");
  await sql("DELETE FROM workspace_entries WHERE id=$1 AND group_id=$2", [entryId, groupId]);
  await publishToRoom(groupId, { msg: { t: "workspaceChanged" } });
  return ok({ ok: true });
});
