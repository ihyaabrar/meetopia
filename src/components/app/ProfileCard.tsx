"use client";

import { useI18n } from "@/i18n/client";
import { Modal } from "@/components/Modal";
import { AvatarCanvas } from "@/components/AvatarCanvas";
import { Icon } from "@/components/Icon";
import type { Presence } from "@/shared/protocol";
import type { MemberInfo } from "./types";

/** Kartu profil: banner, avatar besar, status, status kustom, peran, lokasi, tanggal bergabung, dan aksi. */
export function ProfileCard({
  member,
  presence,
  isSelf,
  statusText,
  location,
  onClose,
  children,
}: {
  member: MemberInfo;
  presence?: Presence;
  isSelf: boolean;
  /** Status kustom (untuk diri sendiri diambil dari akun, untuk orang lain dari kehadiran). */
  statusText: string | null;
  location: string | null;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const avatar = presence?.avatar ?? member.avatar;
  const status = presence?.status ?? "offline";
  const joined = member.joinedAt
    ? new Date(member.joinedAt).toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
        dateStyle: "medium",
      })
    : null;
  return (
    <Modal title={presence?.name ?? member.name} onClose={onClose} bare>
      <div className="profile-card">
        <div className="pc-banner" style={{ background: avatar.bodyColor }} />
        <button className="icon-btn pc-close" onClick={onClose} aria-label={t("common.close")}>
          <Icon name="x" size={18} />
        </button>
        <div className="pc-avatar">
          <span className="avatar-wrap">
            <AvatarCanvas avatar={avatar} size={88} face />
            <span className={`status-dot s-${status}`} />
          </span>
        </div>
        <div className="pc-body">
          <h2>
            {presence?.name ?? member.name}
            {isSelf && <span className="hint"> ({t("members.you")})</span>}
          </h2>
          {statusText && <p className="pc-status-text">{statusText}</p>}
          <dl className="pc-facts">
            <div>
              <dt>{t("pc.status")}</dt>
              <dd>
                <span className={`status-dot inline s-${status}`} /> {t(`status.${status}`)}
                {location && ` · ${location}`}
              </dd>
            </div>
            <div>
              <dt>{t("pc.role")}</dt>
              <dd>
                {member.role === "owner" && <Icon name="crown" size={13} />} {t(`role.${member.role}`)}
              </dd>
            </div>
            {joined && (
              <div>
                <dt>{t("pc.joined")}</dt>
                <dd>{joined}</dd>
              </div>
            )}
          </dl>
          {children}
        </div>
      </div>
    </Modal>
  );
}
