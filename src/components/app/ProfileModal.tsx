"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorKey } from "@/client/api";
import { useI18n } from "@/i18n/client";
import { Modal } from "@/components/Modal";
import { AvatarBuilder } from "@/components/AvatarBuilder";
import { LOCALES, type Locale } from "@/i18n";
import type { Me } from "./types";

/** Pengaturan profil & avatar, bahasa, kontras tinggi, data pribadi, keluar. */
export function ProfileModal({
  me,
  onClose,
  onSaved,
}: {
  me: Me;
  onClose: () => void;
  onSaved: (me: Me) => void;
}) {
  const { t, setLocale } = useI18n();
  const router = useRouter();
  const [name, setName] = useState(me.name);
  const [avatar, setAvatar] = useState(me.avatar);
  const [locale, setLoc] = useState<Locale>((me.locale as Locale) ?? "id");
  const [contrast, setContrast] = useState(me.highContrast);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");

  const save = async () => {
    try {
      const r = await api<{ user: Me }>("/api/me", {
        method: "PATCH",
        body: { name, avatar, locale, highContrast: contrast },
      });
      setLocale(locale);
      document.documentElement.dataset.contrast = contrast ? "high" : "";
      onSaved(r.user);
      onClose();
    } catch (e) {
      setError(t(errorKey(e)));
    }
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };

  const resend = async () => {
    try {
      const r = await api<{ devVerifyLink?: string }>("/api/auth/resend", { method: "POST" });
      setInfo(r.devVerifyLink ? `${t("profile.verifySent")} ${r.devVerifyLink}` : t("profile.verifySent"));
    } catch (e) {
      setError(t(errorKey(e)));
    }
  };

  const deleteAccount = async () => {
    try {
      await api("/api/me", { method: "DELETE", body: { password } });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(t(errorKey(e)));
    }
  };

  return (
    <Modal title={t("profile.title")} onClose={onClose} wide>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="success-text" role="status" style={{ wordBreak: "break-all" }}>
          {info}
        </p>
      )}
      <div className="field">
        <label htmlFor="pf-name">{t("auth.displayName")}</label>
        <input
          id="pf-name"
          className="input"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <AvatarBuilder value={avatar} onChange={setAvatar} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginTop: 8,
        }}
      >
        <div className="field">
          <label htmlFor="pf-lang">{t("common.language")}</label>
          <select
            id="pf-lang"
            className="input"
            value={locale}
            onChange={(e) => setLoc(e.target.value as Locale)}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {l === "id" ? "Bahasa Indonesia" : "English"}
              </option>
            ))}
          </select>
        </div>
        <label className="row" style={{ alignSelf: "center" }}>
          <input type="checkbox" checked={contrast} onChange={(e) => setContrast(e.target.checked)} />
          <span>{t("profile.highContrast")}</span>
        </label>
      </div>
      <div className="list-row" style={{ marginTop: 8 }}>
        <div className="grow">
          <b>{me.email}</b>
          <div className="hint">{me.emailVerified ? t("profile.verified") : t("profile.notVerified")}</div>
        </div>
        {!me.emailVerified && (
          <button className="btn secondary small" onClick={resend}>
            {t("profile.resend")}
          </button>
        )}
      </div>
      <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <a className="btn secondary small" href="/api/me/export">
          {t("profile.export")}
        </a>
        <button className="btn ghost small" onClick={() => setDeleting((v) => !v)}>
          {t("profile.delete")}
        </button>
        <span className="spacer" />
        <button className="btn secondary small" onClick={logout}>
          {t("auth.logout")}
        </button>
      </div>
      {deleting && (
        <div className="list-row" style={{ marginTop: 10, borderColor: "var(--danger)" }}>
          <div className="grow">
            <div className="hint">{t("profile.deleteWarn")}</div>
            <input
              type="password"
              className="input"
              style={{ marginTop: 6 }}
              placeholder={t("auth.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label={t("auth.password")}
            />
          </div>
          <button className="btn danger small" disabled={!password} onClick={deleteAccount}>
            {t("profile.deleteConfirm")}
          </button>
        </div>
      )}
      <div className="modal-actions">
        <button className="btn secondary" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button className="btn" onClick={save}>
          {t("common.save")}
        </button>
      </div>
    </Modal>
  );
}
