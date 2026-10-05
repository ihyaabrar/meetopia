import { z } from "zod";
import { ok, parseBody, requirePermission, route } from "@/server/api";
import { getSharedNote, saveSharedNote } from "@/server/repo";
import { publishToRoom } from "@/realtime/bus";

type Ctx = { params: Promise<{ groupId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { groupId } = await params;
  await requirePermission(groupId, "enterRoom");
  return ok({ note: await getSharedNote(groupId) });
});

export const PUT = route<Ctx>(async (req, { params }) => {
  const { groupId } = await params;
  const { user } = await requirePermission(groupId, "editSharedNote");
  const { content } = await parseBody(req, z.object({ content: z.string().max(50_000) }));
  const note = await saveSharedNote(groupId, user.id, content);
  await publishToRoom(groupId, { msg: { t: "sharedNote", note } });
  return ok({ note });
});
