import { ok, requirePermission, route } from "@/server/api";
import { createRealtimeToken } from "@/server/tokens";

/** Token singkat untuk membuka WebSocket ruangan; hanya untuk anggota grup. */
export const POST = route<{ params: Promise<{ groupId: string }> }>(async (_req, { params }) => {
  const { groupId } = await params;
  const { user } = await requirePermission(groupId, "enterRoom");
  return ok({ token: await createRealtimeToken(user.id, groupId) });
});
