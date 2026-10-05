"use client";

import { useEffect, useState } from "react";
import { api } from "@/client/api";
import { useT } from "@/i18n/client";
import { GroupIcon } from "@/components/GroupIcon";
import { Icon } from "@/components/Icon";
import { AvatarCanvas } from "@/components/AvatarCanvas";
import type { AvatarConfig } from "@/shared/avatar";
import type { GroupSummary } from "./types";

/** Beranda: pilih workspace (sesuai desain), buat baru, atau gabung dengan kode undangan. */
export function WorkspacePicker({
  groups,
  activeId,
  avatar,
  onOpen,
  onCreate,
  onJoin,
  onBack,
}: {
  groups: GroupSummary[];
  activeId: string | null;
  avatar: AvatarConfig;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  onBack?: () => void;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [live, setLive] = useState<GroupSummary[] | null>(null);
  // Muat ulang agar jumlah anggota dan orang di ruangan terbaru.
  useEffect(() => {
    api<{ groups: GroupSummary[] }>("/api/groups")
      .then((r) => setLive(r.groups))
      .catch(() => {});
  }, [groups.length]);
  const list = (live ?? groups).filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="picker">
      <div className="picker-head">
        {onBack && (
          <button className="icon-btn" onClick={onBack} aria-label={t("ws.back")} title={t("ws.back")}>
            <Icon name="chevron" size={18} />
          </button>
        )}
        <div className="grow">
          <h1>{t("ws.title")}</h1>
          <p className="hint">{t("ws.sub")}</p>
        </div>
        <label className="members-search picker-search">
          <Icon name="search" size={15} />
          <input
            className="input"
            type="search"
            placeholder={t("ws.search")}
            aria-label={t("ws.search")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button className="btn" onClick={onCreate}>
          <Icon name="plus" size={16} /> {t("ws.create")}
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="picker-empty">
          <h2>{t("welcome.title")}</h2>
          <p className="hint">{t("welcome.body")}</p>
        </div>
      ) : (
        <div className="ws-grid">
          {list.map((g) => (
            <button
              key={g.id}
              className="ws-card"
              aria-current={g.id === activeId}
              onClick={() => onOpen(g.id)}
            >
              <GroupIcon
                name={g.name}
                color={g.iconColor}
                symbol={g.iconSymbol}
                size={48}
                className="ws-icon"
              />
              <span className="grow">
                <b>{g.name}</b>
                <span className="hint">
                  {t(`tpl.${g.template ?? "office"}`)}
                  {g.memberCount !== undefined && ` · ${t("ws.members", { n: g.memberCount })}`}
                </span>
                {g.inRoom ? (
                  <span className="ws-live">
                    <span className="live-dot" /> {t("ws.inRoom", { n: g.inRoom })}
                  </span>
                ) : (
                  <span className="ws-role">{t(`role.${g.role}`)}</span>
                )}
              </span>
              <span className="ws-arrow" aria-hidden>
                <Icon name="chevron" size={16} />
              </span>
            </button>
          ))}
          {list.length === 0 && <p className="hint">{t("ws.noMatch")}</p>}
        </div>
      )}

      <div className="join-banner">
        <AvatarCanvas avatar={avatar} size={56} face />
        <div className="grow">
          <b>{t("ws.joinTitle")}</b>
          <span className="hint">{t("ws.joinSub")}</span>
        </div>
        <button className="btn secondary" onClick={onJoin}>
          {t("ws.joinButton")}
        </button>
      </div>
    </div>
  );
}
