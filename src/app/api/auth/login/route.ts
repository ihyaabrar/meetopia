import { z } from "zod";
import { authSecret } from "@/server/env";
import { one } from "@/server/db";
import { ApiError, ok, parseBody, rateLimit, route } from "@/server/api";
import { setSessionCookie, verifyPassword } from "@/server/auth";

const schema = z.object({ email: z.string().max(200), password: z.string().max(200) });

export const POST = route(async (req) => {
  authSecret(); // gagal lebih awal bila AUTH_SECRET belum diisi, sebelum ada data yang disimpan
  const body = await parseBody(req, schema);
  const email = body.email.toLowerCase().trim();
  rateLimit(`login:${email}`, 10, 15 * 60_000);
  const user = await one<{ id: string; password_hash: string; session_version: number }>(
    "SELECT id, password_hash, session_version FROM users WHERE email = $1",
    [email],
  );
  if (!user || !(await verifyPassword(body.password, user.password_hash)))
    throw new ApiError(401, "invalidCredentials");
  await setSessionCookie(user.id, user.session_version);
  return ok({ id: user.id });
});
