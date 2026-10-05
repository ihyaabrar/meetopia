"use client";

import { useState } from "react";
import { api, errorKey } from "@/client/api";
import { useI18n } from "@/i18n/client";
import { Modal } from "@/components/Modal";
import { STATUS_TEXT_MAX } from "@/shared/status";
import type { Me } from "./types";

const CLEAR_AFTER = ["never", "30m", "1h", "4h", "today"] as const;
type ClearAfter = (typeof CLEAR_AFTER)[number];
const SUGGESTIONS = ["focus", "lunch", "commute", "sick", "vacation"] as const;

function expiresAt(c: ClearAfter): string | null {
  const now = new Date();
  if (c === "never") return null;
  if (c === "today") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 0);
    return end.toISOString();
  }
  const mins = { "30m": 30, "1h": 60, "4h": 240 }[c];
  return new Date(now.getTime() + mins * 60_000).toISOString();
}

/** Atur status kustom (teks singkat) dan kapan otomatis dihapus. */
export function StatusEditor({
  me,
  onClose,
  onSaved,
}: {
  me: Me;
  onClose: () => void;
  onSaved: (me: Me) => void;
}) {
  const { t, locale } = useI18n();
  const [text, setText] = useState(me.statusText ?? "");
  const [clear, setClear] = useState<ClearAfter>("today");
  const [error, setError] = useState<string | null>(null);

  const save = async (value: string | null) => {
    try {
      const r = await api<{ user: Me }>("/api/me", {
        method: "PATCH",
        body: { statusText: value, statusExpiresAt: value ? expiresAt(clear) : null },
      });
      onSaved(r.user);
      onClose();
    } catch (e) {
      setError(t(errorKey(e)));
    }
  };

  const until = me.statusExpiresAt
    ? new Date(me.statusExpiresAt).toLocaleString(locale === "id" ? "id-ID" : "en-US", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Modal title={t("cs.title")} sub={t("cs.sub")} onClose={onClose}>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(text.trim() || null);
        }}
      >
        <div className="field">
          <label htmlFor="cs-text">{t("cs.label")}</label>
          <input
            id="cs-text"
            className="input"
            maxLength={STATUS_TEXT_MAX}
            placeholder={t("cs.placeholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {me.statusText && until && <span className="hint">{t("cs.until", { time: until })}</span>}
        </div>
        <div className="chips" style={{ marginBottom: 14 }}>
          {SUGGESTIONS.map((k) => (
            <button key={k} type="button" className="chip" onClick={() => setText(t(`cs.s.${k}`))}>
              {t(`cs.s.${k}`)}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="cs-clear">{t("cs.clearAfter")}</label>
          <select
            id="cs-clear"
            className="input"
            value={clear}
            onChange={(e) => setClear(e.target.value as ClearAfter)}
          >
            {CLEAR_AFTER.map((c) => (
              <option key={c} value={c}>
                {t(`cs.clear.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          {me.statusText && (
            <button type="button" className="btn ghost" onClick={() => void save(null)}>
              {t("cs.remove")}
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn" disabled={!text.trim() && !me.statusText}>
            {t("common.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
