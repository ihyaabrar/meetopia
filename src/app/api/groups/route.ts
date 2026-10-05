import { z } from "zod";
import { ok, parseBody, rateLimit, requireUser, route } from "@/server/api";
import { createGroup, listGroups } from "@/server/repo";
import { GROUP_COLOR_KEYS, GROUP_SYMBOLS } from "@/shared/groupIcon";

export const GET = route(async () => {
  const user = await requireUser();
  return ok({ groups: await listGroups(user.id) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`createGroup:${user.id}`, 10, 3600_000);
  const body = await parseBody(
    req,
    z.object({
      name: z.string().trim().min(1).max(60),
      iconColor: z.enum(GROUP_COLOR_KEYS).optional(),
      iconSymbol: z.enum(GROUP_SYMBOLS).optional(),
    }),
  );
  const id = await createGroup(user.id, body.name, { color: body.iconColor, symbol: body.iconSymbol });
  return ok({ id });
});
