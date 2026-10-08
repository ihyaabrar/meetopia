"use client";

import { useEffect, useState } from "react";
import { api, errorKey } from "@/client/api";
import { useI18n } from "@/i18n/client";
import { AvatarCanvas } from "@/components/AvatarCanvas";
import { GroupIconPicker } from "@/components/GroupIconPicker";
import { Icon } from "@/components/Icon";
import { SettingsShell, type SettingsSection } from "@/components/SettingsShell";
import { can, canChangeRole, type Role } from "@/shared/roles";
import { isGroupColor, isGroupSymbol, type GroupColor, type GroupSymbol } from "@/shared/groupIcon";
import type { GroupDetail } from "./types";
import { TemplatePicker } from "@/components/TemplatePicker";
import { isTemplateId, type TemplateId } from "@/shared/templates";
import { DECAY_SPEEDS, type LifeSettings } from "@/shared/life";
import { Toggle } from "./UserSettings";
import { DEFAULT_APPEARANCE, type MapData } from "@/shared/map";
import { FurnitureEditor } from "./FurnitureEditor";

interface Invite {
  id: string;
  role: Role;
  expiresAt: string;
  maxUses: number | null;
  uses: number;
  revoked: boolean;
}

export type GroupSection =
  "overview" | "room" | "editor" | "life" | "channels" | "members" | "invites" | "danger";

/**
 * Pengaturan grup dengan menu: ringkasan (ikon, nama, deskripsi), ruangan (audio jarak), kanal,
 * anggota & peran (FR-03), undangan (FR-02), dan zona bahaya (serahkan, hapus, keluar).
 */
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
  initialTab?: GroupSection;
  onClose: () => void;
  onChanged: () => void;
  onLeft: () => void;
}) {
  const { t } = useI18n();
  const role = detail.role;
  const isAdmin = can(role, "manageGroup");
  const sections: SettingsSection<GroupSection>[] = isAdmin
    ? [
        { id: "overview", label: t("gs.overview"), icon: "edit", group: detail.group.name },
        { id: "room", label: t("gs.room"), icon: "door" },
        { id: "editor", label: "Editor furnitur", icon: "edit" },
        { id: "life", label: t("gs.life"), icon: "coffee" },
        { id: "channels", label: t("gs.channels"), icon: "hash" },
        { id: "members", label: t("gs.members"), icon: "users", group: t("gs.people") },
        { id: "invites", label: t("gs.invites"), icon: "link" },
        { id: "danger", label: t("us.dangerZone"), icon: "alert", danger: true, sep: true },
      ]
    : [
        { id: "members", label: t("gs.members"), icon: "users", group: detail.group.name },
        { id: "danger", label: t("settings.leave"), icon: "logout", danger: true, sep: true },
      ];
  const [section, setSection] = useState<GroupSection>(
    initialTab && sections.some((s) => s.id === initialTab) ? initialTab : sections[0].id,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const select = (s: GroupSection) => {
    setError(null);
    setNotice(null);
    setSection(s);
  };

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (ok) setNotice(ok);
      onChanged();
      return true;
    } catch (e) {
      setError(t(errorKey(e)));
      return false;
    }
  };

  const ctx = { detail, selfId, role, run };

  return (
    <SettingsShell
      title={t("settings.title", { name: detail.group.name })}
      sections={sections}
      active={section}
      onSelect={select}
      onClose={onClose}
    >
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
      {section === "overview" && <Overview {...ctx} />}
      {section === "room" && <RoomSection {...ctx} />}
      {section === "editor" && (
        <FurnitureEditor
          groupId={detail.group.id}
          onSaved={() => void run(async () => {}, t("common.saved"))}
        />
      )}
      {section === "life" && <LifeSection {...ctx} />}
      {section === "channels" && <Channels {...ctx} />}
      {section === "members" && <Members {...ctx} />}
      {section === "invites" && <Invites {...ctx} />}
      {section === "danger" && <Danger {...ctx} onLeft={onLeft} />}
    </SettingsShell>
  );
}

interface Ctx {
  detail: GroupDetail;
  selfId: string;
  role: Role;
  run: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;
}

function Overview({ detail, run }: Ctx) {
  const { t } = useI18n();
  const g = detail.group;
  const initial = {
    name: g.name,
    description: g.description,
    color: (isGroupColor(g.iconColor) ? g.iconColor : "green") as GroupColor,
    symbol: (isGroupSymbol(g.iconSymbol) ? g.iconSymbol : "initials") as GroupSymbol,
  };
  const [v, setV] = useState(initial);
  const changed = JSON.stringify(v) !== JSON.stringify(initial);
  const save = () =>
    run(
      () =>
        api(`/api/groups/${g.id}`, {
          method: "PATCH",
          body: { name: v.name, description: v.description, iconColor: v.color, iconSymbol: v.symbol },
        }),
      t("common.saved"),
    );
  return (
    <>
      <section className="setting-card" style={{ padding: 16 }}>
        <GroupIconPicker
          name={v.name}
          color={v.color}
          symbol={v.symbol}
          onChange={(i) => setV({ ...v, ...i })}
        />
      </section>
      <section className="setting-card" style={{ marginTop: 12 }}>
        <div className="field">
          <label htmlFor="gs-name">{t("group.name")}</label>
          <input
            id="gs-name"
            className="input"
            value={v.name}
            maxLength={60}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="gs-desc">{t("gs.description")}</label>
          <textarea
            id="gs-desc"
            className="input"
            rows={3}
            maxLength={200}
            placeholder={t("gs.descriptionPlaceholder")}
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
          />
          <span className="hint">{t("gs.descriptionHint")}</span>
        </div>
      </section>
      <div className="save-bar" data-visible={changed}>
        <span className="grow">{t("us.unsaved")}</span>
        <button className="btn ghost small" onClick={() => setV(initial)}>
          {t("us.reset")}
        </button>
        <button className="btn small" disabled={!v.name.trim()} onClick={save}>
          {t("common.save")}
        </button>
      </div>
    </>
  );
}

function RoomSection({ detail, run }: Ctx) {
  const { t } = useI18n();
  const [audio, setAudio] = useState(detail.audio);
  const changed = JSON.stringify(audio) !== JSON.stringify(detail.audio);
  const current: TemplateId = isTemplateId(detail.template) ? detail.template : "office";
  const [template, setTemplate] = useState<TemplateId>(current);
  const [map, setMap] = useState<MapData | null>(null);
  const [appearance, setAppearance] = useState(DEFAULT_APPEARANCE);
  const [saving, setSaving] = useState(false);
  const [mapError, setMapError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setMapError(false);
    void api<{ map: MapData }>(`/api/groups/${detail.group.id}/map`)
      .then((r) => {
        if (active) {
          setMap(r.map);
          setAppearance(r.map.appearance ?? DEFAULT_APPEARANCE);
        }
      })
      .catch(() => {
        if (active) setMapError(true);
      });
    return () => {
      active = false;
    };
  }, [detail.group.id, detail.template, retry]);
  const appearanceChanged =
    map && JSON.stringify(appearance) !== JSON.stringify(map.appearance ?? DEFAULT_APPEARANCE);
  return (
    <>
      <h3 className="settings-h3" style={{ marginTop: 0 }}>
        {t("tpl.choose")}
      </h3>
      <p className="hint">{t("tpl.changeHint")}</p>
      {mapError && (
        <p className="error-text" role="alert">
          Map gagal dimuat.{" "}
          <button className="btn secondary small" onClick={() => setRetry((v) => v + 1)}>
            Coba lagi
          </button>
        </p>
      )}
      <TemplatePicker
        value={template}
        onChange={setTemplate}
        current={current}
        appearance={appearance}
        onAppearance={setAppearance}
      />
      {appearanceChanged && (
        <div className="save-bar" data-visible="true">
          <span className="grow">Suasana, furnitur & ukuran belum disimpan</span>
          <button
            className="btn small"
            disabled={saving || template !== current}
            onClick={async () => {
              if (
                !map ||
                (appearance.roomSize !== (map.appearance ?? DEFAULT_APPEARANCE).roomSize &&
                  !confirm("Mengubah ukuran akan mengatur ulang posisi furnitur. Lanjutkan?"))
              )
                return;
              setSaving(true);
              await run(async () => {
                const r = await api<{ map: MapData }>(`/api/groups/${detail.group.id}/map`, {
                  method: "PATCH",
                  body: { appearance, expectedVersion: map.version },
                });
                setMap(r.map);
              }, t("common.saved"));
              setSaving(false);
            }}
          >
            Simpan suasana
          </button>
        </div>
      )}
      {template !== current && (
        <div className="row" style={{ marginTop: 10 }}>
          <span className="spacer" />
          <button className="btn secondary small" onClick={() => setTemplate(current)}>
            {t("common.cancel")}
          </button>
          <button
            className="btn small"
            onClick={() =>
              confirm(t("tpl.changeConfirm", { name: t(`tpl.${template}`) })) &&
              run(
                () => api(`/api/groups/${detail.group.id}`, { method: "PATCH", body: { template } }),
                t("common.saved"),
              )
            }
          >
            {t("tpl.change")}
          </button>
        </div>
      )}
      <h3 className="settings-h3">{t("settings.audio")}</h3>
      <p className="hint">{t("settings.audioHint")}</p>
      <section className="setting-card">
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
      </section>
      {audio.fullVolumeRadius >= audio.radius && <p className="error-text">{t("gs.audioInvalid")}</p>}
      <div className="save-bar" data-visible={changed}>
        <span className="grow">{t("us.unsaved")}</span>
        <button className="btn ghost small" onClick={() => setAudio(detail.audio)}>
          {t("us.reset")}
        </button>
        <button
          className="btn small"
          disabled={audio.fullVolumeRadius >= audio.radius}
          onClick={() =>
            run(
              () => api(`/api/groups/${detail.group.id}`, { method: "PATCH", body: { audio } }),
              t("common.saved"),
            )
          }
        >
          {t("common.save")}
        </button>
      </div>
    </>
  );
}

/** Karakter hidup & koin (Fase 2): admin bisa mematikan semuanya, efeknya, atau gajinya (aturan 6). */
function LifeSection({ detail, run }: Ctx) {
  const { t } = useI18n();
  const [life, setLife] = useState<LifeSettings>(detail.life);
  const changed = JSON.stringify(life) !== JSON.stringify(detail.life);
  const set = (patch: Partial<LifeSettings>) => setLife({ ...life, ...patch });
  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        {t("gs.lifeHint")}
      </p>
      <section className="setting-card">
        <Toggle
          id="gs-life-enabled"
          label={t("gs.lifeEnabled")}
          hint={t("gs.lifeEnabledHint")}
          checked={life.enabled}
          onChange={(v) => set({ enabled: v })}
        />
      </section>
      {life.enabled && (
        <>
          <section className="setting-card" style={{ marginTop: 12 }}>
            <div className="setting-row">
              <span className="grow">
                <b>{t("gs.lifeDecay")}</b>
              </span>
              <div className="seg" role="radiogroup" aria-label={t("gs.lifeDecay")}>
                {DECAY_SPEEDS.map((d) => (
                  <button
                    key={d}
                    role="radio"
                    aria-checked={life.decay === d}
                    className={`seg-btn ${life.decay === d ? "on" : ""}`}
                    onClick={() => set({ decay: d })}
                  >
                    {t(`gs.decay.${d}`)}
                  </button>
                ))}
              </div>
            </div>
            <Toggle
              id="gs-life-effects"
              label={t("gs.lifeEffects")}
              hint={t("gs.lifeEffectsHint")}
              checked={life.effects}
              onChange={(v) => set({ effects: v })}
            />
          </section>
          <section className="setting-card" style={{ marginTop: 12 }}>
            <Toggle
              id="gs-life-salary"
              label={t("gs.lifeSalary")}
              hint={t("gs.lifeSalaryHint")}
              checked={life.salary}
              onChange={(v) => set({ salary: v })}
            />
            {life.salary &&
              (
                [
                  ["coinsPerHour", 0, 300, 10],
                  ["dailyCap", 0, 2000, 20],
                ] as const
              ).map(([k, min, max, step]) => (
                <div className="field" key={k}>
                  <label htmlFor={`gs-${k}`}>
                    {t(`gs.${k}`)}: <b>{life[k]}</b>
                  </label>
                  <input
                    id={`gs-${k}`}
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={life[k]}
                    onChange={(e) => set({ [k]: Number(e.target.value) })}
                  />
                </div>
              ))}
          </section>
        </>
      )}
      <div className="save-bar" data-visible={changed}>
        <span className="grow">{t("us.unsaved")}</span>
        <button className="btn ghost small" onClick={() => setLife(detail.life)}>
          {t("us.reset")}
        </button>
        <button
          className="btn small"
          onClick={() =>
            run(
              () => api(`/api/groups/${detail.group.id}`, { method: "PATCH", body: { life } }),
              t("common.saved"),
            )
          }
        >
          {t("common.save")}
        </button>
      </div>
    </>
  );
}

function Channels({ detail, run }: Ctx) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const base = `/api/groups/${detail.group.id}/channels`;
  return (
    <>
      <p className="hint">{t("gs.channelsHint")}</p>
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api(base, { body: { name } }))) setName("");
        }}
      >
        <span className="input-prefix">
          <span aria-hidden>#</span>
          <input
            className="input"
            aria-label={t("gs.channelName")}
            placeholder={t("gs.channelPlaceholder")}
            maxLength={32}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </span>
        <button className="btn" disabled={!name.trim()}>
          <Icon name="plus" size={16} /> {t("gs.createChannel")}
        </button>
      </form>
      <section className="setting-card" style={{ marginTop: 14 }}>
        {detail.channels.map((c) => (
          <div className="setting-row" key={c.id}>
            {editing?.id === c.id ? (
              <form
                className="row grow"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await run(() => api(`${base}/${c.id}`, { method: "PATCH", body: { name: editing.name } }))
                  )
                    setEditing(null);
                }}
              >
                <span className="input-prefix grow">
                  <span aria-hidden>#</span>
                  <input
                    className="input"
                    autoFocus
                    aria-label={t("gs.channelName")}
                    maxLength={32}
                    value={editing.name}
                    onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                  />
                </span>
                <button type="button" className="btn secondary small" onClick={() => setEditing(null)}>
                  {t("common.cancel")}
                </button>
                <button className="btn small">{t("common.save")}</button>
              </form>
            ) : (
              <>
                <span className="hash-lg" aria-hidden>
                  #
                </span>
                <b className="grow">{c.name}</b>
                <button
                  className="icon-btn"
                  aria-label={t("gs.renameChannel", { name: c.name })}
                  title={t("gs.renameChannel", { name: c.name })}
                  onClick={() => setEditing({ id: c.id, name: c.name })}
                >
                  <Icon name="edit" size={16} />
                </button>
                <button
                  className="icon-btn danger"
                  disabled={detail.channels.length <= 1}
                  aria-label={t("gs.deleteChannel", { name: c.name })}
                  title={
                    detail.channels.length <= 1
                      ? t("error.lastChannel")
                      : t("gs.deleteChannel", { name: c.name })
                  }
                  onClick={() =>
                    confirm(t("gs.deleteChannelConfirm", { name: c.name })) &&
                    run(() => api(`${base}/${c.id}`, { method: "DELETE" }))
                  }
                >
                  <Icon name="trash" size={16} />
                </button>
              </>
            )}
          </div>
        ))}
      </section>
    </>
  );
}

function Members({ detail, selfId, role, run }: Ctx) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const list = detail.members.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      {detail.members.length > 6 && (
        <input
          className="input"
          style={{ marginBottom: 12 }}
          placeholder={t("gs.searchMembers")}
          aria-label={t("gs.searchMembers")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}
      <p className="hint">{t("gs.membersCount", { n: detail.members.length })}</p>
      <section className="setting-card">
        {list.map((m) => (
          <div key={m.id} className="setting-row">
            <AvatarCanvas avatar={m.avatar} size={36} face />
            <div className="grow" style={{ minWidth: 0 }}>
              <b>
                {m.name} {m.id === selfId && <span className="hint">({t("members.you")})</span>}
              </b>
            </div>
            {can(role, "manageMembers") &&
            m.id !== selfId &&
            m.role !== "owner" &&
            canChangeRole(role, m.role, m.role) ? (
              <>
                <select
                  className="input"
                  style={{ width: "auto", minHeight: 36 }}
                  value={m.role}
                  aria-label={t("gs.roleOf", { name: m.name })}
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
              <span className="badge">
                {m.role === "owner" && <Icon name="crown" size={12} />} {t(`role.${m.role}`)}
              </span>
            )}
          </div>
        ))}
      </section>
    </>
  );
}

function Invites({ detail, role, run }: Ctx) {
  const { t, locale } = useI18n();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expires, setExpires] = useState(72);
  const [maxUses, setMaxUses] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<"member" | "guest">("member");
  const [now] = useState(() => Date.now());
  const base = `/api/groups/${detail.group.id}/invites`;

  const load = () =>
    api<{ invites: Invite[] }>(base)
      .then((r) => setInvites(r.invites))
      .catch(() => {});
  useEffect(() => {
    if (can(role, "createInvite")) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async (link: string) => {
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const create = () =>
    run(async () => {
      const r = await api<{ url: string }>(base, {
        body: { expiresInHours: expires, maxUses: maxUses ? Number(maxUses) : null, role: inviteRole },
      });
      setNewLink(r.url);
      await copy(r.url);
      await load();
    });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === "id" ? "id-ID" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <>
      <section className="setting-card" style={{ paddingBottom: 14 }}>
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
        <button className="btn" onClick={create}>
          {t("invite.create")}
        </button>
        {newLink && (
          <div className="list-row highlight" style={{ marginTop: 12 }}>
            <code className="grow" style={{ wordBreak: "break-all" }} data-testid="invite-link">
              {newLink}
            </code>
            <button className="btn small" onClick={() => void copy(newLink)}>
              {copied ? t("gs.copied") : t("invite.copy")}
            </button>
          </div>
        )}
      </section>
      <h3 className="settings-h3">{t("invite.active")}</h3>
      <section className="setting-card">
        {invites.length === 0 && <p className="hint">{t("invite.none")}</p>}
        {invites.map((i) => {
          const expired = Date.parse(i.expiresAt) < now;
          const state = i.revoked
            ? t("invite.revoked")
            : expired
              ? t("invite.expired")
              : t("invite.validUntil", { time: fmt(i.expiresAt) });
          return (
            <div key={i.id} className="setting-row">
              <div className="grow">
                <b>
                  {t(`role.${i.role}`)} · {t("invite.used", { n: i.uses, max: i.maxUses ?? "∞" })}
                </b>
                <span className="hint">{state}</span>
              </div>
              {!i.revoked && !expired && (
                <button
                  className="btn secondary small"
                  onClick={() =>
                    run(async () => {
                      await api(`${base}/${i.id}`, { method: "DELETE" });
                      await load();
                    })
                  }
                >
                  {t("invite.revoke")}
                </button>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}

function Danger({ detail, selfId, role, run, onLeft }: Ctx & { onLeft: () => void }) {
  const { t } = useI18n();
  const [to, setTo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const candidates = detail.members.filter((m) => m.id !== selfId && m.role !== "guest");
  const g = detail.group;

  if (role !== "owner")
    return (
      <section className="setting-card danger">
        <div className="setting-row">
          <div className="grow">
            <b>{t("settings.leave")}</b>
            <span className="hint">{t("gs.leaveHint")}</span>
          </div>
          <button
            className="btn danger-outline small"
            onClick={() =>
              confirm(t("settings.leaveConfirm")) &&
              run(async () => {
                await api(`/api/groups/${g.id}/members/${selfId}`, { method: "DELETE" });
                onLeft();
              })
            }
          >
            {t("settings.leave")}
          </button>
        </div>
      </section>
    );

  return (
    <>
      <h3 className="settings-h3" style={{ marginTop: 0 }}>
        {t("gs.transfer")}
      </h3>
      <section className="setting-card">
        <p className="hint" style={{ margin: "12px 0" }}>
          {t("gs.transferHint")}
        </p>
        {candidates.length === 0 ? (
          <p className="hint" style={{ marginBottom: 12 }}>
            {t("gs.transferNone")}
          </p>
        ) : (
          <form
            className="transfer-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const name = candidates.find((m) => m.id === to)?.name ?? "";
              if (!confirm(t("gs.transferConfirm", { name, group: g.name }))) return;
              if (
                await run(
                  () => api(`/api/groups/${g.id}/transfer`, { body: { userId: to, password } }),
                  t("gs.transferred"),
                )
              )
                setPassword("");
            }}
          >
            <select
              className="input"
              aria-label={t("gs.transferTo")}
              value={to}
              required
              onChange={(e) => setTo(e.target.value)}
            >
              <option value="">{t("gs.transferTo")}</option>
              {candidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({t(`role.${m.role}`)})
                </option>
              ))}
            </select>
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              placeholder={t("us.currentPassword")}
              aria-label={t("us.currentPassword")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="btn secondary" disabled={!to || !password}>
              <Icon name="crown" size={16} /> {t("gs.transferButton")}
            </button>
          </form>
        )}
      </section>

      <h3 className="settings-h3 danger">{t("settings.deleteGroup")}</h3>
      <section className="setting-card danger">
        <p className="hint" style={{ margin: "12px 0" }}>
          {t("gs.deleteHint")}
        </p>
        <div className="field">
          <label htmlFor="gs-del-name">{t("gs.typeName", { name: g.name })}</label>
          <input
            id="gs-del-name"
            className="input"
            autoComplete="off"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
          />
        </div>
        <div className="row" style={{ paddingBottom: 14 }}>
          <span className="spacer" />
          <button
            className="btn danger"
            disabled={confirmName.trim() !== g.name}
            onClick={() =>
              run(async () => {
                await api(`/api/groups/${g.id}`, { method: "DELETE" });
                onLeft();
              })
            }
          >
            {t("settings.deleteGroup")}
          </button>
        </div>
      </section>
    </>
  );
}
