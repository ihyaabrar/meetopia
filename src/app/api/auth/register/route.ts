import { z } from "zod";
import { one, sql } from "@/server/db";
import { ApiError, ok, parseBody, rateLimit, route } from "@/server/api";
import { hashPassword, setSessionCookie } from "@/server/auth";
import { newId } from "@/server/ids";
import { sendVerificationEmail } from "@/server/emailTokens";
import { isDev } from "@/server/env";
import { sanitizeAvatar } from "@/shared/avatar";
import { isLocale } from "@/i18n";

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(40),
  avatar: z.unknown(),
  locale: z.string().optional(),
});

export const POST = route(async (req) => {
  rateLimit(`register:${req.headers.get("x-forwarded-for") ?? "local"}`, 10, 3600_000);
  const body = await parseBody(req, schema);
  const email = body.email.toLowerCase();
  if (await one("SELECT 1 FROM users WHERE email = $1", [email])) throw new ApiError(409, "emailTaken");
  const id = newId();
  const locale = isLocale(body.locale) ? body.locale : "id";
  await sql(
    "INSERT INTO users (id, email, password_hash, name, avatar, locale) VALUES ($1, $2, $3, $4, $5, $6)",
    [
      id,
      email,
      await hashPassword(body.password),
      body.name,
      JSON.stringify(sanitizeAvatar(body.avatar)),
      locale,
    ],
  );
  const link = await sendVerificationEmail({ id, email, name: body.name, locale });
  await setSessionCookie(id, 1);
  // Tanpa SMTP saat pengembangan, tautan dikembalikan agar mudah diuji.
  return ok({ id, devVerifyLink: isDev && !process.env.SMTP_URL ? link : undefined });
});
