"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaManager } from "@/client/media";
import { useT } from "@/i18n/client";
import { Modal } from "@/components/Modal";

/**
 * Layar pengecekan perangkat saat bergabung (M6): pilih mikrofon, kamera, speaker,
 * dengan indikator suara. Mikrofon & kamera tetap mati sampai pengguna menyalakannya (aturan 8).
 */
export function DeviceCheck({
  media,
  onDone,
  joining,
}: {
  media: MediaManager;
  onDone: (micOn: boolean) => void;
  joining: boolean;
}) {
  const t = useT();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [mic, setMic] = useState(media.micDeviceId ?? "");
  const [cam, setCam] = useState(media.camDeviceId ?? "");
  const [speaker, setSpeaker] = useState(media.speakerDeviceId ?? "");
  const [testing, setTesting] = useState(false);
  const [camTest, setCamTest] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [startMic, setStartMic] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const refresh = () =>
    navigator.mediaDevices
      ?.enumerateDevices()
      .then(setDevices)
      .catch(() => {});
  useEffect(() => {
    void refresh();
  }, []);

  // Uji mikrofon dengan meter level
  useEffect(() => {
    if (!testing) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let ctx: AudioContext | null = null;
    navigator.mediaDevices
      .getUserMedia({ audio: mic ? { deviceId: { exact: mic } } : true })
      .then((s) => {
        stream = s;
        void refresh();
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(s).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const loop = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += ((v - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
          raf = requestAnimationFrame(loop);
        };
        loop();
      })
      .catch((e) => {
        setError(t(e?.name === "NotFoundError" ? "media.err.micNotFound" : "media.err.micDenied"));
        setTesting(false);
      });
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
      void ctx?.close();
      setLevel(0);
    };
  }, [testing, mic, t]);

  useEffect(() => {
    if (!camTest) return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: cam ? { deviceId: { exact: cam } } : true })
      .then((s) => {
        stream = s;
        void refresh();
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((e) => {
        setError(t(e?.name === "NotFoundError" ? "media.err.camNotFound" : "media.err.camDenied"));
        setCamTest(false);
      });
    return () => stream?.getTracks().forEach((tr) => tr.stop());
  }, [camTest, cam, t]);

  const finish = async () => {
    setTesting(false);
    setCamTest(false);
    await media.switchMic(mic);
    await media.switchCam(cam);
    media.switchSpeaker(speaker);
    onDone(startMic);
  };

  const list = (kind: MediaDeviceKind) => devices.filter((d) => d.kind === kind && d.deviceId);
  const select = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    kind: MediaDeviceKind,
  ) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => set(e.target.value)}>
        <option value="">{t("devices.default")}</option>
        {list(kind).map((d, i) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Modal title={t("devices.title")} sub={t("devices.sub")} onClose={() => void finish()} wide>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
        <div>
          {select("dev-mic", t("devices.mic"), mic, setMic, "audioinput")}
          <div className="row" style={{ marginBottom: 14 }}>
            <button type="button" className="btn secondary small" onClick={() => setTesting((v) => !v)}>
              {testing ? t("devices.stopTest") : t("devices.testMic")}
            </button>
            <div
              className="meter"
              style={{ flex: 1 }}
              aria-label={t("devices.level")}
              role="meter"
              aria-valuenow={Math.round(level * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div style={{ width: `${level * 100}%` }} />
            </div>
          </div>
          {select("dev-speaker", t("devices.speaker"), speaker, setSpeaker, "audiooutput")}
          <label className="row" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={startMic} onChange={(e) => setStartMic(e.target.checked)} />
            <span>{t("devices.startWithMic")}</span>
          </label>
        </div>
        <div>
          {select("dev-cam", t("devices.camera"), cam, setCam, "videoinput")}
          {camTest ? (
            <video ref={videoRef} className="preview-video" autoPlay playsInline muted />
          ) : (
            <div className="preview-video" />
          )}
          <button
            type="button"
            className="btn secondary small"
            style={{ marginTop: 8 }}
            onClick={() => setCamTest((v) => !v)}
          >
            {camTest ? t("devices.stopTest") : t("devices.testCam")}
          </button>
        </div>
      </div>
      <p className="hint">{t("devices.privacy")}</p>
      <div className="modal-actions">
        <button className="btn" onClick={() => void finish()}>
          {joining ? t("devices.join") : t("common.done")}
        </button>
      </div>
    </Modal>
  );
}
