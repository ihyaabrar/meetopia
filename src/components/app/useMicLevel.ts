"use client";

import { useCallback, useEffect, useState } from "react";

/** Meter level mikrofon untuk uji perangkat; aktif hanya selama `on` bernilai true. */
export function useMicLevel(on: boolean, deviceId: string, onError: (name: string | undefined) => void) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let ctx: AudioContext | null = null;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((tr) => tr.stop());
        stream = s;
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
      .catch((e: { name?: string }) => onError(e?.name));
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
      void ctx?.close();
      setLevel(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, deviceId]);
  return level;
}

/** Daftar perangkat media; label baru muncul setelah izin mikrofon/kamera diberikan. */
export function useDevices(): [MediaDeviceInfo[], () => void] {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const refresh = useCallback(
    () =>
      void navigator.mediaDevices
        ?.enumerateDevices()
        .then(setDevices)
        .catch(() => {}),
    [],
  );
  useEffect(() => {
    refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, [refresh]);
  return [devices, refresh];
}
