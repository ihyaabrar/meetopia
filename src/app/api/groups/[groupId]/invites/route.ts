import { z } from "zod";
import { ok, parseBody, requirePermission, route } from "@/server/api";
import { createInvite, listInvites } from "@/server/repo";
import { appUrl } from "@/server/env";

type Ctx = { params: Promise<{ groupId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { groupId } = await params;
  await requirePermission(groupId, "createInvite");
  return ok({ invites: await listInvites(groupId) });
});

const schema = z.object({
  expiresInHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .default(72),
  maxUses: z.number().int().min(1).max(500).nullable().default(null),
  role: z.enum(["member", "guest"]).default("member"),
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { groupId } = await params;
  const { user } = await requirePermission(groupId, "createInvite");
  const body = await parseBody(req, schema);
  const { token, invite } = await createInvite(groupId, user.id, body);
  return ok({ invite, url: `${appUrl(req)}/invite/${token}` });
});
