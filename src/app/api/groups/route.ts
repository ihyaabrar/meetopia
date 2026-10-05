import { z } from "zod";
import { ok, parseBody, rateLimit, requireUser, route } from "@/server/api";
import { createGroup, listGroups } from "@/server/repo";

export const GET = route(async () => {
  const user = await requireUser();
  return ok({ groups: await listGroups(user.id) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`createGroup:${user.id}`, 10, 3600_000);
  const { name } = await parseBody(req, z.object({ name: z.string().trim().min(1).max(60) }));
  const id = await createGroup(user.id, name);
  return ok({ id });
});
