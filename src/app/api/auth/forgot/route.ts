import { z } from "zod";
import { one } from "@/server/db";
import { clientIp, ok, parseBody, rateLimit, route } from "@/server/api";
import { sendResetEmail } from "@/server/emailTokens";
import { isDev } from "@/server/env";

const schema = z.object({ email: z.string().max(200) });

export const POST = route(async (req) => {
  const { email } = await parseBody(req, schema);
  await rateLimit(`forgot:${email.toLowerCase()}`, 3, 3600_000);
  await rateLimit(`forgot-ip:${clientIp(req)}`, 10, 3600_000);
  const user = await one<{ id: string; email: string; name: string; locale: string }>(
    "SELECT id, email, name, locale FROM users WHERE email = $1",
    [email.toLowerCase().trim()],
  );
  let link: string | undefined;
  if (user) link = await sendResetEmail(user);
  // Selalu sukses agar tidak membocorkan email mana yang terdaftar.
  return ok({ ok: true, devResetLink: isDev && !process.env.SMTP_URL ? link : undefined });
});
