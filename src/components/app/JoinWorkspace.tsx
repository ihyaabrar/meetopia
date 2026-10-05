"use client";

import { useState } from "react";
import { api, errorKey } from "@/client/api";
import { useT } from "@/i18n/client";
import { Modal } from "@/components/Modal";

/** Gabung workspace dengan kode undangan dari rekan. */
export function JoinWorkspace({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: (groupId: string) => void;
}) {
  const t = useT();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ groupId: string }>("/api/invites/join", { body: { code } });
      onJoined(r.groupId);
    } catch (err) {
      setError(t(errorKey(err)));
      setBusy(false);
    }
  };
  return (
    <Modal title={t("ws.joinModal")} sub={t("ws.joinModalSub")} onClose={onClose}>
      <form onSubmit={submit}>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="field">
          <label htmlFor="join-code">{t("inv.code")}</label>
          <input
            id="join-code"
            className="input code"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={12}
            placeholder={t("ws.codePlaceholder")}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn" disabled={busy || code.trim().length < 4}>
            {t("ws.joinSubmit")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
