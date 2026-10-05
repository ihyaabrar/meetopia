"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PublicShell } from "@/components/PublicShell";
import { useT } from "@/i18n/client";
import { api, errorKey } from "@/client/api";

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/app";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: { email: f.get("email"), password: f.get("password") } });
      router.replace(next.startsWith("/") ? next : "/app");
      router.refresh();
    } catch (err) {
      setError(t(errorKey(err)));
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>{t("auth.loginTitle")}</h1>
        <p className="sub">{t("auth.loginSub")}</p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="field">
          <label htmlFor="email">{t("auth.email")}</label>
          <input id="email" name="email" type="email" className="input" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">{t("auth.password")}</label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            required
            autoComplete="current-password"
          />
        </div>
        <button className="btn block" disabled={busy}>
          {busy ? t("common.loading") : t("auth.login")}
        </button>
        <p className="auth-alt">
          <Link href="/forgot">{t("auth.forgot")}</Link>
        </p>
        <p className="auth-alt">
          {t("auth.noAccount")}{" "}
          <Link href={`/register${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`}>
            {t("auth.register")}
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <PublicShell showAuth={false}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </PublicShell>
  );
}
