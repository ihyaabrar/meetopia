"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/client/api";
import { useT, useI18n } from "@/i18n/client";
import { Icon } from "@/components/Icon";
import type { SharedNote } from "@/shared/protocol";
import { can, type Role } from "@/shared/roles";

interface Props {
  groupId: string;
  role: Role;
  shared: SharedNote | null;
  selfId: string;
  tab: "private" | "shared";
  setTab: (t: "private" | "shared") => void;
  onClose: () => void;
}

/**
 * Catatan (M5). Pribadi: tersimpan otomatis, hanya pemilik yang membaca (FR-66).
 * Bersama per ruangan: semua anggota membaca, diedit bergantian; tulisan terakhir yang disimpan menang (FR-67).
 */
export function NotesPanel({ groupId, role, shared, selfId, tab, setTab, onClose }: Props) {
  const t = useT();
  const { locale } = useI18n();
  const [priv, setPriv] = useState<string | null>(null);
  const [privState, setPrivState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftBase, setDraftBase] = useState<string | null>(null);
  const [savingShared, setSavingShared] = useState(false);

  const [privError, setPrivError] = useState(false);
  const loadPriv = () => {
    setPrivError(false);
    api<{ note: { content: string } }>("/api/notes/me")
      .then((r) => setPriv(r.note.content))
      .catch(() => setPrivError(true));
  };
  useEffect(loadPriv, []);

  const changePriv = (v: string) => {
    setPriv(v);
    setPrivState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api("/api/notes/me", { method: "PUT", body: { content: v } })
        .then(() => setPrivState("saved"))
        .catch(() => setPrivState("error"));
    }, 700);
  };

  const startEdit = () => {
    setDraft(shared?.content ?? "");
    setDraftBase(shared?.updatedAt ?? null);
    setEditing(true);
  };
  const saveShared = async () => {
    setSavingShared(true);
    try {
      await api(`/api/groups/${groupId}/notes`, { method: "PUT", body: { content: draft } });
      setEditing(false);
    } finally {
      setSavingShared(false);
    }
  };
  const changedMeanwhile = editing && shared?.updatedAt !== draftBase && shared?.updatedBy !== selfId;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === "id" ? "id-ID" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <aside className="side-panel" aria-label={t("notes.title")}>
      <header>
        <Icon name="notes" />
        <h3>{t("notes.title")}</h3>
        <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
          <Icon name="x" />
        </button>
      </header>
      <div className="chat-tabs" role="tablist">
        <button
          role="tab"
          className="tab"
          aria-selected={tab === "private"}
          onClick={() => setTab("private")}
        >
          {t("notes.private")}
        </button>
        <button role="tab" className="tab" aria-selected={tab === "shared"} onClick={() => setTab("shared")}>
          {t("notes.shared")}
        </button>
      </div>
      <div className="content">
        {tab === "private" ? (
          <>
            <p className="hint" style={{ margin: 0 }}>
              {t("notes.privateHint")}
            </p>
            {privError && (
              <p className="error-text" role="alert">
                {t("notes.loadError")}{" "}
                <button className="btn small secondary" onClick={loadPriv}>
                  {t("common.retry")}
                </button>
              </p>
            )}
            <textarea
              className="input"
              aria-label={t("notes.private")}
              value={priv ?? ""}
              disabled={priv === null}
              onChange={(e) => changePriv(e.target.value)}
              placeholder={t("notes.privatePlaceholder")}
            />
            <span className="hint" role="status">
              {privState === "saving"
                ? t("notes.saving")
                : privState === "saved"
                  ? t("notes.saved")
                  : privState === "error"
                    ? t("notes.saveError")
                    : ""}
            </span>
          </>
        ) : (
          <>
            <p className="hint" style={{ margin: 0 }}>
              {t("notes.sharedHint")}
            </p>
            {editing ? (
              <>
                {changedMeanwhile && (
                  <p className="pill warn" role="alert">
                    {t("notes.changedMeanwhile", { name: shared?.updatedByName ?? "?" })}
                  </p>
                )}
                <textarea
                  className="input"
                  aria-label={t("notes.shared")}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className="row">
                  <button className="btn secondary" onClick={() => setEditing(false)}>
                    {t("common.cancel")}
                  </button>
                  <span className="spacer" />
                  <button className="btn" onClick={saveShared} disabled={savingShared}>
                    {savingShared ? t("notes.saving") : t("common.save")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  className="input"
                  style={{ flex: 1, whiteSpace: "pre-wrap", overflowY: "auto", minHeight: 200 }}
                >
                  {shared?.content || <span className="hint">{t("notes.sharedEmpty")}</span>}
                </div>
                <div className="row">
                  <span className="hint" style={{ flex: 1 }}>
                    {shared?.updatedAt &&
                      t("notes.lastEdit", { name: shared.updatedByName ?? "?", time: fmt(shared.updatedAt) })}
                  </span>
                  {can(role, "editSharedNote") && (
                    <button className="btn" onClick={startEdit}>
                      {t("common.edit")}
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
