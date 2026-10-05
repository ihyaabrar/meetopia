import { expect, test, type Page } from "@playwright/test";

/** Pilih tujuan dari menu "Pergi ke…" di dock. */
async function goTo(page: import("@playwright/test").Page, zone: string) {
  await page.getByRole("button", { name: "Pergi ke…" }).click();
  await page.getByRole("option", { name: zone }).click();
}

type Debug = {
  room: {
    self: { id: string; x: number; y: number; media: { mic: boolean } } | null;
    snapshot: { conn: string; peers: Map<string, { x: number; y: number; media: { mic: boolean } }> };
    ws: WebSocket | null;
  };
  media: { remote: Array<{ peerId: string; state: string }> };
};

const shots = process.env.SHOTS_DIR;
/** Bila diisi, pengguna B tersambung ke instance real-time lain (uji sinkron lewat Redis, aturan 3). */
const rtUrlB = process.env.E2E_RT_URL_B;

async function pageB(browser: import("@playwright/test").Browser) {
  const ctx = await browser.newContext();
  if (rtUrlB)
    await ctx.addInitScript(
      (url) => ((window as unknown as { __MEETOPIA_RT_URL: string }).__MEETOPIA_RT_URL = url),
      rtUrlB,
    );
  return ctx.newPage();
}

async function register(page: Page, email: string, name: string, path: string | null = "/register") {
  if (path) await page.goto(path);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill("rahasia123");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByLabel("Nama tampilan").fill(name);
  if (shots) await page.screenshot({ path: `${shots}/register-avatar.png` });
  await page.getByRole("button", { name: "Masuk ke Meetopia" }).click();
}

async function enterRoom(page: Page) {
  const tips = page.getByRole("button", { name: "Mengerti!" });
  if (await tips.isVisible().catch(() => false)) await tips.click();
  await page.getByRole("button", { name: "Masuk ruangan" }).click();
  await expect(page.locator("canvas.map")).toBeVisible();
  await page.waitForFunction(
    () => (window as unknown as { __meetopia?: Debug }).__meetopia?.room.snapshot.conn === "open",
  );
}

const dbg = <T>(page: Page, fn: (d: Debug) => T) =>
  page.evaluate((src) => {
    const d = (window as unknown as { __meetopia: Debug }).__meetopia;
    return new Function("d", `return (${src})(d)`)(d);
  }, fn.toString()) as Promise<T>;

test("MVP: grup, undangan, sinkron posisi, chat, catatan, mic, sambung ulang", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await pageB(browser);
  const stamp = Date.now();

  // --- Pengguna A daftar dan membuat grup (M3)
  await register(a, `rani${stamp}@contoh.id`, "Rani");
  await a.waitForURL(/\/app/);
  const tips = a.getByRole("button", { name: "Mengerti!" });
  await tips.click();
  if (shots) await a.screenshot({ path: `${shots}/empty-app.png` });
  await a.getByRole("button", { name: "Buat grup" }).first().click();
  await a.getByLabel("Nama grup").fill("Tim Desain");
  await a.getByRole("button", { name: "Buat", exact: true }).click();
  if (shots) await a.screenshot({ path: `${shots}/device-check.png` });
  await enterRoom(a);

  // --- Undangan
  await a.getByRole("button", { name: "Undang anggota" }).first().click();
  await expect(a.getByTestId("invite-link")).toHaveValue(/\/invite\/[A-Z0-9]{6}$/);
  const link = await a.getByTestId("invite-link").inputValue();
  expect(link).toContain("/invite/");
  await a.keyboard.press("Escape");

  // --- Pengguna B bergabung lewat tautan (harus muncul di ruangan < 2 menit)
  const joinStart = Date.now();
  await b.goto(link);
  await expect(b.getByText("Tim Desain")).toBeVisible();
  await b.getByRole("link", { name: "Daftar" }).click();
  await b.waitForURL(/\/register\?next=/);
  await register(b, `dito${stamp}@contoh.id`, "Dito", null);
  await b.waitForURL(/\/invite\//);
  await b.getByRole("button", { name: "Gabung grup" }).click();
  await b.waitForURL(/\/app\?g=/);
  await enterRoom(b);
  await expect(a.getByText("Di ruangan (2)")).toBeVisible({ timeout: 10_000 });
  // A mendapat notifikasi di lonceng
  await a.getByRole("button", { name: /Notifikasi, 1 belum dibaca/ }).click();
  await expect(a.locator(".notif-list")).toContainText("Dito masuk ke ruangan Tim Desain");
  await a.keyboard.press("Escape");
  expect(Date.now() - joinStart).toBeLessThan(120_000);

  // --- Sinkron posisi (M2): B mengetuk peta, A melihat posisi B berubah
  const bId = await dbg(b, (d) => d.room.self!.id);
  const before = await dbg(b, (d) => ({ x: d.room.self!.x, y: d.room.self!.y }));
  const box = (await b.locator("canvas.map").boundingBox())!;
  await b.mouse.click(box.x + box.width / 2 + 140, box.y + box.height / 2 - 60);
  // Tunggu sampai B benar-benar berhenti di tujuan (sudah bergerak dan tidak lagi berjalan).
  await b.waitForFunction(
    ([x0, y0]) => {
      const s = (window as unknown as { __meetopia: Debug }).__meetopia.room.self! as unknown as {
        x: number;
        y: number;
        moving: boolean;
      };
      return !s.moving && Math.hypot(s.x - x0, s.y - y0) > 1;
    },
    [before.x, before.y],
  );
  const after = await dbg(b, (d) => ({ x: d.room.self!.x, y: d.room.self!.y }));
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(1);
  await a.waitForFunction(
    ([id, x, y]) => {
      const p = (window as unknown as { __meetopia: Debug }).__meetopia.room.snapshot.peers.get(id as string);
      return !!p && Math.abs(p.x - (x as number)) < 0.01 && Math.abs(p.y - (y as number)) < 0.01;
    },
    [bId, after.x, after.y],
  );
  if (shots) await a.screenshot({ path: `${shots}/room-a.png` });

  // --- Chat kanal (M4)
  // Obrolan tertutup jadi bilah ketik; A langsung mengetik, B membuka obrolan untuk membaca.
  await a.getByPlaceholder("Kirim pesan ke #umum").fill("Halo tim! 👋");
  await a.keyboard.press("Enter");
  await expect(b.locator(".chat-toggle .unread")).toBeVisible();
  await b.getByRole("button", { name: "Buka obrolan" }).click();
  await b.getByRole("tab", { name: /# umum/ }).click();
  await expect(b.locator(".msg .body", { hasText: "Halo tim! 👋" })).toBeVisible();

  // --- Catatan bersama (M5)
  await a.getByRole("button", { name: "# catatan" }).click();
  await a.getByRole("button", { name: "Ubah" }).click();
  await a.getByLabel("Bersama", { exact: true }).fill("Agenda: rilis MVP");
  await a.getByRole("button", { name: "Simpan" }).click();
  await b.getByRole("button", { name: "# catatan" }).click();
  await expect(b.locator(".side-panel")).toContainText("Agenda: rilis MVP");
  if (shots) await b.screenshot({ path: `${shots}/notes-b.png` });
  // Catatan pribadi tidak terbaca orang lain
  await a.getByRole("tab", { name: /Pribadi/ }).click();
  await a.getByLabel("Pribadi", { exact: true }).fill("rahasia Rani");
  await expect(a.getByText("Tersimpan", { exact: true })).toBeVisible();
  const bPrivate = await b.evaluate(() => fetch("/api/notes/me").then((r) => r.json()));
  expect(JSON.stringify(bPrivate)).not.toContain("rahasia Rani");
  await a.getByRole("button", { name: "Tutup" }).first().click();
  await b.getByRole("button", { name: "Tutup" }).first().click();

  // --- Mic (M6): mati saat masuk, status terlihat orang lain, WebRTC tersambung saat berdekatan
  const aId = await dbg(a, (d) => d.room.self!.id);
  expect(await dbg(a, (d) => d.room.self!.media.mic)).toBe(false);
  // B menghampiri A lewat daftar anggota → "Hampiri"
  await b.locator(".members .member", { hasText: "Rani" }).click();
  await b.getByRole("button", { name: "Hampiri" }).click();
  await b.waitForFunction((id) => {
    const r = (window as unknown as { __meetopia: Debug }).__meetopia.room;
    const me = r.self!;
    const other = r.snapshot.peers.get(id)!;
    return !(me as unknown as { moving: boolean }).moving && Math.hypot(me.x - other.x, me.y - other.y) < 3;
  }, aId);
  await a.getByRole("button", { name: "Mikrofon mati", exact: true }).click();
  await b.waitForFunction(
    (id) =>
      (window as unknown as { __meetopia: Debug }).__meetopia.room.snapshot.peers.get(id)?.media.mic === true,
    aId,
  );
  await b.waitForFunction(
    (id) =>
      (window as unknown as { __meetopia: Debug }).__meetopia.media.remote.some(
        (r) => r.peerId === id && r.state === "connected",
      ),
    aId,
    { timeout: 20_000 },
  );

  // --- Sambung ulang otomatis (aturan 2)
  const pos = await dbg(b, (d) => ({ x: d.room.self!.x, y: d.room.self!.y }));
  await b.evaluate(() => (window as unknown as { __meetopia: Debug }).__meetopia.room.ws!.close());
  await b.waitForFunction(
    () => (window as unknown as { __meetopia: Debug }).__meetopia.room.snapshot.conn === "reconnecting",
  );
  await b.waitForFunction(
    () => (window as unknown as { __meetopia: Debug }).__meetopia.room.snapshot.conn === "open",
    null,
    { timeout: 15_000 },
  );
  const restored = await dbg(b, (d) => ({ x: d.room.self!.x, y: d.room.self!.y }));
  expect(Math.hypot(restored.x - pos.x, restored.y - pos.y)).toBeLessThan(0.01);
});

test("Ruang privat: dikunci dari dalam, orang luar harus ketuk (FR-23, FR-31)", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await pageB(browser);
  const stamp = Date.now();
  await register(a, `a${stamp}@contoh.id`, "Ayu");
  await a.waitForURL(/\/app/);
  await a.getByRole("button", { name: "Mengerti!" }).click();
  await a.getByRole("button", { name: "Buat grup" }).first().click();
  await a.getByLabel("Nama grup").fill("Kantor Privat");
  await a.getByRole("button", { name: "Buat", exact: true }).click();
  await enterRoom(a);
  await a.getByRole("button", { name: "Undang anggota" }).first().click();
  await expect(a.getByTestId("invite-link")).toHaveValue(/\/invite\/[A-Z0-9]{6}$/);
  const link = await a.getByTestId("invite-link").inputValue();
  await a.keyboard.press("Escape");

  // A masuk ruang rapat lewat menu "Pergi ke…" (navigasi keyboard)
  await goTo(a, "Ruang rapat");
  await expect(a.getByText(/audio terisolasi/)).toBeVisible({ timeout: 20_000 });
  // A mengunci ruang rapat dari dalam
  await a.locator(".hud-tl").getByRole("button", { name: "Kunci" }).click();
  await expect(a.getByText("dikunci oleh Ayu")).toBeVisible();

  await register(b, `b${stamp}@contoh.id`, "Bima");
  await b.waitForURL(/\/app/);
  await b.goto(link);
  await b.getByRole("button", { name: "Gabung grup" }).click();
  await b.waitForURL(/\/app\?g=/);
  await enterRoom(b);

  // B mencoba masuk: berhenti di depan pintu dan ditawari mengetuk
  await goTo(b, "Ruang rapat");
  await b.getByRole("button", { name: "Ketuk" }).click({ timeout: 20_000 });
  expect(
    await b.evaluate(() => (window as unknown as { __meetopia: Debug }).__meetopia.room.self!.y),
  ).toBeGreaterThan(11);

  await a.getByRole("button", { name: "Terima" }).click();
  await expect(b.locator(".hud-tl")).toContainText("dikunci oleh Ayu", { timeout: 20_000 });
  await a.waitForFunction(() => {
    const d = (window as unknown as { __meetopia: Debug }).__meetopia;
    return [...d.room.snapshot.peers.values()].filter((p) => p.y < 11).length === 2;
  });
});

type MusicDebug = {
  room: {
    self: { x: number; y: number; moving: boolean } | null;
    snapshot: { music: Record<string, unknown> };
  };
  music: { getSnapshot: () => Array<{ volume: number }> };
  walkTo: (p: { x: number; y: number }) => void;
};

/** Jalan ke titik (x, y) lewat pencari jalur yang sama dengan ketukan di peta, lalu tunggu sampai berhenti. */
async function walk(page: Page, x: number, y: number) {
  await page.evaluate(
    ([x, y]) => (window as unknown as { __meetopia: MusicDebug }).__meetopia.walkTo({ x, y }),
    [x, y],
  );
  await page.waitForFunction(
    ([x, y]) => {
      const s = (window as unknown as { __meetopia: MusicDebug }).__meetopia.room.self!;
      return !s.moving && Math.hypot(s.x - x, s.y - y) < 1.2;
    },
    [x, y],
    { timeout: 30_000 },
  );
}

const musicVolume = (page: Page) =>
  page.evaluate(() => {
    const a = (window as unknown as { __meetopia: MusicDebug }).__meetopia.music.getSnapshot();
    return a.length ? a[0].volume : 0;
  });

test("Speaker: musik makin pelan saat menjauh, hilang di luar jangkauan", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await pageB(browser);
  const stamp = Date.now();
  await register(a, `a${stamp}@contoh.id`, "Ayu");
  await a.waitForURL(/\/app/);
  await a.getByRole("button", { name: "Mengerti!" }).click();
  await a.getByRole("button", { name: "Buat grup" }).first().click();
  await a.getByLabel("Nama grup").fill("Kafe Musik");
  await a.getByRole("button", { name: "Buat", exact: true }).click();
  await enterRoom(a);
  await a.getByRole("button", { name: "Undang anggota" }).first().click();
  await expect(a.getByTestId("invite-link")).toHaveValue(/\/invite\/[A-Z0-9]{6}$/);
  const link = await a.getByTestId("invite-link").inputValue();
  await a.keyboard.press("Escape");

  await register(b, `b${stamp}@contoh.id`, "Bima");
  await b.waitForURL(/\/app/);
  await b.goto(link);
  await b.getByRole("button", { name: "Gabung grup" }).click();
  await b.waitForURL(/\/app\?g=/);
  await enterRoom(b);

  // A mendekati speaker di lounge dan memutar stasiun bawaan
  await walk(a, 38.5, 23.5);
  // Popup aksi tidak muncul sendiri: objek harus diketuk (atau tekan E di peta).
  await expect(a.locator(".hint-pop")).toHaveCount(0);
  await a.keyboard.press("e");
  await a.locator(".hint-pop").getByRole("button", { name: "Atur musik" }).click();
  await expect(a.locator(".hint-pop")).toHaveCount(0);
  await a.getByRole("button", { name: /Lo-fi santai/ }).click();
  await expect(a.getByText("Diputar oleh Ayu")).toBeVisible();
  await a.keyboard.press("Escape");

  // B di lobi: status musik diterima, tapi terlalu jauh untuk terdengar
  await b.waitForFunction(
    () =>
      Object.keys((window as unknown as { __meetopia: MusicDebug }).__meetopia.room.snapshot.music).length ===
      1,
  );
  await b.waitForTimeout(400);
  expect(await musicVolume(b)).toBe(0);

  // Dekat speaker: terdengar keras
  await walk(b, 36.5, 23.5);
  await expect.poll(() => musicVolume(b)).toBeGreaterThan(0.75);
  await expect(b.locator(".hud-chip.music")).toContainText("Lo-fi santai");
  const near = await musicVolume(b);

  // Menjauh ke ujung lounge: lebih pelan tapi masih terdengar
  await walk(b, 28.5, 24.5);
  await expect.poll(() => musicVolume(b)).toBeLessThan(near);
  const far = await musicVolume(b);
  expect(far).toBeGreaterThan(0);
  expect(far).toBeLessThan(0.5);

  // A menghentikan musik: hilang untuk semua orang
  await a.keyboard.press("e");
  await a.locator(".hint-pop").getByRole("button", { name: "Atur musik" }).click();
  await a.getByRole("button", { name: "Hentikan" }).click();
  await b.waitForFunction(
    () =>
      Object.keys((window as unknown as { __meetopia: MusicDebug }).__meetopia.room.snapshot.music).length ===
      0,
  );
  await expect(b.locator(".hud-chip.music")).toHaveCount(0);
});

test("Jenis ruangan: buat Rumah, lalu ganti ke Gaming house", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  a.on("dialog", (d) => void d.accept());
  const stamp = Date.now();
  await register(a, `r${stamp}@contoh.id`, "Rani");
  await a.waitForURL(/\/app/);
  await a.getByRole("button", { name: "Mengerti!" }).click();
  await a.getByRole("button", { name: "Buat grup" }).first().click();
  await a.getByLabel("Nama grup").fill("Rumah Rani");
  await a.getByRole("radio", { name: /Rumah/ }).click();
  await a.getByRole("button", { name: "Buat", exact: true }).click();
  await enterRoom(a);
  const template = () =>
    a.evaluate(
      () =>
        (window as unknown as { __meetopia: { room: { snapshot: { map: { template?: string } } } } })
          .__meetopia.room.snapshot.map.template,
    );
  expect(await template()).toBe("home");

  // Bergerak dengan WASD
  const selfX = () => a.evaluate(() => (window as unknown as { __meetopia: Debug }).__meetopia.room.self!.x);
  const x0 = await selfX();
  await a.keyboard.down("d");
  await expect.poll(selfX, { timeout: 5_000 }).toBeGreaterThan(x0 + 1);
  await a.keyboard.up("d");
  await expect(a.locator(".hud-tl")).toContainText("Ruang keluarga");

  // Kamar bisa dikunci dari dalam
  await goTo(a, "Kamar 1");
  await expect(a.locator(".hud-tl")).toContainText("Kamar 1", { timeout: 20_000 });
  await a.locator(".hud-tl").getByRole("button", { name: "Kunci" }).click();
  await expect(a.getByText("dikunci oleh Rani")).toBeVisible();

  // Ganti jenis ruangan: semua orang dipindah ke titik muncul baru, kunci dibuka
  await a.getByRole("button", { name: "Pengaturan grup" }).first().click();
  await a.locator(".settings-nav").getByRole("button", { name: "Ruangan" }).click();
  await a.getByRole("radio", { name: /Gaming house/ }).click();
  await a.getByRole("button", { name: "Ganti jenis ruangan" }).click();
  await a.keyboard.press("Escape");
  await expect.poll(template, { timeout: 15_000 }).toBe("gaming");
  await expect(a.locator(".hud-tl")).toContainText("Lobi");
  await expect(a.getByText("dikunci oleh Rani")).toHaveCount(0);
});
