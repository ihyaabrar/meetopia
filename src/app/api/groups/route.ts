import { z } from "zod";
import { ok, parseBody, rateLimit, requireUser, route } from "@/server/api";
import { createGroup, listGroups } from "@/server/repo";
import { getKv, keys } from "@/server/kv";
import { GROUP_COLOR_KEYS, GROUP_SYMBOLS } from "@/shared/groupIcon";
import { TEMPLATE_IDS } from "@/shared/templates";

export const GET = route(async () => {
  const user = await requireUser();
  const groups = await listGroups(user.id);
  // Jumlah orang yang sedang di ruangan tiap workspace (dari Redis); bila gagal, abaikan saja.
  const kv = await getKv().catch(() => null);
  const now = Date.now();
  const withOnline = await Promise.all(
    groups.map(async (g) => {
      if (!kv) return { ...g, inRoom: 0 };
      const raw = await kv.hgetall(keys.presence(g.id)).catch(() => ({}) as Record<string, string>);
      const inRoom = Object.values(raw).filter(
        (v) => now - (JSON.parse(v) as { seen: number }).seen < 90_000,
      ).length;
      return { ...g, inRoom };
    }),
  );
  return ok({ groups: withOnline });
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
      template: z.enum(TEMPLATE_IDS).optional(),
    }),
  );
  const id = await createGroup(
    user.id,
    body.name,
    { color: body.iconColor, symbol: body.iconSymbol },
    body.template,
  );
  return ok({ id });
});
