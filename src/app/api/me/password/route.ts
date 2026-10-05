import { z } from "zod";
import { one } from "@/server/db";
import { ApiError, ok, parseBody, rateLimit, requireUser, route } from "@/server/api";
import { hashPassword, setSessionCookie, verifyPassword } from "@/server/auth";

const schema = z.object({ current: z.string().max(200), next: z.string().min(8).max(200) });

/** Ganti kata sandi dari dalam aplikasi. Sesi di perangkat lain ikut keluar; sesi ini tetap masuk. */
export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`password:${user.id}`, 10, 3600_000);
  const body = await parseBody(req, schema);
  const row = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [
    user.id,
  ]);
  if (!row || !(await verifyPassword(body.current, row.password_hash)))
    throw new ApiError(401, "wrongPassword");
  const r = await one<{ session_version: number }>(
    `UPDATE users SET password_hash = $2, session_version = session_version + 1 WHERE id = $1
     RETURNING session_version`,
    [user.id, await hashPassword(body.next)],
  );
  await setSessionCookie(user.id, r!.session_version);
  return ok({ ok: true });
});
