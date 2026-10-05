import { z } from "zod";
import { ApiError, ok, parseBody, rateLimit, requireUser, route } from "@/server/api";
import { acceptInviteCode } from "@/server/repo";

/** Gabung workspace dengan kode undangan pendek (mis. K7Q2MX). */
export const POST = route(async (req) => {
  const user = await requireUser();
  // Batasi tebakan kode.
  rateLimit(`joinCode:${user.id}`, 10, 10 * 60_000);
  const { code } = await parseBody(req, z.object({ code: z.string().min(4).max(20) }));
  const r = await acceptInviteCode(code, user.id);
  if (!r.ok)
    throw new ApiError(
      r.reason === "notFound" ? 404 : 410,
      r.reason === "notFound" ? "inviteCodeNotFound" : r.reason,
    );
  return ok({ groupId: r.groupId, groupName: r.groupName });
});
