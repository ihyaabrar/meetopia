import { expect, test, type Page } from "@playwright/test";

/** Pilih tujuan dari menu "Pergi ke…" di dock. */
async function goTo(page: import("@playwright/test").Page, zone: string) {
  await page.getByRole("button", { name: "Pergi ke…" }).click();
  await page.getByRole("option", { name: zone }).click();
}

const PASS = "rahasia-tes-123";

async function register(page: Page, email: string, name: string) {
  await page.goto("/register", { waitUntil: "domcontentloaded" });
  // Tunggu React/Next.js aktif sebelum mengisi formulir (kalau belum, tombol mengirim formulir HTML biasa).
  await page.waitForFunction(() => !!(window as unknown as { next?: unknown }).next, null, {
    timeout: 60_000,
  });
  await page.waitForTimeout(500);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(PASS);
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByLabel("Nama tampilan").fill(name);
  await page.getByRole("button", { name: "Masuk ke Meetopia" }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
  // Petunjuk singkat selalu muncul untuk akun baru; di jaringan sungguhan bisa beberapa detik.
  await page.getByRole("button", { name: "Mengerti!" }).click({ timeout: 30_000 });
}

async function enterRoom(page: Page) {
  await page.getByRole("button", { name: "Masuk ruangan" }).click();
  await expect(page.locator("canvas.map")).toBeVisible({ timeout: 30_000 });
  // Tersambung ke server real-time: chip area muncul dan tidak ada status "menyambung ulang"
  await expect(page.locator(".hud-chip").first()).toBeVisible({ timeout: 30_000 });
}

test("live: daftar, grup, undangan, saling melihat, chat, catatan, lalu bersih-bersih", async ({
  browser,
}) => {
  const stamp = Date.now();
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  const T = Date.now();
  const log = (m: string) => console.log(`  ✓ [${((Date.now() - T) / 1000).toFixed(1)}s] ${m}`);
  let groupId: string | null = null;

  try {
    await register(a, `tes-claude-a-${stamp}@contoh.id`, "TesA");
    log("A daftar & masuk");
    await a.getByRole("button", { name: "Buat grup" }).first().click();
    await a.getByLabel("Nama grup").fill(`Tes Claude ${stamp}`);
    await a.getByRole("button", { name: "Buat", exact: true }).click();
    await a.waitForURL(/[?&]g=/);
    groupId = new URL(a.url()).searchParams.get("g");
    await enterRoom(a);
    log(`A buat grup & masuk ruangan (${groupId})`);

    await a.getByRole("button", { name: "Undang anggota" }).first().click();
    await expect(a.getByTestId("invite-link")).toHaveValue(/\/invite\/[A-Z0-9]{6}$/);
    const link = await a.getByTestId("invite-link").inputValue();
    await a.keyboard.press("Escape");
    expect(link).toContain("meetopia");
    log(`tautan undangan: ${link.replace(/invite\/.*/, "invite/…")}`);

    await register(b, `tes-claude-b-${stamp}@contoh.id`, "TesB");
    await b.goto(link);
    await b.getByRole("button", { name: "Gabung grup" }).click();
    await b.waitForURL(/\/app\?g=/);
    await enterRoom(b);
    log("B daftar, gabung lewat undangan, masuk ruangan");

    const t0 = Date.now();
    await expect(a.getByText("Di ruangan (2)")).toBeVisible({ timeout: 30_000 });
    await expect(b.getByText("Di ruangan (2)")).toBeVisible({ timeout: 30_000 });
    log(`A & B saling melihat di ruangan (${Date.now() - t0} ms)`);

    // Gerak: B pindah area, A melihat lokasi B berubah (WebSocket + Redis)
    await goTo(b, "Lounge");
    await expect(a.locator(".members .member", { hasText: "TesB" })).toContainText("Lounge", {
      timeout: 30_000,
    });
    log("A melihat B berpindah ke Lounge (sinkron posisi)");

    // Chat kanal
    const text = `halo dari tes ${stamp}`;
    await b.getByRole("button", { name: "Buka obrolan" }).click();
    await b.getByRole("tab", { name: /umum/ }).click();
    const t1 = Date.now();
    await a.getByPlaceholder(/Kirim pesan ke #umum/).fill(text);
    await a.keyboard.press("Enter");
    await expect(b.locator(".msg .body", { hasText: text })).toBeVisible({ timeout: 15_000 });
    log(`chat sampai ke B (${Date.now() - t1} ms)`);

    // Catatan bersama
    await a.getByRole("button", { name: "# catatan" }).click();
    await a.getByRole("button", { name: "Ubah" }).click();
    await a.getByLabel("Bersama", { exact: true }).fill(`catatan ${stamp}`);
    await a.getByRole("button", { name: "Simpan" }).click();
    await b.getByRole("button", { name: "# catatan" }).click();
    await expect(b.locator(".side-panel")).toContainText(`catatan ${stamp}`, { timeout: 15_000 });
    log("catatan bersama terlihat oleh B");

    // Riwayat chat tersimpan (batch ke Neon): muat ulang halaman B
    await b.waitForTimeout(2500);
    await b.reload();
    await b.getByRole("button", { name: "Buka obrolan" }).click();
    await b.getByRole("tab", { name: /umum/ }).click();
    await expect(b.locator(".msg .body", { hasText: text })).toBeVisible({ timeout: 20_000 });
    log("riwayat chat tersimpan setelah muat ulang");
  } finally {
    // Bersih-bersih lewat fetch di dalam halaman (sama seperti aplikasi): hapus grup tes lalu kedua akun tes
    const del = (p: Page, path: string, body?: unknown) =>
      p
        .evaluate(
          ([u, b]) =>
            fetch(u as string, {
              method: "DELETE",
              headers: b ? { "content-type": "application/json" } : undefined,
              body: b ? JSON.stringify(b) : undefined,
            }).then((r) => r.status),
          [path, body] as const,
        )
        .catch(() => 0);
    if (groupId) console.log(`  hapus grup tes: ${await del(a, `/api/groups/${groupId}`)}`);
    for (const p of [a, b]) console.log(`  hapus akun tes: ${await del(p, "/api/me", { password: PASS })}`);
  }
});
