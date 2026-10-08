/** Reference-inspired worlds. Grid geometry is also the source of truth for collision and audio. */
import { DEFAULT_AUDIO, type MapData, type MapObject, type ObjectKind, type Zone } from "./map";

export const TEMPLATE_IDS = ["office", "home", "gaming", "studio", "rooftop"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export const isTemplateId = (v: unknown): v is TemplateId =>
  typeof v === "string" && (TEMPLATE_IDS as readonly string[]).includes(v);
export const TEMPLATE_REVS: Record<TemplateId, number> = {
  office: 6,
  home: 2,
  gaming: 2,
  studio: 2,
  rooftop: 3,
};
export const TEMPLATE_PERKS: Record<TemplateId, string[]> = Object.fromEntries(
  TEMPLATE_IDS.map((id) => [id, [1, 2, 3].map((n) => `tpl.${id}.p${n}`)]),
) as Record<TemplateId, string[]>;

function world(id: TemplateId, width = 48, height = 26) {
  const grid = Array.from({ length: height }, () => Array<string>(width).fill("#"));
  const objects: MapObject[] = [];
  const zones: Zone[] = [];
  const fill = (x: number, y: number, w: number, h: number, tile: string) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy][xx] = tile;
  };
  const zone = (
    key: string,
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    privateRoom = false,
    lockable = privateRoom,
  ) => {
    zones.push({ id: key, label: `zone.${label}`, x, y, w, h, private: privateRoom, lockable });
  };
  const add = (kind: ObjectKind, x: number, y: number, w = 1, h = 1, extra: Partial<MapObject> = {}) => {
    const interactions: Partial<Record<ObjectKind, Partial<MapObject>>> = {
      desk: { label: "object.desk", actions: ["openPrivateNotes"] },
      gamingDesk: { label: "object.gamingPc", actions: ["play"] },
      chair: { label: "object.chair", actions: ["sit"], solid: false },
      sofa: { label: "object.sofa", actions: ["sit"], solid: false },
      beanbag: { label: "object.beanbag", actions: ["sit"], solid: false },
      bed: { label: "object.bed", actions: ["sit"], solid: false },
      bookshelf: { label: "object.bookshelf", actions: ["read"] },
      tv: { label: "object.tv", actions: ["watch"] },
      coffee: { label: "object.coffee", actions: ["brew"] },
      counter: { label: "object.kitchen", actions: ["cook"] },
      fridge: { label: "object.fridge", actions: ["drink"] },
      cooler: { label: "object.cooler", actions: ["drink"] },
      whiteboard: { label: "object.whiteboard", actions: ["openSharedNotes"] },
      noticeboard: { label: "object.noticeboard", actions: ["openSharedNotes"] },
      welcome: { label: "object.welcome", actions: ["showTips"] },
      speaker: { label: "object.speaker", actions: ["music"] },
      arcade: { label: "object.arcade", actions: ["play"] },
      bbq: { label: "object.bbq", actions: ["cook"] },
      foosball: { label: "object.foosball", actions: ["play"] },
    };
    objects.push({
      id: `${id}-${kind}-${objects.length + 1}`,
      kind,
      x,
      y,
      w,
      h,
      solid: kind !== "rug" && kind !== "parasol" && kind !== "pergola",
      ...interactions[kind],
      ...extra,
    });
  };
  const plants = (...positions: [number, number][]) => positions.forEach(([x, y]) => add("plant", x, y));
  const desk = (x: number, y: number, gaming = false) => {
    add(gaming ? "gamingDesk" : "desk", x, y, 4);
    add("chair", x + 1, y + 1);
  };
  const table = (x: number, y: number, w = 5, h = 2) => {
    add("table", x, y, w, h, { label: "object.meetingTable", actions: ["openSharedNotes"] });
    for (let dx = 0; dx < w; dx += 2) {
      add("chair", x + dx, y - 1, 1, 1, { facing: "down" });
      add("chair", x + dx, y + h, 1, 1, { facing: "up" });
    }
  };
  const lounge = (x: number, y: number, w = 8) => {
    add("rug", x, y, w, 5);
    add("sofa", x + 1, y + 1, w - 3);
    add("table", x + 2, y + 3, 3);
    add("beanbag", x + w - 2, y + 3);
  };
  return {
    fill,
    zone,
    add,
    plants,
    desk,
    table,
    lounge,
    finish: (x: number, y: number): MapData => ({
      version: 1,
      template: id,
      templateRev: TEMPLATE_REVS[id],
      width,
      height,
      tiles: grid.map((row) => row.join("")),
      objects,
      zones,
      spawn: { x, y },
      audio: { ...DEFAULT_AUDIO },
    }),
  };
}

function office() {
  const b = world("office");
  b.fill(1, 1, 24, 9, "w");
  b.fill(26, 1, 11, 9, "m");
  b.fill(38, 1, 9, 5, "k");
  b.fill(1, 11, 24, 14, ".");
  b.fill(26, 11, 11, 8, "l");
  b.fill(38, 7, 9, 12, "w");
  b.fill(26, 19, 21, 6, "l");
  b.fill(5, 10, 3, 1, "d");
  b.fill(15, 10, 3, 1, "d");
  b.fill(22, 10, 2, 1, "d");
  b.fill(25, 15, 1, 3, "d");
  b.fill(30, 10, 3, 1, "d");
  b.fill(37, 9, 1, 3, "d");
  b.fill(42, 6, 2, 1, "d");
  b.zone("work", "work", 1, 1, 24, 9);
  b.zone("meeting", "meeting", 26, 1, 11, 9, true);
  b.zone("pantry", "pantry", 38, 1, 9, 5);
  b.zone("lobby", "reception", 1, 11, 24, 9);
  b.zone("lounge", "lounge", 1, 20, 24, 5);
  b.zone("team", "team", 26, 11, 11, 8);
  b.zone("discussion", "discussion", 38, 7, 9, 12);
  b.zone("relax", "relax", 26, 19, 21, 6);
  for (const x of [5, 12, 19]) b.desk(x, 4);
  b.add("bookshelf", 1, 2, 2, 3);
  b.plants([4, 1], [11, 1], [19, 1], [23, 8], [1, 8]);
  b.table(28, 4, 7, 2);
  b.add("whiteboard", 29, 1, 4);
  b.plants([26, 1], [36, 8]);
  b.add("counter", 38, 1, 5);
  b.add("fridge", 46, 1);
  b.add("coffee", 44, 1, 2);
  b.add("vending", 38, 3, 2, 1, { label: "object.vending", actions: ["buy"] });
  b.add("welcome", 5, 12, 6, 2);
  b.add("noticeboard", 20, 11, 4);
  b.add("rug", 9, 16, 10, 4);
  b.add("sofa", 2, 21, 5);
  b.add("table", 9, 22, 2, 2);
  b.add("lamp", 8, 21);
  b.plants([1, 12], [23, 12], [1, 23], [23, 23]);
  b.desk(29, 12);
  b.add("sofa", 27, 16, 4);
  b.add("table", 33, 16, 2);
  b.add("lamp", 26, 11);
  b.table(40, 10, 5, 2);
  b.desk(40, 15);
  b.plants([46, 8], [38, 18]);
  b.add("rug", 32, 20, 9, 4);
  b.add("beanbag", 33, 21);
  b.add("beanbag", 39, 21);
  b.add("tv", 28, 20, 3);
  b.add("speaker", 44, 20);
  b.plants([46, 23]);
  return b.finish(14, 18);
}

function home() {
  const b = world("home");
  for (const [x, w, tile] of [
    [1, 10, "h"],
    [12, 10, "h"],
    [23, 10, "x"],
    [34, 13, "h"],
  ] as const) {
    b.fill(x, 1, w, 8, tile);
    b.fill(x + 4, 9, 2, 1, "d");
  }
  b.fill(1, 10, 35, 10, "h");
  b.fill(37, 10, 10, 15, "r");
  b.fill(36, 14, 1, 3, "d");
  b.fill(10, 9, 1, 1, "d"); // Bedroom exit stays clear of the kitchen counter.
  b.fill(1, 21, 9, 4, "k");
  b.fill(5, 20, 2, 1, "d");
  b.fill(11, 20, 25, 5, ".");
  b.zone("bedroom1", "bedroom", 1, 1, 10, 8, true);
  b.zone("bedroom2", "study", 12, 1, 10, 8, true);
  b.zone("gaming", "homeGaming", 23, 1, 10, 8);
  b.zone("creative", "homeStudio", 34, 1, 13, 8);
  b.zone("kitchen", "kitchen", 1, 10, 17, 10);
  b.zone("living", "living", 18, 10, 18, 10);
  b.zone("bathroom", "bathroom", 1, 21, 9, 4);
  b.zone("entrance", "entrance", 11, 20, 25, 5);
  b.zone("garden", "terrace", 37, 10, 10, 15);
  b.add("rug", 2, 2, 8, 5);
  b.add("bed", 3, 2, 5, 4);
  b.add("lamp", 1, 2);
  b.add("cabinet", 9, 2);
  b.plants([9, 1]);
  b.desk(14, 2);
  b.add("rug", 13, 4, 7, 3);
  b.add("bookshelf", 20, 1, 2);
  b.plants([12, 6]);
  b.add("tv", 26, 1, 4);
  b.lounge(24, 3, 8);
  b.add("speaker", 31, 1);
  b.desk(40, 3);
  b.add("bookshelf", 35, 1, 3);
  b.add("whiteboard", 40, 1, 4);
  b.add("sofa", 35, 5, 3);
  b.plants([46, 7]);
  b.add("counter", 1, 10, 9);
  b.add("fridge", 1, 13);
  b.add("counter", 4, 14, 5);
  b.add("coffee", 11, 10, 2);
  b.table(12, 14, 5, 2);
  b.plants([1, 18]);
  b.lounge(21, 11, 11);
  b.add("tv", 33, 12, 2);
  b.add("lamp", 34, 17);
  b.add("noticeboard", 18, 18, 3);
  b.plants([19, 10]);
  b.add("bath", 1, 21, 3, 2);
  b.add("sink", 8, 21);
  b.add("rug", 19, 21, 9, 2);
  b.plants([12, 21], [34, 21]);
  b.table(40, 14, 4, 2);
  b.add("parasol", 39, 12, 6, 4);
  b.add("lamp", 38, 20);
  b.add("sofa", 39, 21, 5);
  b.plants([37, 10], [46, 10], [46, 18], [38, 24], [46, 24]);
  return b.finish(22, 19);
}

function gaming() {
  const b = world("gaming");
  for (const [x, w, tile] of [
    [1, 15, "x"],
    [17, 11, "l"],
    [29, 9, "x"],
  ] as const) {
    b.fill(x, 1, w, 8, tile);
    b.fill(x + 4, 9, 2, 1, "d");
  }
  b.fill(39, 1, 8, 11, "l");
  b.fill(1, 10, 37, 15, "w");
  b.fill(39, 13, 8, 12, "r");
  b.fill(38, 15, 1, 3, "d");
  b.fill(38, 7, 1, 3, "d");
  b.zone("party", "pcGaming", 1, 1, 15, 8, true, false);
  b.zone("console", "console", 17, 1, 11, 8);
  b.zone("strategy", "streaming", 29, 1, 9, 8, true);
  b.zone("cinema", "cinema", 39, 1, 8, 11);
  b.zone("mabar", "mabar", 1, 10, 15, 9);
  b.zone("lobby", "gamingLounge", 17, 10, 11, 9);
  b.zone("arcade", "relax", 29, 10, 9, 15);
  b.zone("snack", "snack", 1, 20, 15, 5);
  b.zone("entrance", "entrance", 17, 20, 11, 5);
  b.zone("balcony", "balcony", 39, 13, 8, 12);
  for (const x of [2, 7, 12]) b.desk(x, 3, true);
  b.add("speaker", 2, 1);
  b.plants([1, 7], [15, 7]);
  b.add("tv", 20, 1, 5);
  b.lounge(18, 3, 9);
  b.desk(31, 3, true);
  b.add("camera", 36, 3);
  b.add("softbox", 29, 2);
  b.add("bookshelf", 35, 1, 2);
  b.add("tv", 41, 1, 4);
  b.add("rug", 40, 4, 6, 5);
  b.add("beanbag", 40, 5);
  b.add("beanbag", 45, 5);
  b.add("table", 42, 6, 2, 2);
  b.add("lamp", 39, 1);
  b.add("rug", 3, 11, 12, 7);
  b.table(5, 13, 8, 2);
  b.add("whiteboard", 2, 10, 4);
  b.plants([1, 17]);
  b.lounge(18, 11, 9);
  b.add("foosball", 30, 12, 5, 2);
  b.add("arcade", 36, 11);
  b.add("arcade", 36, 14);
  b.add("sofa", 30, 20, 6);
  b.add("table", 32, 22, 2);
  b.add("lamp", 29, 19);
  b.add("counter", 2, 20, 7);
  b.add("coffee", 10, 20, 2);
  b.add("fridge", 13, 20);
  b.add("rug", 20, 21, 6, 2);
  b.plants([18, 22], [27, 22]);
  b.add("firepit", 42, 16, 2, 2);
  b.add("beanbag", 40, 17);
  b.add("beanbag", 45, 17);
  b.add("pergola", 39, 13, 8, 7);
  b.plants([39, 13], [46, 13], [39, 23], [46, 23]);
  return b.finish(22, 18);
}

function studio() {
  const b = world("studio");
  b.fill(1, 1, 24, 18, "w");
  b.fill(1, 19, 24, 6, "s");
  b.fill(26, 1, 12, 10, "s");
  b.fill(39, 1, 8, 10, "w");
  b.fill(26, 12, 21, 13, "w");
  b.fill(30, 11, 3, 1, "d");
  b.fill(42, 11, 2, 1, "d");
  b.fill(25, 15, 1, 4, "d");
  b.zone("ideas", "ideas", 1, 1, 24, 5);
  b.zone("creativeLab", "collaboration", 1, 6, 24, 13);
  b.zone("work", "creativeWork", 1, 19, 24, 6);
  b.zone("recording", "content", 26, 1, 12, 10, true);
  b.zone("material", "material", 39, 1, 8, 10);
  b.zone("gallery", "relax", 26, 12, 21, 6);
  b.zone("discussion", "discussion", 26, 18, 21, 7);
  b.add("whiteboard", 5, 1, 10);
  b.add("bookshelf", 17, 1, 6);
  b.add("lamp", 2, 2);
  b.plants([1, 1], [24, 1]);
  b.add("rug", 5, 7, 16, 10);
  b.table(8, 10, 11, 3);
  b.add("sofa", 1, 9, 3);
  b.add("table", 2, 14, 2);
  b.plants([24, 16]);
  for (const x of [3, 10, 17]) b.desk(x, 20);
  b.add("greenscreen", 28, 1, 8, 2);
  b.desk(29, 5);
  b.add("camera", 34, 6);
  b.add("softbox", 27, 4);
  b.add("softbox", 36, 4);
  b.plants([26, 9]);
  b.add("bookshelf", 40, 1, 6);
  b.add("cabinet", 40, 4, 3);
  b.add("noticeboard", 43, 8, 3);
  b.lounge(33, 12, 11);
  b.add("lamp", 46, 12);
  b.plants([26, 12]);
  b.add("rug", 28, 19, 10, 5);
  b.table(30, 20, 6, 2);
  b.add("counter", 40, 19, 6);
  b.add("coffee", 40, 22, 2);
  b.add("fridge", 44, 22);
  b.plants([46, 24]);
  return b.finish(23, 18);
}

function rooftop() {
  const b = world("rooftop", 54, 28);
  b.fill(1, 1, 46, 24, "r");
  // Focus booth remains isolated; the rest of the roof is intentionally open.
  b.fill(34, 1, 13, 1, "#");
  b.fill(33, 1, 1, 9, "#");
  b.fill(34, 9, 13, 1, "#");
  b.fill(38, 9, 3, 1, "d");
  b.zone("terrace", "relax", 1, 1, 15, 11);
  b.zone("bar", "rooftopBar", 17, 1, 15, 9);
  b.zone("greenhouse", "discussion", 34, 2, 13, 7, true);
  b.zone("communityGarden", "workingSpot", 1, 14, 16, 11);
  b.zone("entrance", "entrance", 18, 18, 12, 7);
  b.zone("rooftopCafe", "bbq", 31, 13, 9, 12);
  b.zone("viewpoint", "viewpoint", 41, 13, 6, 12);
  b.lounge(3, 3, 12);
  b.add("pergola", 2, 1, 14, 8);
  b.add("lamp", 2, 10);
  b.add("counter", 19, 3, 10);
  b.add("coffee", 20, 1, 2);
  b.add("fridge", 29, 1);
  b.add("pergola", 18, 1, 14, 7);
  // Bar stools touch the counter, so seated people face the bar (not away from it).
  for (const x of [21, 23, 25, 27]) b.add("chair", x, 4);
  b.table(36, 5, 8, 2);
  b.add("parasol", 35, 2, 10, 5);
  b.add("rug", 3, 15, 12, 8);
  b.table(5, 17, 8, 2);
  b.add("desk", 4, 22, 4);
  b.add("rug", 20, 20, 8, 3);
  b.add("welcome", 22, 18, 4);
  b.add("bbq", 32, 16, 6, 2);
  b.add("counter", 32, 20, 5);
  b.add("cooler", 38, 20);
  b.add("table", 42, 17, 3, 2);
  b.add("chair", 42, 16);
  b.add("chair", 44, 19);
  b.add("parasol", 41, 14, 6, 4);
  for (const [x, y] of [
    [1, 1],
    [16, 1],
    [1, 12],
    [16, 12],
    [32, 1],
    [46, 2],
    [34, 2],
    [46, 8],
    [1, 24],
    [16, 24],
    [17, 16],
    [30, 16],
    [30, 24],
    [40, 24],
    [46, 24],
    [40, 13],
  ] as [number, number][])
    b.add("palm", x, y);
  for (const [x, y] of [
    [2, 14],
    [15, 14],
    [18, 24],
    [29, 24],
    [31, 12],
    [46, 12],
  ] as [number, number][])
    b.add("lamp", x, y);
  return b.finish(24, 16);
}

const BUILDERS = { office, home, gaming, studio, rooftop };
export const OFFICE_TEMPLATE = office();
const cache = new Map<TemplateId, MapData>([["office", OFFICE_TEMPLATE]]);
export function buildTemplate(id: TemplateId): MapData {
  if (!cache.has(id)) cache.set(id, BUILDERS[id]());
  return structuredClone(cache.get(id)!);
}
export const templateOf = (map: MapData): TemplateId =>
  isTemplateId(map.template) ? map.template : "office";
