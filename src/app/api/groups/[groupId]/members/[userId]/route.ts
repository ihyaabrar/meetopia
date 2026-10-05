import { z } from "zod";
import { sql } from "@/server/db";
import { ApiError, ok, parseBody, requirePermission, requireUser, route } from "@/server/api";
import { getRole } from "@/server/repo";
import { publishToRoom } from "@/realtime/bus";
import { canChangeRole, roleRank } from "@/shared/roles";

type Ctx = { params: Promise<{ groupId: string; userId: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { groupId, userId } = await params;
  const { role: actorRole } = await requirePermission(groupId, "manageMembers");
  const { role } = await parseBody(req, z.object({ role: z.enum(["admin", "member", "guest"]) }));
  const target = await getRole(userId, groupId);
  if (!target) throw new ApiError(404, "notFound");
  if (!canChangeRole(actorRole, target, role)) throw new ApiError(403, "forbidden");
  await sql("UPDATE memberships SET role = $3 WHERE user_id = $1 AND group_id = $2", [userId, groupId, role]);
  await publishToRoom(groupId, { control: { kind: "membership", userId, role } });
  return ok({ ok: true });
});

/** Mengeluarkan anggota (admin) atau keluar dari grup (diri sendiri). */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { groupId, userId } = await params;
  const me = await requireUser();
  const target = await getRole(userId, groupId);
  if (!target) throw new ApiError(404, "notFound");
  if (target === "owner") throw new ApiError(403, "forbidden");
  if (userId !== me.id) {
    const { role } = await requirePermission(groupId, "manageMembers");
    if (roleRank(target) >= roleRank(role)) throw new ApiError(403, "forbidden");
  }
  await sql("DELETE FROM memberships WHERE user_id = $1 AND group_id = $2", [userId, groupId]);
  await publishToRoom(groupId, { control: { kind: "membership", userId, role: null } });
  return ok({ ok: true });
});
