"use client";

import Link from "next/link";
import { useState } from "react";
import { PublicShell } from "@/components/PublicShell";
import { useT } from "@/i18n/client";
import { api, errorKey } from "@/client/api";

export default function ForgotPage() {
  const t = useT();
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const r = await api<{ devResetLink?: string }>("/api/auth/forgot", {
        body: { email: new FormData(e.currentTarget).get("email") },
      });
      setDevLink(r.devResetLink ?? null);
      setSent(true);
    } catch (err) {
      setError(t(errorKey(err)));
    }
  }

  return (
    <PublicShell showAuth={false}>
      <div className="auth-wrap">
        <form className="card auth-card" onSubmit={submit}>
          <h1>{t("auth.forgotTitle")}</h1>
          <p className="sub">{t("auth.forgotSub")}</p>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          {sent ? (
            <>
              <p className="success-text" role="status">
                {t("auth.forgotSent")}
              </p>
              {devLink && (
                <p className="hint">
                  {t("auth.devLink")} <a href={devLink}>{devLink}</a>
                </p>
              )}
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="email">{t("auth.email")}</label>
                <input id="email" name="email" type="email" className="input" required />
              </div>
              <button className="btn block">{t("auth.sendReset")}</button>
            </>
          )}
          <p className="auth-alt">
            <Link href="/login">{t("common.back")}</Link>
          </p>
        </form>
      </div>
    </PublicShell>
  );
}
