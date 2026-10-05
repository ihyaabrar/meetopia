"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { timeAgo } from "@/i18n/relative";
import { AvatarCanvas } from "@/components/AvatarCanvas";
import { Icon } from "@/components/Icon";
import type { Presence } from "@/shared/protocol";
import type { MemberInfo } from "./types";

interface Props {
  members: MemberInfo[];
  presence: Map<string, Presence>;
  selfId: string;
  onSelect: (m: MemberInfo, p: Presence | undefined) => void;
  onClose?: () => void;
  /** Nama area tempat anggota berada di peta. */
  locate?: (p: Presence) => string | null;
}

/** Panel anggota di kanan: siapa yang ada di ruangan beserta statusnya (FR-30). */
export function MembersPanel({ members, presence, selfId, onSelect, onClose, locate }: Props) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const match = (m: MemberInfo) =>
    (presence.get(m.id)?.name ?? m.name).toLowerCase().includes(q.trim().toLowerCase());
  const online = members.filter((m) => presence.has(m.id) && match(m));
  const offline = members
    .filter((m) => !presence.has(m.id) && match(m))
    .sort((a, b) => Date.parse(b.lastSeenAt ?? "0") - Date.parse(a.lastSeenAt ?? "0"));
  const row = (m: MemberInfo) => {
    const p = presence.get(m.id);
    const status = p?.status ?? "offline";
    return (
      <button key={m.id} className={`member ${p ? "" : "offline"}`} onClick={() => onSelect(m, p)}>
        <span className="avatar-wrap">
          <AvatarCanvas avatar={p?.avatar ?? m.avatar} size={34} face />
          <span className={`status-dot s-${status}`} />
        </span>
        <span className="info">
          <b>
            <span className="nm">
              {p?.name ?? m.name}
              {m.id === selfId && <span className="hint"> ({t("members.you")})</span>}
            </span>
            {(m.role === "owner" || m.role === "admin") && (
              <span className={`role-tag ${m.role}`}>{t(`role.${m.role}`)}</span>
            )}
          </b>
          <span>
            {p
              ? (p.statusText ??
                (locate?.(p) ? `${t(`status.${status}`)} · ${locate(p)}` : t(`status.${status}`)))
              : m.lastSeenAt
                ? t("members.lastSeen", { time: timeAgo(m.lastSeenAt, locale) })
                : t("members.neverSeen")}
          </span>
        </span>
        {/* Seperti Discord: ikon hanya saat mic mati; mic menyala tidak perlu penanda tambahan. */}
        {p && !p.media.mic && (
          <span className="mic-off" title={t("media.micOff")}>
            <Icon name="micOff" size={16} label={t("media.micOff")} />
          </span>
        )}
      </button>
    );
  };
  return (
    <aside className="members" aria-label={t("members.title")}>
      <div className="members-head">
        <span style={{ flex: 1 }}>{t("members.title")}</span>
        {onClose && (
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            <Icon name="x" />
          </button>
        )}
      </div>
      <label className="members-search">
        <Icon name="search" size={15} />
        <input
          className="input"
          type="search"
          placeholder={t("members.search")}
          aria-label={t("members.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <div className="section-title">{t("members.online", { n: online.length })}</div>
      {online.map(row)}
      <div className="section-title">{t("members.offline", { n: offline.length })}</div>
      {offline.map(row)}
    </aside>
  );
}
