/**
 * Audio, video, dan berbagi layar lewat WebRTC mesh (M6, M7).
 *
 * Kenapa mesh buatan sendiri: tanpa akun/penyedia pihak ketiga dan cukup untuk ~15 orang per ruang,
 * karena koneksi hanya dibuka ke orang di sekitar (maks. 16 audio, 8 video). Bila nanti memakai
 * layanan WebRTC terkelola (LiveKit, Daily, dll.), cukup ganti kelas ini.
 *
 * Setiap koneksi punya tiga transceiver tetap: [0] mikrofon, [1] kamera, [2] layar.
 * Menyalakan/mematikan perangkat cukup `replaceTrack`, tanpa negosiasi ulang.
 */
import type { RoomClient } from "./roomClient";
import type { Presence } from "@/shared/protocol";
import { MAX_VIDEO_PEERS, audiblePeers } from "@/shared/proximity";

export interface RemoteMedia {
  peerId: string;
  volume: number;
  cam: MediaStream | null;
  screen: MediaStream | null;
  state: RTCPeerConnectionState;
}

interface Link {
  peerId: string;
  pc: RTCPeerConnection;
  initiator: boolean;
  audioEl: HTMLAudioElement;
  cam: MediaStream;
  screen: MediaStream;
  pendingCandidates: RTCIceCandidateInit[];
  lastWanted: number;
  volume: number;
  sendsVideo: boolean;
}

type Signal =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit }
  | { type: "bye" };

export type MediaError =
  "micDenied" | "micNotFound" | "camDenied" | "camNotFound" | "screenFailed" | "screenRejected";

function iceServers(): RTCIceServer[] {
  try {
    const raw = process.env.NEXT_PUBLIC_ICE_SERVERS;
    if (raw) return JSON.parse(raw) as RTCIceServer[];
  } catch {}
  return [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
}

function classify(e: unknown, kind: "mic" | "cam"): MediaError {
  const name = (e as { name?: string })?.name;
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return kind === "mic" ? "micNotFound" : "camNotFound";
  return kind === "mic" ? "micDenied" : "camDenied";
}

export class MediaManager {
  micTrack: MediaStreamTrack | null = null;
  camTrack: MediaStreamTrack | null = null;
  screenTrack: MediaStreamTrack | null = null;
  micDeviceId: string | undefined;
  camDeviceId: string | undefined;
  speakerDeviceId: string | undefined;
  /** Volume suara orang lain dikalikan nilai ini (untuk efek kebutuhan karakter di fase 2). */
  masterVolume = 1;

  private links = new Map<string, Link>();
  private audioCtx: AudioContext | null = null;
  private analysers = new Map<
    string,
    { an: AnalyserNode; src: MediaStreamAudioSourceNode; buf: Uint8Array<ArrayBuffer> }
  >();
  private timer: ReturnType<typeof setInterval> | null = null;
  private offSignal: () => void;
  private offWelcome: () => void;
  private listeners = new Set<() => void>();
  remote: RemoteMedia[] = [];
  private onError: (e: MediaError) => void = () => {};
  setErrorHandler(fn: (e: MediaError) => void) {
    this.onError = fn;
  }

  constructor(private room: RoomClient) {
    this.offSignal = room.on("signal", ({ from, data }) => void this.onSignal(from, data as Signal));
    // Setelah sambung ulang, mulai ulang semua koneksi media.
    this.offWelcome = room.on("welcome", () => this.closeAll());
    this.timer = setInterval(() => this.tick(), 400);
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.remote;
  private notify() {
    this.remote = [...this.links.values()].map((l) => ({
      peerId: l.peerId,
      volume: l.volume,
      cam: l.cam.getVideoTracks().length ? l.cam : null,
      screen: l.screen.getVideoTracks().length ? l.screen : null,
      state: l.pc.connectionState,
    }));
    this.listeners.forEach((f) => f());
  }

  private publishMedia() {
    this.room.send({
      t: "media",
      mic: !!this.micTrack?.enabled,
      cam: !!this.camTrack,
      screen: !!this.screenTrack,
    });
    this.room.updateSelf({
      media: { mic: !!this.micTrack?.enabled, cam: !!this.camTrack, screen: !!this.screenTrack },
    });
  }

  // ---------------- level suara (indikator "sedang bicara") ----------------

  private attachAnalyser(key: string, track: MediaStreamTrack) {
    this.detachAnalyser(key);
    try {
      this.audioCtx ??= new AudioContext();
      if (this.audioCtx.state === "suspended") void this.audioCtx.resume();
      const src = this.audioCtx.createMediaStreamSource(new MediaStream([track]));
      const an = this.audioCtx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      this.analysers.set(key, { an, src, buf: new Uint8Array(new ArrayBuffer(an.fftSize)) });
    } catch {
      // Web Audio tidak tersedia: indikator bicara dinonaktifkan.
    }
  }

  private detachAnalyser(key: string) {
    const a = this.analysers.get(key);
    if (!a) return;
    a.src.disconnect();
    this.analysers.delete(key);
  }

  /** Level suara 0..1 untuk peserta (`self` = diri sendiri). */
  level(key: string): number {
    const a = this.analysers.get(key);
    if (!a) return 0;
    a.an.getByteTimeDomainData(a.buf);
    let sum = 0;
    for (let i = 0; i < a.buf.length; i++) {
      const v = (a.buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / a.buf.length) * 5);
  }

  // ---------------- perangkat lokal ----------------

  async setMic(on: boolean): Promise<boolean> {
    if (on) {
      if (!this.micTrack || this.micTrack.readyState === "ended") {
        try {
          const s = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: this.micDeviceId ? { exact: this.micDeviceId } : undefined,
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          this.micTrack = s.getAudioTracks()[0];
          this.attachAnalyser("self", this.micTrack);
        } catch (e) {
          this.onError(classify(e, "mic"));
          return false;
        }
      }
      this.micTrack.enabled = true;
    } else if (this.micTrack) {
      this.micTrack.stop();
      this.micTrack = null;
      this.detachAnalyser("self");
    }
    this.applyTracks();
    this.publishMedia();
    return on;
  }

  async setCam(on: boolean): Promise<boolean> {
    if (on) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: this.camDeviceId ? { exact: this.camDeviceId } : undefined,
            width: 320,
            height: 240,
            frameRate: 15,
          },
        });
        this.camTrack?.stop();
        this.camTrack = s.getVideoTracks()[0];
      } catch (e) {
        this.onError(classify(e, "cam"));
        return false;
      }
    } else {
      this.camTrack?.stop();
      this.camTrack = null;
    }
    this.applyTracks();
    this.publishMedia();
    return on;
  }

  async setScreen(on: boolean): Promise<boolean> {
    if (on) {
      try {
        const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 10 }, audio: false });
        this.screenTrack = s.getVideoTracks()[0];
        this.screenTrack.onended = () => void this.setScreen(false);
      } catch {
        this.onError("screenFailed");
        return false;
      }
    } else {
      this.screenTrack?.stop();
      this.screenTrack = null;
    }
    this.applyTracks();
    this.publishMedia();
    return on;
  }

  /** Dipanggil saat server menolak berbagi layar karena sudah ada penyaji lain. */
  screenRejected() {
    this.screenTrack?.stop();
    this.screenTrack = null;
    this.applyTracks();
    this.onError("screenRejected");
    this.room.updateSelf({ media: { mic: !!this.micTrack?.enabled, cam: !!this.camTrack, screen: false } });
  }

  async switchMic(deviceId: string) {
    this.micDeviceId = deviceId || undefined;
    if (this.micTrack) {
      this.micTrack.stop();
      this.micTrack = null;
      await this.setMic(true);
    }
  }

  async switchCam(deviceId: string) {
    this.camDeviceId = deviceId || undefined;
    if (this.camTrack) await this.setCam(true);
  }

  switchSpeaker(deviceId: string) {
    this.speakerDeviceId = deviceId || undefined;
    for (const l of this.links.values()) void this.applySink(l.audioEl);
  }

  private async applySink(el: HTMLAudioElement) {
    const withSink = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (withSink.setSinkId) await withSink.setSinkId(this.speakerDeviceId ?? "").catch(() => {});
  }

  private applyTracks() {
    for (const l of this.links.values()) this.applyLinkTracks(l);
  }

  private applyLinkTracks(l: Link) {
    const t = l.pc.getTransceivers();
    if (t.length < 3) return;
    void t[0].sender.replaceTrack(this.micTrack?.enabled ? this.micTrack : null).catch(() => {});
    void t[1].sender.replaceTrack(l.sendsVideo ? this.camTrack : null).catch(() => {});
    void t[2].sender.replaceTrack(this.screenTrack).catch(() => {});
  }

  // ---------------- keputusan koneksi ----------------

  private tick() {
    const snap = this.room.snapshot;
    const self = this.room.self;
    if (!self || !snap.map || snap.conn !== "open") return;
    const others = [...snap.peers.values()].filter((p) => p.id !== self.id);
    const audible = audiblePeers(snap.map, self, others);
    const hasMedia = (p: Presence) => p.media.mic || p.media.cam || p.media.screen;
    const now = Date.now();
    const videoIds = new Set(audible.slice(0, MAX_VIDEO_PEERS).map((a) => a.peer.id));
    let changed = false;

    for (const { peer, volume } of audible) {
      if (!hasMedia(self) && !hasMedia(peer)) continue;
      let link = this.links.get(peer.id);
      if (!link && self.id < peer.id) {
        link = this.createLink(peer.id, true);
        void this.makeOffer(link);
        changed = true;
      }
      if (!link) continue;
      link.lastWanted = now;
      if (Math.abs(link.volume - volume) > 0.01) changed = true;
      link.volume = volume;
      link.audioEl.volume = Math.max(0, Math.min(1, volume * this.masterVolume));
      const sendsVideo = videoIds.has(peer.id);
      if (sendsVideo !== link.sendsVideo) {
        link.sendsVideo = sendsVideo;
        this.applyLinkTracks(link);
      }
    }
    // Tutup koneksi yang sudah tidak dibutuhkan (dengan jeda agar tidak bolak-balik di batas radius).
    for (const link of [...this.links.values()]) {
      const peer = snap.peers.get(link.peerId);
      const failed = link.pc.connectionState === "failed";
      if (!peer || failed || now - link.lastWanted > 2500) {
        this.closeLink(link, true);
        changed = true;
      } else if (now - link.lastWanted > 0) {
        if (link.volume !== 0 && now - link.lastWanted > 500) {
          link.volume = 0;
          link.audioEl.volume = 0;
          changed = true;
        }
      }
    }
    if (changed) this.notify();
  }

  private createLink(peerId: string, initiator: boolean): Link {
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    const audioEl = new Audio();
    audioEl.autoplay = true;
    void this.applySink(audioEl);
    const link: Link = {
      peerId,
      pc,
      initiator,
      audioEl,
      cam: new MediaStream(),
      screen: new MediaStream(),
      pendingCandidates: [],
      lastWanted: Date.now(),
      volume: 0,
      sendsVideo: false,
    };
    if (initiator) {
      pc.addTransceiver("audio", { direction: "sendrecv" });
      pc.addTransceiver("video", { direction: "sendrecv" });
      pc.addTransceiver("video", { direction: "sendrecv" });
      this.applyLinkTracks(link);
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) this.signal(peerId, { type: "candidate", candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const idx = pc.getTransceivers().indexOf(e.transceiver);
      if (idx === 0) {
        audioEl.srcObject = new MediaStream([e.track]);
        void audioEl.play().catch(() => {});
        this.attachAnalyser(peerId, e.track);
      } else {
        const target = idx === 1 ? link.cam : link.screen;
        target.getTracks().forEach((t) => target.removeTrack(t));
        target.addTrack(e.track);
        e.track.onunmute = () => this.notify();
        e.track.onmute = () => this.notify();
      }
      this.notify();
    };
    pc.onconnectionstatechange = () => this.notify();
    this.links.set(peerId, link);
    return link;
  }

  private async makeOffer(link: Link) {
    const offer = await link.pc.createOffer();
    await link.pc.setLocalDescription(offer);
    this.signal(link.peerId, { type: "offer", sdp: offer.sdp! });
  }

  private signal(to: string, data: Signal) {
    this.room.send({ t: "signal", to, data });
  }

  private async onSignal(from: string, data: Signal) {
    let link = this.links.get(from);
    try {
      if (data.type === "bye") {
        if (link) this.closeLink(link, false);
        return;
      }
      if (data.type === "offer") {
        if (link) this.closeLink(link, false);
        link = this.createLink(from, false);
        await link.pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
        for (const t of link.pc.getTransceivers()) t.direction = "sendrecv";
        // Kirim video hanya bila peer ini termasuk 8 terdekat; dihitung ulang di tick berikutnya.
        link.sendsVideo = true;
        this.applyLinkTracks(link);
        const answer = await link.pc.createAnswer();
        await link.pc.setLocalDescription(answer);
        this.signal(from, { type: "answer", sdp: answer.sdp! });
        await this.flushCandidates(link);
      } else if (data.type === "answer" && link) {
        await link.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
        await this.flushCandidates(link);
      } else if (data.type === "candidate" && link) {
        if (link.pc.remoteDescription) await link.pc.addIceCandidate(data.candidate);
        else link.pendingCandidates.push(data.candidate);
      }
    } catch (e) {
      console.warn("[media] sinyal gagal", e);
    }
    this.notify();
  }

  private async flushCandidates(link: Link) {
    for (const c of link.pendingCandidates.splice(0)) await link.pc.addIceCandidate(c).catch(() => {});
  }

  private closeLink(link: Link, sendBye: boolean) {
    if (sendBye) this.signal(link.peerId, { type: "bye" });
    link.pc.close();
    link.audioEl.srcObject = null;
    this.detachAnalyser(link.peerId);
    this.links.delete(link.peerId);
    this.notify();
  }

  closeAll() {
    for (const l of [...this.links.values()]) this.closeLink(l, false);
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    this.offSignal();
    this.offWelcome();
    this.closeAll();
    this.micTrack?.stop();
    this.camTrack?.stop();
    this.screenTrack?.stop();
    this.micTrack = this.camTrack = this.screenTrack = null;
    this.analysers.clear();
    void this.audioCtx?.close().catch(() => {});
  }
}
