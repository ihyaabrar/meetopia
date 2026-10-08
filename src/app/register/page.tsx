"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNext } from "@/shared/redirect";
import { Suspense, useState } from "react";
import { PublicShell } from "@/components/PublicShell";
import { AvatarBuilder } from "@/components/AvatarBuilder";
import { AuthExperience } from "@/components/AuthExperience";
import { useI18n } from "@/i18n/client";
import { api, errorKey } from "@/client/api";
import { DEFAULT_AVATAR, type AvatarConfig } from "@/shared/avatar";

/** Pendaftaran dua langkah: akun, lalu nama + avatar dasar (FR-01, FR-59). */
function RegisterForm() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/app";
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) {
      if (password.length < 8) return setError(t("auth.passwordShort"));
      setError(null);
      if (!name) setName(email.split("@")[0].slice(0, 40));
      return setStep(2);
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ devVerifyLink?: string }>("/api/auth/register", {
        body: { email, password, name, avatar, locale },
      });
      if (r.devVerifyLink) sessionStorage.setItem("mt_dev_verify", r.devVerifyLink);
      router.replace(safeNext(next));
      router.refresh();
    } catch (err) {
      setError(t(errorKey(err)));
      if (err instanceof Error && err.message === "emailTaken") setStep(1);
      setBusy(false);
    }
  }

  return (
    <AuthExperience expanded={step === 2}>
      <form className={`card auth-card ${step === 2 ? "wide" : ""}`} onSubmit={submit}>
        <span className="step">{t("auth.step", { n: step, total: 2 })}</span>
        <h1 style={{ marginTop: 10 }}>{step === 1 ? t("auth.registerTitle") : t("auth.avatarTitle")}</h1>
        <p className="sub">{step === 1 ? t("auth.registerSub") : t("auth.avatarSub")}</p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {step === 1 ? (
          <>
            <div className="field">
              <label htmlFor="email">{t("auth.email")}</label>
              <input
                id="email"
                type="email"
                className="input"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">{t("auth.password")}</label>
              <input
                id="password"
                type="password"
                className="input"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="hint">{t("auth.passwordHint")}</span>
            </div>
            <button className="btn block">{t("common.next")}</button>
            <p className="auth-alt">
              {t("auth.haveAccount")} <Link href="/login">{t("auth.login")}</Link>
            </p>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="name">{t("auth.displayName")}</label>
              <input
                id="name"
                className="input"
                required
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <AvatarBuilder value={avatar} onChange={setAvatar} />
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setStep(1)}>
                {t("common.back")}
              </button>
              <button className="btn" disabled={busy}>
                {busy ? t("common.loading") : t("auth.finish")}
              </button>
            </div>
          </>
        )}
      </form>
    </AuthExperience>
  );
}

export default function RegisterPage() {
  return (
    <PublicShell showAuth={false}>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </PublicShell>
  );
}
