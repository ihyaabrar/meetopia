"use client";

import { useT } from "@/i18n/client";
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
  const t = useT();
  const online = members.filter((m) => presence.has(m.id));
  const offline = members.filter((m) => !presence.has(m.id));
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
            {p?.name ?? m.name} {m.id === selfId && <span className="hint">({t("members.you")})</span>}
            {(m.role === "owner" || m.role === "admin") && (
              <span className={`role-tag ${m.role}`}>{t(`role.${m.role}`)}</span>
            )}
          </b>
          <span>
            {t(`status.${status}`)}
            {p && locate?.(p) && ` · ${locate(p)}`}
          </span>
        </span>
        {p && (
          <span
            title={p.media.mic ? t("media.micOn") : t("media.micOff")}
            style={{ color: p.media.mic ? "var(--green-600)" : "var(--danger)" }}
          >
            <Icon
              name={p.media.mic ? "mic" : "micOff"}
              size={16}
              label={p.media.mic ? t("media.micOn") : t("media.micOff")}
            />
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
      <div className="section-title">{t("members.online", { n: online.length })}</div>
      {online.map(row)}
      <div className="section-title">{t("members.offline", { n: offline.length })}</div>
      {offline.map(row)}
    </aside>
  );
}
