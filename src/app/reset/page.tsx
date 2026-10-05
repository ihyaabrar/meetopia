"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PublicShell } from "@/components/PublicShell";
import { useT } from "@/i18n/client";
import { api, errorKey } from "@/client/api";

function ResetForm() {
  const t = useT();
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    if (password.length < 8) return setError(t("auth.passwordShort"));
    try {
      await api("/api/auth/reset", { body: { token, password } });
      router.replace("/app");
      router.refresh();
    } catch (err) {
      setError(t(errorKey(err)));
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>{t("auth.resetTitle")}</h1>
        <p className="sub">{t("auth.resetSub")}</p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="field">
          <label htmlFor="password">{t("auth.newPassword")}</label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <button className="btn block">{t("auth.savePassword")}</button>
      </form>
    </div>
  );
}

export default function ResetPage() {
  return (
    <PublicShell showAuth={false}>
      <Suspense>
        <ResetForm />
      </Suspense>
    </PublicShell>
  );
}
