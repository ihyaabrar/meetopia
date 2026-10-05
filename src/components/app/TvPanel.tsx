"use client";

import { useState } from "react";
import type { RoomClient, RoomSnapshot } from "@/client/roomClient";
import { useT } from "@/i18n/client";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";
import { distanceToObject, type MapObject } from "@/shared/map";
import { TV_CONTROL_RANGE, youtubeId } from "@/shared/tv";
import { can, type Role } from "@/shared/roles";

/** Popup TV: nonton YouTube bersama, posisi video sama untuk semua orang; bisa diperbesar. */
export function TvPanel({
  room,
  snap,
  obj,
  role,
  onClose,
}: {
  room: RoomClient;
  snap: RoomSnapshot;
  obj: MapObject;
  role: Role;
  onClose: () => void;
}) {
  const t = useT();
  const state = snap.tv[obj.id];
  const [url, setUrl] = useState("");
  const [big, setBig] = useState(false);
  const self = snap.selfId ? snap.peers.get(snap.selfId) : undefined;
  const near = !!self && distanceToObject(obj, self.x, self.y) <= TV_CONTROL_RANGE;
  const allowed = can(role, "controlMusic");
  const canControl = allowed && near;
  const valid = !!youtubeId(url);
  // Posisi video dihitung dari jam server saat popup dibuka, agar semua orang menonton bagian yang sama.
  const [openedAt] = useState(() => Date.now());
  const start = state ? Math.max(0, Math.floor((openedAt + snap.clockOffset - state.startedAt) / 1000)) : 0;

  return (
    <Modal
      title={t(obj.label ?? "object.tv")}
      onClose={onClose}
      wide
      className={`tv-modal ${big ? "tv-big" : ""}`}
    >
      <div className="tv-top">
        <span className="grow hint">{state ? t("tv.playedBy", { name: state.byName }) : t("tv.off")}</span>
        <button className="btn ghost small" onClick={() => setBig((b) => !b)} aria-pressed={big}>
          <Icon name={big ? "x" : "monitor"} size={15} /> {big ? t("tv.shrink") : t("tv.enlarge")}
        </button>
      </div>
      <div className="tv-screen">
        {state ? (
          <iframe
            key={`${state.videoId}-${state.startedAt}`}
            src={`https://www.youtube-nocookie.com/embed/${state.videoId}?autoplay=1&start=${start}&rel=0&playsinline=1`}
            title={t("tv.player")}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className="tv-empty">
            <Icon name="monitor" size={36} />
            <span>{t("tv.emptyHint")}</span>
          </div>
        )}
      </div>
      {!allowed && <p className="hint">{t("tv.guestOnly")}</p>}
      {allowed && !near && <p className="hint">{t("tv.tooFar")}</p>}
      <form
        className="row tv-controls"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          room.send({ t: "tv", objectId: obj.id, action: "play", url: url.trim() });
          setUrl("");
        }}
      >
        <input
          className="input"
          type="url"
          inputMode="url"
          placeholder={t("tv.placeholder")}
          aria-label={t("tv.link")}
          value={url}
          disabled={!canControl}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="btn" disabled={!canControl || !valid}>
          <Icon name="play" size={14} /> {t("tv.play")}
        </button>
        {state && (
          <button
            type="button"
            className="btn secondary"
            disabled={!canControl}
            onClick={() => room.send({ t: "tv", objectId: obj.id, action: "stop" })}
          >
            <Icon name="stop" size={14} /> {t("tv.stop")}
          </button>
        )}
      </form>
      {url && !valid && <p className="error-text">{t("tv.badLink")}</p>}
    </Modal>
  );
}
