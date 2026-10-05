"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorKey } from "@/client/api";
import { useT } from "@/i18n/client";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";

interface Invite {
  id: string;
  code: string | null;
  expiresAt: string;
  maxUses: number | null;
  uses: number;
  revoked: boolean;
}

/** Undang anggota (sesuai desain): tautan + kode undangan, salin, dan reset. */
export function InviteModal({
  groupId,
  groupName,
  onClose,
  onAdvanced,
}: {
  groupId: string;
  groupName: string;
  onClose: () => void;
  /** Buka pengaturan undangan lengkap (masa berlaku, batas pemakaian, peran). */
  onAdvanced: () => void;
}) {
  const t = useT();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/groups/${groupId}/invites`;

  const create = useCallback(
    () =>
      api<{ invite: Invite }>(base, { body: { expiresInHours: 168, maxUses: null, role: "member" } }).then(
        (r) => setInvite(r.invite),
      ),
    [base],
  );

  useEffect(() => {
    api<{ invites: Invite[] }>(base)
      .then((r) => {
        const now = Date.now();
        const valid = r.invites.find(
          (i) =>
            i.code &&
            !i.revoked &&
            Date.parse(i.expiresAt) > now &&
            (i.maxUses === null || i.uses < i.maxUses),
        );
        return valid ? setInvite(valid) : create();
      })
      .catch((e) => setError(t(errorKey(e))));
  }, [base, create, t]);

  const link = invite?.code ? `${location.origin}/invite/${invite.code}` : "";

  const copy = async (what: "link" | "code") => {
    await navigator.clipboard?.writeText(what === "link" ? link : (invite?.code ?? "")).catch(() => {});
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  };

  const reset = async () => {
    if (!invite) return;
    setBusy(true);
    try {
      await api(`${base}/${invite.id}`, { method: "DELETE" });
      await create();
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("inv.title")} sub={t("inv.sub", { name: groupName })} onClose={onClose}>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="field">
        <label htmlFor="inv-link">{t("inv.link")}</label>
        <div className="copy-field">
          <input id="inv-link" className="input" readOnly value={link} data-testid="invite-link" />
          <button
            className="icon-btn"
            onClick={() => void copy("link")}
            aria-label={t("invite.copy")}
            title={t("invite.copy")}
            disabled={!link}
          >
            <Icon name={copied === "link" ? "check" : "copy"} size={16} />
          </button>
        </div>
      </div>
      <button className="btn block" onClick={() => void copy("link")} disabled={!link}>
        {copied === "link" ? t("gs.copied") : t("inv.copyLink")}
      </button>
      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="inv-code">{t("inv.code")}</label>
        <div className="copy-field">
          <input id="inv-code" className="input code" readOnly value={invite?.code ?? ""} />
          <button
            className="icon-btn"
            onClick={() => void copy("code")}
            aria-label={t("inv.copyCode")}
            title={t("inv.copyCode")}
            disabled={!invite?.code}
          >
            <Icon name={copied === "code" ? "check" : "copy"} size={16} />
          </button>
          <button className="btn ghost small" onClick={() => void reset()} disabled={busy || !invite}>
            <Icon name="refresh" size={14} /> {t("inv.reset")}
          </button>
        </div>
        <span className="hint">{t("inv.hint")}</span>
      </div>
      <div className="modal-actions">
        <button className="btn ghost small" onClick={onAdvanced}>
          {t("inv.advanced")}
        </button>
      </div>
    </Modal>
  );
}
