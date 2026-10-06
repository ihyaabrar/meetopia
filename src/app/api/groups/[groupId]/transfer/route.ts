import { z } from "zod";
import { one, transaction } from "@/server/db";
import { ApiError, ok, parseBody, requirePermission, route } from "@/server/api";
import { verifyPassword } from "@/server/auth";
import { getRole } from "@/server/repo";
import { notifyGroupChanged, publishToRoom } from "@/realtime/bus";

type Ctx = { params: Promise<{ groupId: string }> };

/** Menyerahkan kepemilikan grup ke anggota lain. Pemilik lama menjadi admin. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { groupId } = await params;
  const { user } = await requirePermission(groupId, "deleteGroup");
  const body = await parseBody(req, z.object({ userId: z.string().max(64), password: z.string().max(200) }));
  const row = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [
    user.id,
  ]);
  if (!row || !(await verifyPassword(body.password, row.password_hash)))
    throw new ApiError(401, "wrongPassword");
  if (body.userId === user.id) throw new ApiError(400, "badRequest");
  const target = await getRole(body.userId, groupId);
  if (!target) throw new ApiError(404, "notFound");
  if (target === "guest") throw new ApiError(409, "guestCannotOwn");
  // Satu transaksi: grup tidak pernah punya dua pemilik atau tanpa pemilik.
  await transaction(async (q) => {
    await q.query("UPDATE groups SET owner_id = $2 WHERE id = $1", [groupId, body.userId]);
    await q.query("UPDATE memberships SET role = 'owner' WHERE user_id = $1 AND group_id = $2", [
      body.userId,
      groupId,
    ]);
    await q.query("UPDATE memberships SET role = 'admin' WHERE user_id = $1 AND group_id = $2", [
      user.id,
      groupId,
    ]);
  });
  await publishToRoom(groupId, { control: { kind: "membership", userId: body.userId, role: "owner" } });
  await publishToRoom(groupId, { control: { kind: "membership", userId: user.id, role: "admin" } });
  await notifyGroupChanged(groupId);
  return ok({ ok: true });
});
