/**
 * Jenis ruangan yang bisa dipilih saat membuat grup. Masing-masing punya tata ruang dan kelebihan sendiri:
 *
 * - Kantor: area kerja dengan meja, ruang rapat kedap suara yang bisa dikunci, lounge dengan speaker.
 * - Rumah: ruang keluarga dengan TV dan speaker, dapur dan meja makan, dua kamar kedap suara yang bisa
 *   dikunci, teras dengan taman.
 * - Gaming house: ruang main "party" (semua yang di dalam saling mendengar penuh dan bisa nonton layar
 *   bersama), ruang strategi yang bisa dikunci, arcade, dan snack bar.
 *
 * Peta disimpan per grup sebagai JSON. `templateRev` dinaikkan bila template diperbaiki agar peta lama
 * yang belum diubah ikut diperbarui (pengaturan audio tetap).
 */
import { DEFAULT_AUDIO, type MapData, type MapObject, type Zone } from "./map";

export const TEMPLATE_IDS = ["office", "home", "gaming"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export const isTemplateId = (v: unknown): v is TemplateId =>
  typeof v === "string" && (TEMPLATE_IDS as readonly string[]).includes(v);

export const TEMPLATE_REVS: Record<TemplateId, number> = { office: 4, home: 1, gaming: 1 };

/** Kelebihan tiap jenis ruangan (kunci terjemahan), ditampilkan saat memilih. */
export const TEMPLATE_PERKS: Record<TemplateId, string[]> = {
  office: ["tpl.office.p1", "tpl.office.p2", "tpl.office.p3"],
  home: ["tpl.home.p1", "tpl.home.p2", "tpl.home.p3"],
  gaming: ["tpl.gaming.p1", "tpl.gaming.p2", "tpl.gaming.p3"],
};

/** Pembantu menyusun peta: grid tile dan daftar objek dengan id berurutan. */
function builder(W: number, H: number) {
  const grid: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => "#"));
  const objects: MapObject[] = [];
  let n = 0;
  return {
    fill(x0: number, y0: number, w: number, h: number, c: string) {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) grid[y][x] = c;
    },
    add(o: Omit<MapObject, "id">) {
      objects.push({ id: `${o.kind}-${++n}`, ...o });
    },
    finish(template: TemplateId, zones: Zone[], spawn: { x: number; y: number }): MapData {
      return {
        version: 1,
        template,
        templateRev: TEMPLATE_REVS[template],
        width: W,
        height: H,
        tiles: grid.map((r) => r.join("")),
        zones,
        objects,
        spawn,
        audio: { ...DEFAULT_AUDIO },
      };
    },
  };
}

const sit = { label: "object.chair", actions: ["sit" as const] };

function buildOffice(): MapData {
  const W = 44;
  const H = 28;
  const grid: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => "#"));
  const fill = (x0: number, y0: number, w: number, h: number, c: string) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) grid[y][x] = c;
  };
  // Area kerja (kiri atas), ruang rapat privat (kanan atas), lobi (kiri bawah), lounge (kanan bawah).
  fill(1, 1, 22, 13, "w");
  fill(24, 1, 19, 10, "m");
  fill(1, 15, 22, 12, ".");
  fill(24, 12, 19, 15, "l");
  // Pintu
  fill(10, 14, 3, 1, "d"); // lobi <-> area kerja
  fill(23, 20, 1, 3, "d"); // lobi <-> lounge
  fill(32, 11, 2, 1, "d"); // lounge <-> ruang rapat
  fill(23, 5, 1, 2, "d"); // area kerja <-> ruang rapat

  const objects: MapObject[] = [];
  let n = 0;
  const add = (o: Omit<MapObject, "id">) => objects.push({ id: `${o.kind}-${++n}`, ...o });

  // Area kerja: deretan meja dengan kursi
  for (const row of [3, 8]) {
    for (const col of [3, 9, 15]) {
      add({
        kind: "desk",
        x: col,
        y: row,
        w: 3,
        h: 1,
        solid: true,
        label: "object.desk",
        actions: ["openPrivateNotes"],
      });
      add({
        kind: "chair",
        x: col + 1,
        y: row + 1,
        w: 1,
        h: 1,
        solid: false,
        label: "object.chair",
        actions: ["sit"],
      });
    }
  }
  add({
    kind: "whiteboard",
    x: 19,
    y: 1,
    w: 3,
    h: 1,
    solid: true,
    label: "object.whiteboard",
    actions: ["openSharedNotes"],
  });
  add({
    kind: "bookshelf",
    x: 1,
    y: 1,
    w: 2,
    h: 1,
    solid: true,
    label: "object.bookshelf",
    actions: ["read"],
  });
  add({ kind: "plant", x: 21, y: 12, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 1, y: 12, w: 1, h: 1, solid: true });
  add({ kind: "lamp", x: 1, y: 6, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 7, y: 1, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 13, y: 1, w: 1, h: 1, solid: true });
  add({ kind: "lamp", x: 21, y: 6, w: 1, h: 1, solid: true });

  // Ruang rapat
  add({
    kind: "table",
    x: 29,
    y: 4,
    w: 8,
    h: 3,
    solid: true,
    label: "object.meetingTable",
    actions: ["openSharedNotes"],
  });
  for (const x of [30, 32, 34, 36]) {
    add({
      kind: "chair",
      x,
      y: 3,
      w: 1,
      h: 1,
      solid: false,
      facing: "down",
      label: "object.chair",
      actions: ["sit"],
    });
    add({
      kind: "chair",
      x,
      y: 7,
      w: 1,
      h: 1,
      solid: false,
      facing: "up",
      label: "object.chair",
      actions: ["sit"],
    });
  }
  add({
    kind: "whiteboard",
    x: 39,
    y: 1,
    w: 3,
    h: 1,
    solid: true,
    label: "object.whiteboard",
    actions: ["openSharedNotes"],
  });
  add({ kind: "plant", x: 41, y: 9, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 25, y: 9, w: 1, h: 1, solid: true });
  add({
    kind: "tv",
    x: 31,
    y: 1,
    w: 3,
    h: 1,
    solid: true,
    label: "object.screen",
    actions: ["openSharedNotes"],
  });
  add({ kind: "lamp", x: 25, y: 1, w: 1, h: 1, solid: true });

  // Lobi
  add({ kind: "rug", x: 8, y: 19, w: 7, h: 4, solid: false });
  add({
    kind: "welcome",
    x: 10,
    y: 16,
    w: 3,
    h: 1,
    solid: true,
    label: "object.welcome",
    actions: ["showTips"],
  });
  add({
    kind: "noticeboard",
    x: 2,
    y: 15,
    w: 3,
    h: 1,
    solid: true,
    label: "object.noticeboard",
    actions: ["openSharedNotes"],
  });
  add({ kind: "plant", x: 1, y: 25, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 21, y: 25, w: 1, h: 1, solid: true });
  add({ kind: "sofa", x: 17, y: 24, w: 3, h: 1, solid: false, label: "object.sofa", actions: ["sit"] });
  add({ kind: "cooler", x: 21, y: 15, w: 1, h: 1, solid: true, label: "object.cooler", actions: ["drink"] });
  add({ kind: "beanbag", x: 3, y: 21, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "beanbag", x: 5, y: 23, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "plant", x: 15, y: 15, w: 1, h: 1, solid: true });
  add({ kind: "lamp", x: 1, y: 18, w: 1, h: 1, solid: true });
  add({ kind: "art", x: 6, y: 14, w: 2, h: 1, solid: false });
  add({ kind: "art", x: 16, y: 14, w: 2, h: 1, solid: false });

  // Lounge
  add({ kind: "sofa", x: 27, y: 16, w: 3, h: 1, solid: false, label: "object.sofa", actions: ["sit"] });
  add({ kind: "sofa", x: 33, y: 16, w: 3, h: 1, solid: false, label: "object.sofa", actions: ["sit"] });
  add({ kind: "table", x: 30, y: 18, w: 3, h: 2, solid: true });
  add({ kind: "vending", x: 40, y: 13, w: 2, h: 1, solid: true, label: "object.vending", actions: ["buy"] });
  add({ kind: "coffee", x: 37, y: 13, w: 2, h: 1, solid: true, label: "object.coffee", actions: ["brew"] });
  add({ kind: "plant", x: 41, y: 25, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 25, y: 25, w: 1, h: 1, solid: true });
  add({ kind: "rug", x: 31, y: 22, w: 6, h: 3, solid: false });
  add({ kind: "tv", x: 27, y: 13, w: 3, h: 1, solid: true, label: "object.tv", actions: ["watch"] });
  add({ kind: "beanbag", x: 32, y: 23, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "beanbag", x: 35, y: 23, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "lamp", x: 42, y: 17, w: 1, h: 1, solid: true });
  add({ kind: "lamp", x: 24, y: 13, w: 1, h: 1, solid: true });
  add({ kind: "art", x: 34, y: 11, w: 2, h: 1, solid: false });
  add({
    kind: "speaker",
    x: 38,
    y: 22,
    w: 1,
    h: 1,
    solid: true,
    label: "object.speaker",
    actions: ["music"],
  });
  add({ kind: "art", x: 38, y: 11, w: 2, h: 1, solid: false });

  return {
    version: 1,
    template: "office",
    templateRev: TEMPLATE_REVS.office,
    width: W,
    height: H,
    tiles: grid.map((r) => r.join("")),
    zones: [
      { id: "work", label: "zone.work", x: 1, y: 1, w: 22, h: 13, private: false },
      { id: "meeting", label: "zone.meeting", x: 24, y: 1, w: 19, h: 10, private: true, lockable: true },
      { id: "lobby", label: "zone.lobby", x: 1, y: 15, w: 22, h: 12, private: false },
      { id: "lounge", label: "zone.lounge", x: 24, y: 12, w: 19, h: 15, private: false },
    ],
    objects,
    spawn: { x: 11, y: 21 },
    audio: { ...DEFAULT_AUDIO },
  };
}

function buildHome(): MapData {
  const b = builder(36, 24);
  const { fill, add } = b;
  fill(1, 1, 19, 13, "h"); // ruang keluarga
  fill(21, 1, 14, 9, "k"); // dapur & ruang makan
  fill(21, 11, 7, 12, "b"); // kamar 1
  fill(29, 11, 6, 12, "b"); // kamar 2
  fill(1, 15, 19, 8, "g"); // teras & taman
  fill(8, 14, 3, 1, "d"); // keluarga <-> teras
  fill(20, 4, 1, 3, "d"); // keluarga <-> dapur
  fill(23, 10, 2, 1, "d"); // dapur <-> kamar 1
  fill(31, 10, 2, 1, "d"); // dapur <-> kamar 2

  // Ruang keluarga: sofa menghadap TV, karpet, speaker, rak buku
  add({ kind: "tv", x: 7, y: 1, w: 3, h: 1, solid: true, label: "object.tv", actions: ["watch"] });
  add({ kind: "rug", x: 5, y: 4, w: 8, h: 5, solid: false });
  add({ kind: "sofa", x: 6, y: 8, w: 3, h: 1, solid: false, label: "object.sofa", actions: ["sit"] });
  add({ kind: "sofa", x: 10, y: 8, w: 3, h: 1, solid: false, label: "object.sofa", actions: ["sit"] });
  add({ kind: "table", x: 8, y: 5, w: 2, h: 2, solid: true });
  add({ kind: "beanbag", x: 4, y: 6, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "beanbag", x: 14, y: 6, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "speaker", x: 12, y: 1, w: 1, h: 1, solid: true, label: "object.speaker", actions: ["music"] });
  add({
    kind: "bookshelf",
    x: 1,
    y: 1,
    w: 2,
    h: 1,
    solid: true,
    label: "object.bookshelf",
    actions: ["read"],
  });
  add({ kind: "lamp", x: 4, y: 1, w: 1, h: 1, solid: true });
  add({ kind: "lamp", x: 18, y: 9, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 18, y: 1, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 1, y: 12, w: 1, h: 1, solid: true });
  add({ kind: "art", x: 15, y: 0, w: 2, h: 1, solid: false });
  add({
    kind: "noticeboard",
    x: 15,
    y: 12,
    w: 3,
    h: 1,
    solid: true,
    label: "object.familyBoard",
    actions: ["openSharedNotes"],
  });

  // Dapur & ruang makan
  add({ kind: "counter", x: 22, y: 1, w: 5, h: 1, solid: true, label: "object.kitchen", actions: ["cook"] });
  add({ kind: "fridge", x: 27, y: 1, w: 1, h: 1, solid: true, label: "object.fridge", actions: ["drink"] });
  add({ kind: "coffee", x: 29, y: 1, w: 2, h: 1, solid: true, label: "object.coffee", actions: ["brew"] });
  add({
    kind: "table",
    x: 26,
    y: 5,
    w: 4,
    h: 2,
    solid: true,
    label: "object.diningTable",
    actions: ["openSharedNotes"],
  });
  for (const x of [26, 28]) {
    add({ kind: "chair", x, y: 4, w: 1, h: 1, solid: false, facing: "down", ...sit });
    add({ kind: "chair", x: x + 1, y: 7, w: 1, h: 1, solid: false, facing: "up", ...sit });
  }
  add({ kind: "plant", x: 33, y: 8, w: 1, h: 1, solid: true });
  add({ kind: "lamp", x: 33, y: 1, w: 1, h: 1, solid: true });

  // Kamar (kedap suara, bisa dikunci)
  for (const [x0, w] of [
    [21, 7],
    [29, 6],
  ] as const) {
    add({ kind: "bed", x: x0 + 1, y: 19, w: 2, h: 3, solid: false, label: "object.bed", actions: ["sit"] });
    add({ kind: "lamp", x: x0 + 3, y: 19, w: 1, h: 1, solid: true });
    add({
      kind: "desk",
      x: x0 + w - 3,
      y: 12,
      w: 3,
      h: 1,
      solid: true,
      label: "object.desk",
      actions: ["openPrivateNotes"],
    });
    add({ kind: "chair", x: x0 + w - 2, y: 13, w: 1, h: 1, solid: false, ...sit });
    add({ kind: "rug", x: x0 + 1, y: 15, w: w - 2, h: 3, solid: false });
    add({ kind: "plant", x: x0, y: 12, w: 1, h: 1, solid: true });
  }

  // Teras & taman
  add({ kind: "table", x: 8, y: 18, w: 3, h: 2, solid: true });
  for (const [x, y, f] of [
    [8, 17, "down"],
    [10, 17, "down"],
    [9, 20, "up"],
  ] as const)
    add({ kind: "chair", x, y, w: 1, h: 1, solid: false, facing: f, ...sit });
  add({ kind: "beanbag", x: 3, y: 18, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "beanbag", x: 15, y: 19, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "cooler", x: 18, y: 15, w: 1, h: 1, solid: true, label: "object.cooler", actions: ["drink"] });
  for (const [x, y] of [
    [1, 15],
    [1, 21],
    [5, 21],
    [13, 15],
    [18, 21],
    [14, 21],
  ])
    add({ kind: "plant", x, y, w: 1, h: 1, solid: true });

  return b.finish(
    "home",
    [
      { id: "living", label: "zone.living", x: 1, y: 1, w: 19, h: 13, private: false },
      { id: "kitchen", label: "zone.kitchen", x: 21, y: 1, w: 14, h: 9, private: false },
      { id: "bedroom1", label: "zone.bedroom1", x: 21, y: 11, w: 7, h: 12, private: true, lockable: true },
      { id: "bedroom2", label: "zone.bedroom2", x: 29, y: 11, w: 6, h: 12, private: true, lockable: true },
      { id: "garden", label: "zone.garden", x: 1, y: 15, w: 19, h: 8, private: false },
    ],
    { x: 10, y: 11 },
  );
}

function buildGaming(): MapData {
  const b = builder(40, 26);
  const { fill, add } = b;
  fill(1, 1, 24, 13, "x"); // ruang main (party)
  fill(26, 1, 13, 9, "m"); // ruang strategi
  fill(26, 11, 13, 3, "l"); // snack bar
  fill(1, 15, 14, 10, "."); // lobi
  fill(16, 15, 23, 10, "x"); // arcade
  fill(6, 14, 3, 1, "d"); // main <-> lobi
  fill(15, 19, 1, 3, "d"); // lobi <-> arcade
  fill(25, 11, 1, 2, "d"); // main <-> snack
  fill(31, 10, 2, 1, "d"); // snack <-> strategi
  fill(31, 14, 3, 1, "d"); // snack <-> arcade

  // Ruang main: deretan PC gaming dan layar besar untuk nonton bareng
  add({ kind: "tv", x: 10, y: 1, w: 3, h: 1, solid: true, label: "object.streamScreen", actions: ["watch"] });
  for (const row of [4, 8]) {
    for (const col of [2, 7, 14, 19]) {
      add({
        kind: "gamingDesk",
        x: col,
        y: row,
        w: 3,
        h: 1,
        solid: true,
        label: "object.gamingPc",
        actions: ["play"],
      });
      add({ kind: "chair", x: col + 1, y: row + 1, w: 1, h: 1, solid: false, ...sit });
    }
  }
  add({ kind: "beanbag", x: 11, y: 4, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "beanbag", x: 12, y: 9, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "lamp", x: 1, y: 1, w: 1, h: 1, solid: true });
  add({ kind: "lamp", x: 23, y: 1, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 1, y: 12, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 23, y: 12, w: 1, h: 1, solid: true });

  // Ruang strategi (kedap suara, bisa dikunci)
  add({
    kind: "table",
    x: 29,
    y: 4,
    w: 7,
    h: 2,
    solid: true,
    label: "object.meetingTable",
    actions: ["openSharedNotes"],
  });
  for (const x of [30, 32, 34]) {
    add({ kind: "chair", x, y: 3, w: 1, h: 1, solid: false, facing: "down", ...sit });
    add({ kind: "chair", x, y: 6, w: 1, h: 1, solid: false, facing: "up", ...sit });
  }
  add({
    kind: "whiteboard",
    x: 30,
    y: 1,
    w: 3,
    h: 1,
    solid: true,
    label: "object.whiteboard",
    actions: ["openSharedNotes"],
  });
  add({ kind: "plant", x: 37, y: 8, w: 1, h: 1, solid: true });

  // Snack bar
  add({ kind: "vending", x: 35, y: 11, w: 2, h: 1, solid: true, label: "object.vending", actions: ["buy"] });
  add({ kind: "fridge", x: 37, y: 11, w: 1, h: 1, solid: true, label: "object.fridge", actions: ["drink"] });
  add({ kind: "coffee", x: 27, y: 11, w: 2, h: 1, solid: true, label: "object.coffee", actions: ["brew"] });

  // Lobi
  add({
    kind: "welcome",
    x: 6,
    y: 16,
    w: 3,
    h: 1,
    solid: true,
    label: "object.welcome",
    actions: ["showTips"],
  });
  add({ kind: "rug", x: 4, y: 19, w: 7, h: 4, solid: false });
  add({ kind: "sofa", x: 5, y: 23, w: 3, h: 1, solid: false, label: "object.sofa", actions: ["sit"] });
  add({
    kind: "noticeboard",
    x: 1,
    y: 15,
    w: 3,
    h: 1,
    solid: true,
    label: "object.noticeboard",
    actions: ["openSharedNotes"],
  });
  add({ kind: "plant", x: 13, y: 15, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 1, y: 23, w: 1, h: 1, solid: true });

  // Arcade: mesin arcade, sofa, speaker
  for (const x of [17, 19, 21, 23])
    add({ kind: "arcade", x, y: 15, w: 1, h: 1, solid: true, label: "object.arcade", actions: ["play"] });
  add({
    kind: "speaker",
    x: 26,
    y: 15,
    w: 1,
    h: 1,
    solid: true,
    label: "object.speaker",
    actions: ["music"],
  });
  add({ kind: "rug", x: 28, y: 18, w: 7, h: 4, solid: false });
  add({ kind: "beanbag", x: 29, y: 19, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "beanbag", x: 33, y: 19, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "tv", x: 30, y: 16, w: 3, h: 1, solid: true, label: "object.tv", actions: ["watch"] });
  add({ kind: "sofa", x: 30, y: 22, w: 3, h: 1, solid: false, label: "object.sofa", actions: ["sit"] });
  add({ kind: "beanbag", x: 19, y: 20, w: 1, h: 1, solid: false, label: "object.beanbag", actions: ["sit"] });
  add({ kind: "lamp", x: 37, y: 15, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 37, y: 23, w: 1, h: 1, solid: true });
  add({ kind: "plant", x: 16, y: 23, w: 1, h: 1, solid: true });

  return b.finish(
    "gaming",
    [
      // Ruang main: kedap suara tapi tidak bisa dikunci, jadi semua yang masuk langsung ikut "party".
      { id: "party", label: "zone.party", x: 1, y: 1, w: 24, h: 13, private: true, lockable: false },
      { id: "strategy", label: "zone.strategy", x: 26, y: 1, w: 13, h: 9, private: true, lockable: true },
      { id: "snack", label: "zone.snack", x: 26, y: 11, w: 13, h: 3, private: false },
      { id: "lobby", label: "zone.lobby", x: 1, y: 15, w: 14, h: 10, private: false },
      { id: "arcade", label: "zone.arcade", x: 16, y: 15, w: 23, h: 10, private: false },
    ],
    { x: 7, y: 21 },
  );
}

export const OFFICE_TEMPLATE: MapData = buildOffice();
const BUILDERS: Record<TemplateId, () => MapData> = {
  office: () => OFFICE_TEMPLATE,
  home: buildHome,
  gaming: buildGaming,
};
const cache = new Map<TemplateId, MapData>();

/** Salinan baru peta untuk jenis ruangan (aman diubah). */
export function buildTemplate(id: TemplateId): MapData {
  if (!cache.has(id)) cache.set(id, BUILDERS[id]());
  return structuredClone(cache.get(id)!);
}

export const templateOf = (map: MapData): TemplateId =>
  isTemplateId(map.template) ? map.template : "office";
