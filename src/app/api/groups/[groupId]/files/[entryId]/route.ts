import { route, requirePermission, ApiError } from "@/server/api";
import { one } from "@/server/db";
type Ctx = { params: Promise<{ groupId: string; entryId: string }> };
export const GET = route<Ctx>(async (_req, { params }) => {
  const { groupId, entryId } = await params;
  await requirePermission(groupId, "enterRoom");
  const file = await one<{ title: string; file_data: string; file_mime: string }>(
    "SELECT title,file_data,file_mime FROM workspace_entries WHERE id=$1 AND group_id=$2 AND kind='file'",
    [entryId, groupId],
  );
  if (!file) throw new ApiError(404, "notFound");
  const data = Buffer.from(file.file_data, "base64");
  return new Response(data, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.title)}`,
      "Content-Length": String(data.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "sandbox",
    },
  });
});
