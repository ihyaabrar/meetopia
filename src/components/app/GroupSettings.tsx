"use client";

import { useEffect, useState } from "react";
import { api, errorKey } from "@/client/api";
import { useI18n } from "@/i18n/client";
import { Modal } from "@/components/Modal";
import { AvatarCanvas } from "@/components/AvatarCanvas";
import { can, canChangeRole, type Role } from "@/shared/roles";
import type { GroupDetail } from "./types";

interface Invite {
  id: string;
  role: Role;
  expiresAt: string;
  maxUses: number | null;
  uses: number;
  revoked: boolean;
}

type Tab = "general" | "invites" | "members";

/** Pengaturan organisasi: nama, audio jarak, undangan (FR-02), anggota & peran (FR-03). */
export function GroupSettings({
  detail,
  selfId,
  initialTab,
  onClose,
  onChanged,
  onLeft,
}: {
  detail: GroupDetail;
  selfId: string;
  initialTab?: Tab;
  onClose: () => void;
  onChanged: () => void;
  onLeft: () => void;
}) {
  const { t, locale } = useI18n();
  const role = detail.role;
  const isAdmin = can(role, "manageGroup");
  const [tab, setTab] = useState<Tab>(initialTab ?? (isAdmin ? "general" : "members"));
  const [name, setName] = useState(detail.group.name);
  const [audio, setAudio] = useState(detail.audio);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [expires, setExpires] = useState(72);
  const [maxUses, setMaxUses] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<"member" | "guest">("member");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const loadInvites = () =>
    api<{ invites: Invite[] }>(`/api/groups/${detail.group.id}/invites`)
      .then((r) => setInvites(r.invites))
      .catch(() => {});
  useEffect(() => {
    if (tab === "invites" && can(role, "createInvite")) void loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (ok) setNotice(ok);
      onChanged();
    } catch (e) {
      setError(t(errorKey(e)));
    }
  };

  const saveGeneral = () =>
    run(
      () => api(`/api/groups/${detail.group.id}`, { method: "PATCH", body: { name, audio } }),
      t("common.saved"),
    );

  const createInvite = () =>
    run(async () => {
      const r = await api<{ url: string }>(`/api/groups/${detail.group.id}/invites`, {
        body: { expiresInHours: expires, maxUses: maxUses ? Number(maxUses) : null, role: inviteRole },
      });
      setNewLink(r.url);
      await navigator.clipboard?.writeText(r.url).catch(() => {});
      await loadInvites();
    });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === "id" ? "id-ID" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const tabs: Tab[] = isAdmin ? ["general", "invites", "members"] : ["members"];

  return (
    <Modal title={t("settings.title", { name: detail.group.name })} onClose={onClose} wide>
      <div className="chat-tabs" role="tablist" style={{ padding: 0, border: "none", marginBottom: 14 }}>
        {tabs.map((k) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {t(`settings.tab.${k}`)}
          </button>
        ))}
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success-text" role="status">
          {notice}
        </p>
      )}

      {tab === "general" && (
        <>
          <div className="field">
            <label htmlFor="gs-name">{t("group.name")}</label>
            <input
              id="gs-name"
              className="input"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="section-title" style={{ paddingLeft: 0 }}>
            {t("settings.audio")}
          </div>
          <p className="hint">{t("settings.audioHint")}</p>
          {(
            [
              ["radius", 2, 20, 0.5],
              ["fullVolumeRadius", 0, 8, 0.5],
              ["curve", 0.5, 3, 0.1],
            ] as const
          ).map(([k, min, max, step]) => (
            <div className="field" key={k}>
              <label htmlFor={`gs-${k}`}>
                {t(`settings.${k}`)}: <b>{audio[k]}</b>
              </label>
              <input
                id={`gs-${k}`}
                type="range"
                min={min}
                max={max}
                step={step}
                value={audio[k]}
                onChange={(e) => setAudio({ ...audio, [k]: Number(e.target.value) })}
              />
            </div>
          ))}
          <div className="modal-actions">
            {role === "owner" && (
              <button
                className="btn danger-outline"
                onClick={() => {
                  if (confirm(t("settings.deleteConfirm", { name: detail.group.name })))
                    void run(async () => {
                      await api(`/api/groups/${detail.group.id}`, { method: "DELETE" });
                      onLeft();
                    });
                }}
              >
                {t("settings.deleteGroup")}
              </button>
            )}
            <span className="spacer" />
            <button className="btn" onClick={saveGeneral} disabled={audio.fullVolumeRadius >= audio.radius}>
              {t("common.save")}
            </button>
          </div>
        </>
      )}

      {tab === "invites" && (
        <>
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}
          >
            <div className="field">
              <label htmlFor="inv-exp">{t("invite.expires")}</label>
              <select
                id="inv-exp"
                className="input"
                value={expires}
                onChange={(e) => setExpires(Number(e.target.value))}
              >
                {[1, 24, 72, 168, 720].map((h) => (
                  <option key={h} value={h}>
                    {t(`invite.exp.${h}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="inv-max">{t("invite.maxUses")}</label>
              <input
                id="inv-max"
                className="input"
                type="number"
                min={1}
                max={500}
                placeholder={t("invite.unlimited")}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="inv-role">{t("invite.role")}</label>
              <select
                id="inv-role"
                className="input"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "member" | "guest")}
              >
                <option value="member">{t("role.member")}</option>
                <option value="guest">{t("role.guest")}</option>
              </select>
            </div>
          </div>
          <button className="btn" onClick={createInvite}>
            {t("invite.create")}
          </button>
          {newLink && (
            <div className="list-row highlight" style={{ marginTop: 12 }}>
              <code className="grow" style={{ wordBreak: "break-all" }} data-testid="invite-link">
                {newLink}
              </code>
              <button className="btn small" onClick={() => navigator.clipboard?.writeText(newLink)}>
                {t("invite.copy")}
              </button>
            </div>
          )}
          <div className="section-title" style={{ paddingLeft: 0, marginTop: 16 }}>
            {t("invite.active")}
          </div>
          <div className="list">
            {invites.length === 0 && <p className="hint">{t("invite.none")}</p>}
            {invites.map((i) => {
              const expired = Date.parse(i.expiresAt) < now;
              const state = i.revoked
                ? t("invite.revoked")
                : expired
                  ? t("invite.expired")
                  : t("invite.validUntil", { time: fmt(i.expiresAt) });
              return (
                <div key={i.id} className="list-row">
                  <div className="grow">
                    <b>{t(`role.${i.role}`)}</b> · {t("invite.used", { n: i.uses, max: i.maxUses ?? "∞" })}
                    <div className="hint">{state}</div>
                  </div>
                  {!i.revoked && !expired && (
                    <button
                      className="btn secondary small"
                      onClick={() =>
                        run(async () => {
                          await api(`/api/groups/${detail.group.id}/invites/${i.id}`, { method: "DELETE" });
                          await loadInvites();
                        })
                      }
                    >
                      {t("invite.revoke")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "members" && (
        <div className="list">
          {detail.members.map((m) => (
            <div key={m.id} className="list-row">
              <AvatarCanvas avatar={m.avatar} size={32} face />
              <div className="grow">
                <b>{m.name}</b> {m.id === selfId && <span className="hint">({t("members.you")})</span>}
              </div>
              {can(role, "manageMembers") &&
              m.id !== selfId &&
              m.role !== "owner" &&
              canChangeRole(role, m.role, m.role) ? (
                <>
                  <select
                    className="input"
                    style={{ width: "auto", minHeight: 34 }}
                    value={m.role}
                    aria-label={t("invite.role")}
                    onChange={(e) =>
                      run(
                        () =>
                          api(`/api/groups/${detail.group.id}/members/${m.id}`, {
                            method: "PATCH",
                            body: { role: e.target.value },
                          }),
                        t("common.saved"),
                      )
                    }
                  >
                    {(["admin", "member", "guest"] as const)
                      .filter((r) => canChangeRole(role, m.role, r))
                      .map((r) => (
                        <option key={r} value={r}>
                          {t(`role.${r}`)}
                        </option>
                      ))}
                  </select>
                  <button
                    className="btn ghost small"
                    onClick={() =>
                      confirm(t("settings.removeConfirm", { name: m.name })) &&
                      run(() => api(`/api/groups/${detail.group.id}/members/${m.id}`, { method: "DELETE" }))
                    }
                  >
                    {t("settings.remove")}
                  </button>
                </>
              ) : (
                <span className="badge">{t(`role.${m.role}`)}</span>
              )}
            </div>
          ))}
          {role !== "owner" && (
            <div className="modal-actions">
              <button
                className="btn danger-outline"
                onClick={() =>
                  confirm(t("settings.leaveConfirm")) &&
                  run(async () => {
                    await api(`/api/groups/${detail.group.id}/members/${selfId}`, { method: "DELETE" });
                    onLeft();
                  })
                }
              >
                {t("settings.leave")}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
