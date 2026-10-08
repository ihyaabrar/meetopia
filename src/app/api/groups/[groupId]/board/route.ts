import { ok, route, parseBody, requirePermission, rateLimit } from "@/server/api";
import { sql } from "@/server/db";
import { newId } from "@/server/ids";
import { entrySchema } from "@/shared/workspace";
import { publishToRoom } from "@/realtime/bus";
type Ctx = { params: Promise<{ groupId: string }> };
export const GET = route<Ctx>(async (_req, { params }) => {
  const { groupId } = await params;
  await requirePermission(groupId, "enterRoom");
  const entries = await sql(
    `SELECT e.id,e.kind,e.title,e.detail,e.url,e.starts_at AS "startsAt",e.completed,e.created_by AS "createdBy",u.name AS "createdByName",e.created_at AS "createdAt",e.file_size AS "fileSize" FROM workspace_entries e LEFT JOIN users u ON e.created_by=u.id WHERE e.group_id=$1 ORDER BY e.created_at DESC LIMIT 300`,
    [groupId],
  );
  return ok({ entries });
});
export const POST = route<Ctx>(async (req, { params }) => {
  const { groupId } = await params;
  const { user } = await requirePermission(groupId, "editSharedNote");
  const body = await parseBody(req, entrySchema);
  await rateLimit(`board:${groupId}:${user.id}`, 30, 60_000);
  const id = newId();
  await sql(
    `INSERT INTO workspace_entries(id,group_id,kind,title,detail,url,starts_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, groupId, body.kind, body.title, body.detail, body.url ?? null, body.startsAt ?? null, user.id],
  );
  await publishToRoom(groupId, { msg: { t: "workspaceChanged" } });
  return ok({ id });
});
