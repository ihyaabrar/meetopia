import { ok, route } from "@/server/api";
import { clearSessionCookie } from "@/server/auth";

export const POST = route(async () => {
  await clearSessionCookie();
  return ok({ ok: true });
});
