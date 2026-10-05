"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PublicShell } from "@/components/PublicShell";
import { LogoMark } from "@/components/Logo";
import { useT } from "@/i18n/client";
import { api, errorKey } from "@/client/api";

export function InviteView({
  token,
  loggedIn,
  groupName,
  reason,
}: {
  token: string;
  loggedIn: boolean;
  groupName: string | null;
  reason: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const next = `/invite/${token}`;

  async function join() {
    try {
      const r = await api<{ groupId: string }>(`/api/invites/${token}`, { method: "POST" });
      router.replace(`/app?g=${r.groupId}`);
    } catch (e) {
      setError(t(errorKey(e)));
    }
  }

  return (
    <PublicShell showAuth={false}>
      <div className="auth-wrap">
        <div className="card auth-card" style={{ textAlign: "center" }}>
          <LogoMark size={56} />
          {groupName ? (
            <>
              <p className="sub" style={{ marginTop: 14, marginBottom: 4 }}>
                {t("invite.youAreInvited")}
              </p>
              <h1>{groupName}</h1>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              {loggedIn ? (
                <button className="btn block" style={{ marginTop: 16 }} onClick={join}>
                  {t("invite.join")}
                </button>
              ) : (
                <div className="row" style={{ marginTop: 16, justifyContent: "center" }}>
                  <Link className="btn" href={`/register?next=${encodeURIComponent(next)}`}>
                    {t("auth.register")}
                  </Link>
                  <Link className="btn secondary" href={`/login?next=${encodeURIComponent(next)}`}>
                    {t("auth.login")}
                  </Link>
                </div>
              )}
            </>
          ) : (
            <>
              <h1 style={{ marginTop: 14 }}>{t("invite.invalid")}</h1>
              <p className="sub">{t(`invite.reason.${reason}`)}</p>
              <Link className="btn" href="/app">
                {t("verify.open")}
              </Link>
            </>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
