import { describe, expect, it } from "vitest";
import { OFFICE_TEMPLATE, buildWalkable } from "@/shared/map";
import { findPath } from "@/shared/pathfinding";
import { clientMessageSchema } from "@/shared/protocol";
import { SPEAKER_AUDIO, WALL_DAMPING, isValidAudioUrl, speakerCenter, speakerVolume } from "@/shared/music";

const map = OFFICE_TEMPLATE;
const speaker = map.objects.find((o) => o.kind === "speaker")!;

describe("speaker musik", () => {
  it("ada di lounge dan bisa didekati dari titik muncul", () => {
    expect(speaker).toBeTruthy();
    const grid = buildWalkable(map);
    const path = findPath(grid, map.spawn, { x: speaker.x, y: speaker.y + 1 });
    expect(path?.length).toBeGreaterThan(0);
  });

  it("makin jauh makin pelan, lalu tidak terdengar", () => {
    const c = speakerCenter(speaker);
    let last = 1.01;
    for (let d = 0; d <= SPEAKER_AUDIO.radius + 1; d += 0.5) {
      const { volume } = speakerVolume(map, speaker, c.x - d, c.y);
      expect(volume).toBeLessThanOrEqual(last);
      last = volume;
    }
    expect(speakerVolume(map, speaker, c.x, c.y).volume).toBe(1);
    expect(speakerVolume(map, speaker, c.x - SPEAKER_AUDIO.radius - 0.5, c.y).volume).toBe(0);
  });

  it("teredam dari area lain dan terisolasi dari ruang privat", () => {
    // Speaker dekat pintu lounge-lobi: jarak sama, tetapi di lobi suaranya teredam dinding.
    const nearDoor = { ...speaker, x: 25, y: 21 };
    const inLounge = speakerVolume(map, nearDoor, 29.5, 21.5);
    const inLobby = speakerVolume(map, nearDoor, 21.5, 21.5);
    expect(inLounge.volume).toBeGreaterThan(0);
    expect(inLobby.volume).toBeCloseTo(inLounge.volume * WALL_DAMPING, 5);
    expect(Math.sign(inLobby.pan)).toBe(1);
    expect(Math.sign(inLounge.pan)).toBe(-1);
    // Ruang rapat (privat) tidak mendengar speaker lounge
    expect(speakerVolume(map, speaker, 36.5, 9.5).volume).toBe(0);
  });

  it("menyaring tautan audio: hanya https tanpa kredensial", () => {
    expect(isValidAudioUrl("https://contoh.com/lagu.mp3")).toBe(true);
    expect(isValidAudioUrl("http://contoh.com/lagu.mp3")).toBe(false);
    expect(isValidAudioUrl("javascript:alert(1)")).toBe(false);
    expect(isValidAudioUrl("https://user:pw@contoh.com/a.mp3")).toBe(false);
    expect(isValidAudioUrl(`https://contoh.com/${"a".repeat(600)}`)).toBe(false);
  });

  it("pesan music divalidasi di protokol", () => {
    const ok = clientMessageSchema.safeParse({
      t: "music",
      objectId: speaker.id,
      action: "play",
      source: { kind: "station", id: "lofi" },
    });
    expect(ok.success).toBe(true);
    const bad = clientMessageSchema.safeParse({
      t: "music",
      objectId: speaker.id,
      action: "play",
      source: { kind: "url", url: "file:///etc/passwd" },
    });
    expect(bad.success).toBe(false);
  });
});
