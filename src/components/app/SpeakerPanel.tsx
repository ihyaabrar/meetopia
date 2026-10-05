"use client";

import { useState } from "react";
import type { RoomClient, RoomSnapshot } from "@/client/roomClient";
import { setPrefs, usePrefs } from "@/client/prefs";
import { useT } from "@/i18n/client";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";
import { distanceToObject, type MapObject } from "@/shared/map";
import {
  SPEAKER_AUDIO,
  SPEAKER_CONTROL_RANGE,
  STATIONS,
  isValidAudioUrl,
  type MusicSource,
} from "@/shared/music";
import { can, type Role } from "@/shared/roles";
import { youtubeId } from "@/shared/tv";

/** Panel speaker: pilih stasiun bawaan atau tautan audio sendiri, hentikan, dan atur volume pribadi. */
export function SpeakerPanel({
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
  const prefs = usePrefs();
  const state = snap.music[obj.id];
  const self = snap.selfId ? snap.peers.get(snap.selfId) : undefined;
  const near = !!self && distanceToObject(obj, self.x, self.y) <= SPEAKER_CONTROL_RANGE;
  const allowed = can(role, "controlMusic");
  const canControl = allowed && near;
  const [url, setUrl] = useState(state?.source.kind === "url" ? state.source.url : "");
  const ytId = youtubeId(url);
  const urlOk = !!ytId || isValidAudioUrl(url.trim());
  const radius = (obj.audio ?? SPEAKER_AUDIO).radius;

  const play = (source: MusicSource) => room.send({ t: "music", objectId: obj.id, action: "play", source });
  const stop = () => room.send({ t: "music", objectId: obj.id, action: "stop" });
  const sourceName = (s: MusicSource) =>
    s.kind === "station"
      ? t(`music.station.${s.id}`)
      : s.kind === "youtube"
        ? t("music.youtube")
        : t("music.customLink");

  return (
    <Modal title={t("object.speaker")} sub={t("music.sub", { n: Math.round(radius) })} onClose={onClose}>
      <div className="now-playing" data-playing={!!state}>
        <span className="np-icon" aria-hidden>
          <Icon name="music" size={20} />
        </span>
        <div className="grow" style={{ minWidth: 0 }}>
          {state ? (
            <>
              <b>{sourceName(state.source)}</b>
              <span className="hint">{t("music.playedBy", { name: state.byName })}</span>
            </>
          ) : (
            <>
              <b>{t("music.idle")}</b>
              <span className="hint">{t("music.idleHint")}</span>
            </>
          )}
        </div>
        {state && (
          <button className="btn secondary small" disabled={!canControl} onClick={stop}>
            <Icon name="stop" size={14} /> {t("music.stop")}
          </button>
        )}
      </div>

      {!allowed && <p className="hint">{t("music.guestOnly")}</p>}
      {allowed && !near && <p className="hint">{t("music.tooFar")}</p>}

      <div className="section-title" style={{ paddingLeft: 0 }}>
        {t("music.stations")}
      </div>
      <div className="station-list">
        {STATIONS.map((id) => {
          const active = state?.source.kind === "station" && state.source.id === id;
          return (
            <button
              key={id}
              className="station"
              aria-pressed={active}
              disabled={!canControl}
              onClick={() => play({ kind: "station", id })}
            >
              <Icon name={active ? "volume" : "play"} size={16} />
              <span className="grow">
                <b>{t(`music.station.${id}`)}</b>
                <span className="hint">{t(`music.station.${id}.desc`)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="section-title" style={{ paddingLeft: 0 }}>
        {t("music.customLink")}
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (ytId) play({ kind: "youtube", id: ytId });
          else if (urlOk) play({ kind: "url", url: url.trim() });
        }}
      >
        <input
          className="input"
          type="url"
          inputMode="url"
          placeholder={t("music.linkPlaceholder")}
          aria-label={t("music.customLink")}
          value={url}
          disabled={!canControl}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="btn" disabled={!canControl || !urlOk}>
          {t("music.play")}
        </button>
      </form>
      <p className="hint">{t("music.linkHint")}</p>

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="sp-vol">
          {t("music.myVolume")}:{" "}
          <b>{prefs.musicMuted ? t("music.muted") : `${Math.round(prefs.musicVolume * 100)}%`}</b>
        </label>
        <div className="row">
          <input
            id="sp-vol"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={prefs.musicVolume}
            onChange={(e) => setPrefs({ musicVolume: Number(e.target.value), musicMuted: false })}
            style={{ flex: 1 }}
          />
          <button
            className="btn ghost small"
            aria-pressed={prefs.musicMuted}
            onClick={() => setPrefs({ musicMuted: !prefs.musicMuted })}
          >
            {prefs.musicMuted ? t("music.unmute") : t("music.mute")}
          </button>
        </div>
        <span className="hint">{t("music.myVolumeHint")}</span>
      </div>
    </Modal>
  );
}
