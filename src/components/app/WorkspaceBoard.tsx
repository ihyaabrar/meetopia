"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/client/api";
import type { RoomClient } from "@/client/roomClient";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/i18n/client";
import { can, type Role } from "@/shared/roles";
import type { WorkspaceEntry } from "@/shared/workspace";

export function WorkspaceBoard({
  groupId,
  selfId,
  role,
  room,
  initial,
  onClose,
}: {
  groupId: string;
  selfId: string;
  role: Role;
  room: RoomClient | null;
  initial: "agenda" | "task" | "resource";
  onClose: () => void;
}) {
  const { locale } = useI18n(),
    id = locale === "id";
  const [tab, setTab] = useState(initial),
    [entries, setEntries] = useState<WorkspaceEntry[]>([]),
    [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState(""),
    [detail, setDetail] = useState(""),
    [when, setWhen] = useState(""),
    [url, setUrl] = useState(""),
    [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await api<{ entries: WorkspaceEntry[] }>(`/api/groups/${groupId}/board`);
      setEntries(r.entries);
      setLoaded(true);
      setError("");
    } catch {
      setError(id ? "Data gagal dimuat. Coba lagi." : "Could not load workspace items. Retry.");
    }
  }, [groupId, id]);
  useEffect(() => {
    void load();
    return room?.on("workspaceChanged", () => void load());
  }, [load, room]);
  const writable = can(role, "editSharedNote");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
      return true;
    } catch {
      setError(
        id
          ? "Belum tersimpan. Periksa koneksi, ukuran file dan izinmu, lalu coba lagi."
          : "Not saved. Check your connection, file size and permissions, then retry.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const labels = {
    agenda: id ? "Agenda" : "Agenda",
    task: id ? "Tugas" : "Tasks",
    resource: id ? "File & tautan" : "Files & links",
  };
  const visible = entries
    .filter(
      (e) =>
        (tab === "resource" ? ["resource", "file"].includes(e.kind) : e.kind === tab) &&
        `${e.title} ${e.detail}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      tab === "agenda"
        ? new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime()
        : Number(a.completed) - Number(b.completed),
    );
  return (
    <Modal title={labels[tab]} onClose={onClose} wide bare>
      <div className="workspace-board">
        <div className="gallery-heading">
          <div>
            <span className="eyebrow">TEAM WORKSPACE</span>
            <h3>{labels[tab]}</h3>
            <p>
              {id
                ? "Rencana, pekerjaan, dan bahan tim—di satu tempat."
                : "Your team's plans, work and resources in one place."}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={id ? "Tutup" : "Close"}>
            <Icon name="x" />
          </button>
        </div>
        <div className="board-tabs" role="tablist">
          {(["agenda", "task", "resource"] as const).map((v) => (
            <button
              className="chip"
              key={v}
              role="tab"
              aria-selected={tab === v}
              onClick={() => {
                setTab(v);
                setError("");
              }}
            >
              {labels[v]}
            </button>
          ))}
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
            <button className="btn ghost small" onClick={() => void load()}>
              {id ? "Coba lagi" : "Retry"}
            </button>
          </p>
        )}
        {writable && (
          <form
            className="board-composer"
            onSubmit={async (e) => {
              e.preventDefault();
              const success = await run(() =>
                api(`/api/groups/${groupId}/board`, {
                  method: "POST",
                  body: {
                    kind: tab,
                    title,
                    detail,
                    ...(tab === "agenda" ? { startsAt: new Date(when).toISOString() } : {}),
                    ...(tab === "resource" ? { url } : {}),
                  },
                }),
              );
              if (success) {
                setTitle("");
                setDetail("");
                setUrl("");
              }
            }}
          >
            <div>
              <label className="field">
                {id ? "Judul" : "Title"}
                <input
                  className="input"
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    tab === "agenda" ? "Weekly sync" : tab === "task" ? "Review desain avatar" : "Panduan tim"
                  }
                />
              </label>
              <label className="field">
                {id ? "Catatan (opsional)" : "Notes (optional)"}
                <input
                  className="input"
                  maxLength={500}
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                />
              </label>
              {tab === "agenda" && (
                <label className="field">
                  {id ? "Tanggal & waktu lokal" : "Local date & time"}
                  <input
                    className="input"
                    type="datetime-local"
                    required
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                  />
                </label>
              )}
              {tab === "resource" && (
                <label className="field">
                  URL
                  <input
                    className="input"
                    type="url"
                    pattern="https?://.*"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </label>
              )}
            </div>
            <button className="btn" disabled={busy}>
              {busy ? (id ? "Menyimpan…" : "Saving…") : id ? "Tambahkan" : "Add"}
            </button>
          </form>
        )}
        {tab === "resource" && writable && (
          <label className="file-pick">
            <span className="btn secondary small" aria-hidden="true">
              <Icon name="plus" size={14} />
              {id ? "Pilih file" : "Choose file"}
            </span>
            <span className="hint">
              {id ? "Maks. 2 MB per file; kuota workspace 20 MB" : "2 MB max per file; 20 MB workspace quota"}
            </span>
            <input
              className="sr-only"
              aria-label={id ? "Unggah file" : "Upload file"}
              type="file"
              disabled={busy}
              accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.pptx"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  setError(id ? "File melebihi 2 MB." : "File exceeds 2 MB.");
                  return;
                }
                const form = new FormData();
                form.append("file", file);
                await run(async () => {
                  const res = await fetch(`/api/groups/${groupId}/files`, { method: "POST", body: form });
                  if (!res.ok) throw Error("upload");
                });
                e.target.value = "";
              }}
            />
          </label>
        )}
        <label className="gallery-search" style={{ marginTop: 18 }}>
          <Icon name="search" size={16} />
          <input
            aria-label={id ? "Cari item" : "Search items"}
            placeholder={id ? "Cari di workspace…" : "Search workspace…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {!loaded ? (
          <p role="status">{id ? "Memuat…" : "Loading…"}</p>
        ) : (
          <div className="board-list">
            {visible.map((entry) => (
              <article className={`board-entry ${entry.completed ? "completed" : ""}`} key={entry.id}>
                {entry.kind === "task" && (
                  <input
                    type="checkbox"
                    checked={entry.completed}
                    disabled={!writable || busy}
                    aria-label={`${id ? "Selesai" : "Complete"}: ${entry.title}`}
                    onChange={(e) =>
                      void run(() =>
                        api(`/api/groups/${groupId}/board/${entry.id}`, {
                          method: "PATCH",
                          body: { completed: e.target.checked },
                        }),
                      )
                    }
                  />
                )}
                <div className="grow">
                  <h4>{entry.title}</h4>
                  {entry.detail && <p className="hint">{entry.detail}</p>}
                  <span className="hint">
                    {entry.startsAt
                      ? new Date(entry.startsAt).toLocaleString(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : (entry.createdByName ?? "Meetopia")}
                    {entry.fileSize ? ` · ${(entry.fileSize / 1024).toFixed(0)} KB` : ""}
                  </span>
                </div>
                {entry.kind === "resource" && (
                  <a
                    className="btn secondary small"
                    href={entry.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {id ? "Buka" : "Open"}
                    <Icon name="arrow" size={14} />
                  </a>
                )}
                {entry.kind === "file" && (
                  <a
                    className="btn secondary small"
                    href={`/api/groups/${groupId}/files/${entry.id}`}
                    download
                  >
                    {id ? "Unduh" : "Download"}
                  </a>
                )}
                {writable && (entry.createdBy === selfId || can(role, "manageGroup")) && (
                  <button
                    className="icon-btn"
                    disabled={busy}
                    aria-label={`${id ? "Hapus" : "Delete"}: ${entry.title}`}
                    onClick={() => {
                      if (confirm(id ? "Hapus item ini?" : "Delete this item?"))
                        void run(() => api(`/api/groups/${groupId}/board/${entry.id}`, { method: "DELETE" }));
                    }}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </article>
            ))}
            {!visible.length && (
              <div className="board-empty">
                <Icon name={tab === "task" ? "check" : "notes"} size={32} />
                <h4>
                  {query ? (id ? "Tidak ada hasil" : "No results") : id ? "Belum ada item" : "No items yet"}
                </h4>
                <p>{id ? "Tambahkan item pertama untuk timmu." : "Add your team's first item."}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
