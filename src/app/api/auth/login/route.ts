import { z } from "zod";
import { authSecret } from "@/server/env";
import { one } from "@/server/db";
import { ApiError, clientIp, ok, parseBody, rateCount, rateHit, route } from "@/server/api";
import { setSessionCookie, verifyPassword } from "@/server/auth";

const schema = z.object({ email: z.string().max(200), password: z.string().max(200) });

/**
 * Hanya percobaan GAGAL yang dihitung, per email dan per IP, di Redis (berlaku di semua instance).
 * Dengan begitu pemilik akun yang login benar tidak ikut terkunci oleh percobaan orang lain dari IP lain
 * sampai batas per email tercapai.
 */
const WINDOW = 15 * 60_000;
const MAX_FAIL_EMAIL = 10;
const MAX_FAIL_IP = 30;
/** Hash acak: bcrypt tetap dijalankan untuk email yang tidak terdaftar agar waktunya sama. */
const DUMMY_HASH = "$2b$10$6FNInlOsEPzVi8rGb281v.w/RZv7v3oW2jRMq16wgZ6jYQy4PgCaS";

export const POST = route(async (req) => {
  authSecret(); // gagal lebih awal bila AUTH_SECRET belum diisi, sebelum ada data yang disimpan
  const body = await parseBody(req, schema);
  const email = body.email.toLowerCase().trim();
  const emailKey = `login-fail:${email}`;
  const ipKey = `login-fail-ip:${clientIp(req)}`;
  const [byEmail, byIp] = await Promise.all([rateCount(emailKey, WINDOW), rateCount(ipKey, WINDOW)]);
  if (byEmail >= MAX_FAIL_EMAIL || byIp >= MAX_FAIL_IP) throw new ApiError(429, "rateLimited");
  const user = await one<{ id: string; password_hash: string; session_version: number }>(
    "SELECT id, password_hash, session_version FROM users WHERE email = $1",
    [email],
  );
  const valid = await verifyPassword(body.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) {
    await Promise.all([rateHit(emailKey, WINDOW), rateHit(ipKey, WINDOW)]);
    throw new ApiError(401, "invalidCredentials");
  }
  await setSessionCookie(user.id, user.session_version);
  return ok({ id: user.id });
});
