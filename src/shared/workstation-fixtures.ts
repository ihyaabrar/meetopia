import { DEFAULT_AUDIO, type MapData, type MapObject } from "./map";
import type { WorkstationDirection } from "./workstation";

/** Isolated fixtures, never saved over a member's live map or avatar. */
export function workstationFixture(dir: WorkstationDirection): MapData {
  const desk: MapObject = {
    id: "master-desk",
    kind: "desk",
    x: 6,
    y: 6,
    w: 4,
    h: 1,
    solid: true,
    facing: dir,
    label: "object.desk",
    actions: ["openPrivateNotes"],
  };
  const chair: MapObject = {
    id: "master-chair",
    kind: "chair",
    x: 7,
    y: 7,
    w: 1,
    h: 1,
    solid: false,
    label: "object.chair",
    actions: ["sit"],
  };
  if (dir === "down") {
    chair.x = 8;
    chair.y = 5;
  }
  if (dir === "right") {
    desk.w = 1;
    desk.h = 4;
    chair.x = 5;
    chair.y = 7;
  }
  if (dir === "left") {
    desk.w = 1;
    desk.h = 4;
    chair.x = 7;
    chair.y = 8;
  }
  return {
    width: 16,
    height: 16,
    version: 1,
    tiles: Array.from({ length: 16 }, (_, y) =>
      y === 0 || y === 15 ? "#".repeat(16) : "#" + "w".repeat(14) + "#",
    ),
    objects: [desk, chair],
    zones: [],
    audio: DEFAULT_AUDIO,
    spawn: { x: 4, y: 12 },
  };
}
