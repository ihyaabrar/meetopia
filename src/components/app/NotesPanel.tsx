"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/client/api";
import { useT, useI18n } from "@/i18n/client";
import { Icon } from "@/components/Icon";
import type { SharedNote } from "@/shared/protocol";
import { DocEditor } from "@/components/DocEditor";
import { emptyDoc, parseDoc, serializeDoc, todoProgress, type Doc } from "@/shared/doc";
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
  const [priv, setPriv] = useState<Doc | null>(null);
  const [wide, setWide] = useState(false);
  const [privState, setPrivState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Doc>(emptyDoc);
  const [draftBase, setDraftBase] = useState<string | null>(null);
  const [savingShared, setSavingShared] = useState(false);

  const [privError, setPrivError] = useState(false);
  const loadPriv = () => {
    setPrivError(false);
    api<{ note: { content: string } }>("/api/notes/me")
      .then((r) => setPriv(parseDoc(r.note.content)))
      .catch(() => setPrivError(true));
  };
  useEffect(loadPriv, []);

  const changePriv = (v: Doc) => {
    setPriv(v);
    setPrivState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api("/api/notes/me", { method: "PUT", body: { content: serializeDoc(v) } })
        .then(() => setPrivState("saved"))
        .catch(() => setPrivState("error"));
    }, 700);
  };

  // Centang ceklis langsung terlihat; diganti versi server saat catatan bersama berubah.
  const [optimistic, setOptimistic] = useState<{ base: string | null; doc: Doc } | null>(null);
  const sharedDoc =
    optimistic && optimistic.base === (shared?.updatedAt ?? null)
      ? optimistic.doc
      : parseDoc(shared?.content ?? "");
  const progress = todoProgress(tab === "private" ? (priv ?? emptyDoc()) : editing ? draft : sharedDoc);
  const startEdit = () => {
    setDraft(parseDoc(shared?.content ?? ""));
    setDraftBase(shared?.updatedAt ?? null);
    setEditing(true);
  };
  const saveShared = async () => {
    setSavingShared(true);
    try {
      await api(`/api/groups/${groupId}/notes`, { method: "PUT", body: { content: serializeDoc(draft) } });
      setEditing(false);
    } finally {
      setSavingShared(false);
    }
  };
  /** Mode baca: mencentang ceklis langsung disimpan (tulisan terakhir menang, FR-67). */
  const toggleSharedTodo = (id: string) => {
    const next: Doc = {
      v: 1,
      blocks: sharedDoc.blocks.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b)),
    };
    setOptimistic({ base: shared?.updatedAt ?? null, doc: next });
    void api(`/api/groups/${groupId}/notes`, { method: "PUT", body: { content: serializeDoc(next) } }).catch(
      () => setOptimistic(null),
    );
  };
  const changedMeanwhile = editing && shared?.updatedAt !== draftBase && shared?.updatedBy !== selfId;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === "id" ? "id-ID" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <aside className={`side-panel notes-panel ${wide ? "wide" : ""}`} aria-label={t("notes.title")}>
      <header>
        <Icon name="notes" />
        <h3>{t("notes.title")}</h3>
        {progress.total > 0 && (
          <span
            className="todo-progress"
            title={t("doc.progress", { done: progress.done, total: progress.total })}
          >
            <Icon name="check" size={13} /> {progress.done}/{progress.total}
          </span>
        )}
        <button
          className="icon-btn"
          onClick={() => setWide((w) => !w)}
          aria-label={wide ? t("doc.narrow") : t("doc.widen")}
          title={wide ? t("doc.narrow") : t("doc.widen")}
          aria-pressed={wide}
        >
          <Icon name="monitor" size={18} />
        </button>
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
            {priv && <DocEditor doc={priv} onChange={changePriv} label={t("notes.private")} />}
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
                <DocEditor doc={draft} onChange={setDraft} label={t("notes.shared")} />
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
                {shared?.content ? (
                  <DocEditor
                    doc={sharedDoc}
                    readOnly
                    onToggleTodo={can(role, "editSharedNote") ? toggleSharedTodo : undefined}
                    label={t("notes.shared")}
                  />
                ) : (
                  <div className="doc readonly">
                    <span className="hint">{t("notes.sharedEmpty")}</span>
                  </div>
                )}
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
