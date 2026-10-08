import { ok, route, requirePermission, ApiError, rateLimit } from "@/server/api";
import { transaction } from "@/server/db";
import { newId } from "@/server/ids";
import { publishToRoom } from "@/realtime/bus";
type Ctx = { params: Promise<{ groupId: string }> };
const MIMES = new Set([
  "application/pdf",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
export const POST = route<Ctx>(async (req, { params }) => {
  const { groupId } = await params;
  const { user } = await requirePermission(groupId, "editSharedNote");
  await rateLimit(`file:${groupId}:${user.id}`, 10, 60_000);
  if (Number(req.headers.get("content-length")) > 3 * 1024 * 1024) throw new ApiError(413, "fileTooLarge");
  // Enforce the actual streamed body limit too; Content-Length can be absent or untrusted.
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "badFileType");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    if (total > 3 * 1024 * 1024) {
      await reader.cancel();
      throw new ApiError(413, "fileTooLarge");
    }
    chunks.push(part.value);
  }
  const body = Buffer.concat(chunks, total);
  let form: FormData;
  try {
    form = await new Request(req.url, {
      method: "POST",
      headers: { "content-type": req.headers.get("content-type") ?? "" },
      body,
    }).formData();
  } catch {
    throw new ApiError(400, "badFileType");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 2 * 1024 * 1024)
    throw new ApiError(413, "fileTooLarge");
  if (!MIMES.has(file.type)) throw new ApiError(400, "badFileType");
  const data = Buffer.from(await file.arrayBuffer());
  const id = newId();
  const name = file.name.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 120) || "attachment";
  await transaction(async (q) => {
    await q.query("SELECT id FROM groups WHERE id=$1 FOR UPDATE", [groupId]);
    const quota = await q.query<{ size: number }>(
      "SELECT COALESCE(SUM(file_size),0)::int AS size FROM workspace_entries WHERE group_id=$1",
      [groupId],
    );
    if ((quota[0]?.size ?? 0) + file.size > 20 * 1024 * 1024) throw new ApiError(413, "fileQuota");
    await q.query(
      "INSERT INTO workspace_entries(id,group_id,kind,title,created_by,file_data,file_mime,file_size) VALUES($1,$2,'file',$3,$4,$5,$6,$7)",
      [id, groupId, name, user.id, data.toString("base64"), file.type, file.size],
    );
  });
  await publishToRoom(groupId, { msg: { t: "workspaceChanged" } });
  return ok({ id });
});
