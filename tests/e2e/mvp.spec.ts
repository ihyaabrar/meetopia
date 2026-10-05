import { expect, test, type Page } from "@playwright/test";

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
  await a.getByRole("button", { name: "Undang anggota" }).click();
  await a.getByRole("button", { name: "Buat tautan undangan" }).click();
  const link = (await a.getByTestId("invite-link").textContent())!.trim();
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
  await expect(a.getByText("Di ruangan — 2")).toBeVisible({ timeout: 10_000 });
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
  await a.getByRole("tab", { name: /# umum/ }).click();
  await a.getByPlaceholder("Kirim pesan ke #umum").fill("Halo tim! 👋");
  await a.keyboard.press("Enter");
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
  await expect(a.getByText("Tersimpan ✓")).toBeVisible();
  const bPrivate = await b.evaluate(() => fetch("/api/notes/me").then((r) => r.json()));
  expect(JSON.stringify(bPrivate)).not.toContain("rahasia Rani");
  await a.getByRole("button", { name: "Tutup" }).first().click();
  await b.getByRole("button", { name: "Tutup" }).first().click();

  // --- Mic (M6): mati saat masuk, status terlihat orang lain, WebRTC tersambung saat berdekatan
  const aId = await dbg(a, (d) => d.room.self!.id);
  expect(await dbg(a, (d) => d.room.self!.media.mic)).toBe(false);
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

test("Ruang privat: masuk perlu ketuk bila sedang dipakai (FR-23, FR-31)", async ({ browser }) => {
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
  await a.getByRole("button", { name: "Undang anggota" }).click();
  await a.getByRole("button", { name: "Buat tautan undangan" }).click();
  const link = (await a.getByTestId("invite-link").textContent())!.trim();
  await a.keyboard.press("Escape");

  // A masuk ruang rapat lewat menu "Pergi ke…" (navigasi keyboard)
  await a.getByLabel("Pergi ke…").selectOption("meeting");
  await expect(a.getByText(/audio terisolasi/)).toBeVisible({ timeout: 20_000 });

  await register(b, `b${stamp}@contoh.id`, "Bima");
  await b.waitForURL(/\/app/);
  await b.goto(link);
  await b.getByRole("button", { name: "Gabung grup" }).click();
  await b.waitForURL(/\/app\?g=/);
  await enterRoom(b);

  // B mencoba masuk: berhenti di depan pintu dan ditawari mengetuk
  await b.getByLabel("Pergi ke…").selectOption("meeting");
  await b.getByRole("button", { name: "Ketuk" }).click({ timeout: 20_000 });
  expect(
    await b.evaluate(() => (window as unknown as { __meetopia: Debug }).__meetopia.room.self!.y),
  ).toBeGreaterThan(11);

  await a.getByRole("button", { name: "Terima" }).click();
  await expect(b.getByText(/audio terisolasi/)).toBeVisible({ timeout: 20_000 });
  await a.waitForFunction(() => {
    const d = (window as unknown as { __meetopia: Debug }).__meetopia;
    return [...d.room.snapshot.peers.values()].filter((p) => p.y < 11).length === 2;
  });
});
