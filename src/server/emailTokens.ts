import { one, sql } from "./db";
import { appUrl } from "./env";
import { hashToken, newToken } from "./ids";
import { sendMail } from "./mail";
import { translate, isLocale, DEFAULT_LOCALE } from "@/i18n";

type Kind = "verify" | "reset";

export async function issueEmailToken(userId: string, kind: Kind): Promise<string> {
  const token = newToken();
  const hours = kind === "verify" ? 48 : 1;
  await sql("INSERT INTO email_tokens (token_hash, user_id, kind, expires_at) VALUES ($1, $2, $3, $4)", [
    hashToken(token),
    userId,
    kind,
    new Date(Date.now() + hours * 3600_000).toISOString(),
  ]);
  return token;
}

/** Mengembalikan user_id bila token valid, lalu menandainya terpakai. */
export async function consumeEmailToken(token: string, kind: Kind): Promise<string | null> {
  const r = await one<{ user_id: string }>(
    `UPDATE email_tokens SET used_at = now()
     WHERE token_hash = $1 AND kind = $2 AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
    [hashToken(token), kind],
  );
  return r?.user_id ?? null;
}

export async function sendVerificationEmail(user: {
  id: string;
  email: string;
  name: string;
  locale: string;
}) {
  const token = await issueEmailToken(user.id, "verify");
  const link = `${appUrl()}/api/auth/verify?token=${token}`;
  const l = isLocale(user.locale) ? user.locale : DEFAULT_LOCALE;
  await sendMail({
    to: user.email,
    subject: translate(l, "email.verify.subject"),
    text: translate(l, "email.verify.body", { name: user.name, link }),
  });
  return link;
}

export async function sendResetEmail(user: { id: string; email: string; name: string; locale: string }) {
  const token = await issueEmailToken(user.id, "reset");
  const link = `${appUrl()}/reset?token=${token}`;
  const l = isLocale(user.locale) ? user.locale : DEFAULT_LOCALE;
  await sendMail({
    to: user.email,
    subject: translate(l, "email.reset.subject"),
    text: translate(l, "email.reset.body", { name: user.name, link }),
  });
  return link;
}
