import { ok, rateLimit, requireUser, route } from "@/server/api";
import { sendVerificationEmail } from "@/server/emailTokens";
import { emailVerificationEnabled, isDev } from "@/server/env";

export const POST = route(async () => {
  const user = await requireUser();
  rateLimit(`resend:${user.id}`, 3, 3600_000);
  if (user.emailVerified || !emailVerificationEnabled()) return ok({ ok: true });
  const link = await sendVerificationEmail(user);
  return ok({ ok: true, devVerifyLink: isDev && !process.env.SMTP_URL ? link : undefined });
});
