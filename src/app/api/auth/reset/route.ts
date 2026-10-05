import { z } from "zod";
import { one } from "@/server/db";
import { ApiError, ok, parseBody, route } from "@/server/api";
import { hashPassword, setSessionCookie } from "@/server/auth";
import { consumeEmailToken } from "@/server/emailTokens";

const schema = z.object({ token: z.string().max(200), password: z.string().min(8).max(200) });

export const POST = route(async (req) => {
  const body = await parseBody(req, schema);
  const userId = await consumeEmailToken(body.token, "reset");
  if (!userId) throw new ApiError(400, "invalidToken");
  // Naikkan session_version: semua sesi lama otomatis tidak berlaku.
  const r = await one<{ session_version: number }>(
    `UPDATE users SET password_hash = $2, session_version = session_version + 1, email_verified_at = COALESCE(email_verified_at, now())
     WHERE id = $1 RETURNING session_version`,
    [userId, await hashPassword(body.password)],
  );
  await setSessionCookie(userId, r!.session_version);
  return ok({ ok: true });
});
