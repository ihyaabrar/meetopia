import { chromium, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

const messages = JSON.parse(await readFile(new URL("../src/i18n/messages/id.json", import.meta.url), "utf8"));

const baseURL = process.env.UI_CHECK_URL ?? "http://localhost:3000";
const output = new URL("../.data/reference-ui/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-gpu"],
  executablePath: process.env.CHROMIUM_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const context = await browser.newContext({
  baseURL,
  viewport: { width: 1560, height: 980 },
  reducedMotion: "reduce",
});
await context.addCookies([{ name: "mt_locale", value: "id", url: baseURL }]);
await context.addInitScript(() =>
  localStorage.setItem(
    "mt_prefs",
    JSON.stringify({ showMinimap: false, showLifeHud: false, reducedMotion: true }),
  ),
);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const shot = async (name) => {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  console.log(`Captured ${name}`);
};
try {
  await page.goto("/");
  await expect(page.locator(".hero-art canvas")).toBeVisible();
  await expect(page.locator(".hero-art canvas")).toHaveAttribute("data-renderer", "illustrated");
  await shot("landing");
  const staticHero = await page.locator(".hero-art canvas").evaluate((canvas) => canvas.toDataURL());
  await page.waitForTimeout(250);
  if (staticHero !== (await page.locator(".hero-art canvas").evaluate((canvas) => canvas.toDataURL())))
    throw new Error("Hero preview must stay still with reduced motion");
  await page.goto("/login");
  await expect(page.locator("#email")).toBeVisible();
  await page.waitForFunction(() => document.querySelector(".auth-room-preview canvas")?.width > 300);
  await expect(page.locator(".auth-room-preview canvas.map-preview")).toHaveAttribute(
    "data-renderer",
    "illustrated",
  );
  await shot("login");
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill(`ui-reference-${Date.now()}@meetopia.invalid`);
  await page.getByLabel("Kata sandi", { exact: true }).fill("Meetopia-qa-2026!");
  await page.getByRole("button", { name: "Lanjut", exact: true }).click();
  await page.getByRole("radio", { name: "Wanita", exact: true }).click();
  await page.getByRole("radio", { name: "Wanita", exact: true }).press("ArrowLeft");
  await expect(page.getByRole("radio", { name: "Pria", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("radio", { name: "Pria", exact: true }).press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Wanita", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByRole("tab")).toHaveCount(8);
  await page.getByRole("tab", { name: "Aksesori", exact: true }).click();
  await page.getByRole("button", { name: "Hijab", exact: true }).click();
  await page.getByRole("button", { name: "Bulat", exact: true }).click();
  await page.getByLabel("Tambahkan headphone", { exact: true }).check();
  const outfitImages = new Set();
  await page.getByRole("tab", { name: "Pakaian", exact: true }).click();
  for (const name of ["Kemeja", "Polo", "Sweater", "Blazer", "Kaus garis"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    outfitImages.add(await page.locator(".avatar-pedestal canvas").evaluate((canvas) => canvas.toDataURL()));
  }
  if (outfitImages.size !== 5) throw new Error("New outfits must render differently");
  await page.getByRole("button", { name: "Bawahan", exact: true }).click();
  await page.getByRole("button", { name: "Rok lipit", exact: true }).click();
  await page.getByRole("tab", { name: "Aksesori", exact: true }).click();
  await page.getByRole("button", { name: "Buku", exact: true }).click();
  const poseImages = new Set();
  // Pratinjau diputar dengan tombol "Putar ke kanan" (delapan arah, lalu kembali ke depan).
  const canvas = page.locator(".avatar-pedestal canvas");
  const rotateRight = page.getByRole("button", { name: "Putar ke kanan", exact: true });
  const directions = new Set();
  for (let i = 0; i < 8; i++) {
    const before = await canvas.getAttribute("data-direction");
    await rotateRight.click();
    await expect(canvas).not.toHaveAttribute("data-direction", before);
    directions.add(await canvas.getAttribute("data-direction"));
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    poseImages.add(await canvas.evaluate((c) => c.toDataURL()));
  }
  if (directions.size !== 8) throw new Error("Rotating must visit all eight viewing angles");
  if (poseImages.size !== 8) throw new Error("Avatar viewing angles must render eight distinct poses");
  await expect(canvas).toHaveAttribute("data-direction", "down");
  const actionImages = new Set();
  await page.getByRole("button", { name: "Tanpa barang", exact: true }).click();
  for (const value of ["idle", "walk", "sit", "wave", "type", "read", "coffee"]) {
    console.log(`Checking preview action ${value}`);
    await page.getByLabel("Pose & aktivitas", { exact: true }).selectOption(value);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    actionImages.add(await page.locator(".avatar-pedestal canvas").evaluate((canvas) => canvas.toDataURL()));
  }
  if (actionImages.size !== 7)
    throw new Error("Preview activities must render distinct poses even with reduced motion");
  await page.getByLabel("Pose & aktivitas", { exact: true }).selectOption("idle");
  await page.getByRole("button", { name: "Buku", exact: true }).click();
  await page.getByRole("tab", { name: "Karakter", exact: true }).click();
  await page.getByRole("tab", { name: "Karakter", exact: true }).press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Kepala", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Aksesori", exact: true }).click();
  await page.getByLabel("Nama tampilan").fill("Nadia");
  await page.waitForTimeout(500);
  await shot("avatar-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Pose & kondisi", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await shot("avatar-mobile");
  await page.getByRole("button", { name: "Pose & kondisi", exact: true }).click();
  await expect(page.getByLabel("Pose & aktivitas", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ringkas pratinjau", exact: true }).click();
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1))
    throw new Error("Avatar mobile horizontal overflow");
  await page.setViewportSize({ width: 1560, height: 980 });
  await page.getByRole("button", { name: "Masuk ke Meetopia", exact: true }).click();
  await page.waitForURL("**/app");
  const tips = page.getByRole("button", { name: "Mengerti!" });
  await tips.waitFor({ state: "visible" });
  await tips.click();
  await page.getByRole("button", { name: "Buat workspace", exact: true }).first().click();
  await page.getByLabel("Nama workspace", { exact: true }).fill("Kantor Nadia");
  await expect(page.locator(".tpl[role=radio]")).toHaveCount(5);
  await expect(page.locator(".tpl canvas[data-renderer=illustrated]")).toHaveCount(5);
  await page.locator(".tpl[aria-checked=true]").press("ArrowRight");
  await expect(page.locator(".tpl-home")).toHaveAttribute("aria-checked", "true");
  await page.locator(".tpl-home").press("ArrowLeft");
  await expect(page.locator(".tpl-office")).toHaveAttribute("aria-checked", "true");
  await page.waitForTimeout(600);
  await shot("map-gallery");
  await page.getByRole("button", { name: "Buat", exact: true }).click();
  await page.getByRole("button", { name: "Masuk ruangan", exact: true }).click();
  // DOM contract works in production too, where __meetopia debug hooks are deliberately absent.
  await expect(page.locator("canvas.map")).toHaveAttribute("data-renderer", "illustrated", {
    timeout: 30000,
  });
  await expect(page.locator(".main-head .head-sub")).toContainText("1 orang di ruangan");
  const me = await (await context.request.get("/api/me")).json();
  if (
    me.user.avatar.accessory !== "hijab" ||
    me.user.avatar.gender !== "female" ||
    !me.user.avatar.headphones ||
    me.user.avatar.eyewear !== "round" ||
    me.user.avatar.bottom !== "skirt" ||
    me.user.avatar.prop !== "book"
  )
    throw new Error("Avatar customization did not persist");
  // Dialog buat workspace memakai pemilih ringkas; galeri lengkap (cari & saring) ada di Map → Ruangan.
  await page.getByRole("button", { name: "Map", exact: true }).first().click();
  await page.getByPlaceholder("Cari map atau tema…").fill("not-a-map");
  await expect(page.getByText("Map tidak ditemukan", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lihat semua map", exact: true }).click();
  await expect(page.locator(".map-gallery .tpl")).toHaveCount(5);
  await page.keyboard.press("Escape");
  await expect(page.locator(".settings")).toHaveCount(0);
  const groups = await (await context.request.get("/api/groups")).json();
  const groupId = groups.groups.find((g) => g.name === "Kantor Nadia").id;
  for (const id of ["office", "home", "gaming", "studio", "rooftop"]) {
    if (id !== "office") {
      const response = await context.request.patch(`/api/groups/${groupId}`, { data: { template: id } });
      if (!response.ok()) throw new Error(`Change map ${id}: ${response.status()}`);
      await expect(page.locator(".main-head .head-sub")).toContainText(messages[`tpl.${id}`]);
    }
    await expect(page.locator("canvas.map")).toBeVisible();
    await expect(page.locator("canvas.map")).toHaveAttribute("data-renderer", "illustrated");
    await page.getByRole("button", { name: "Lihat seluruh map", exact: true }).click();
    await page.waitForTimeout(700);
    await shot(`world-${id}`);
  }
  await page.getByLabel("Cari area di ruangan…").fill("BBQ");
  await expect(page.locator(".room-search-results button")).toHaveCount(1);
  await page.locator(".room-search-results button").click();
  await page.getByRole("button", { name: "Buka / tutup chat", exact: true }).last().click();
  await expect(page.locator(".chat")).toBeVisible();
  await page.getByRole("button", { name: "Buka / tutup chat", exact: true }).last().click();
  await page.setViewportSize({ width: 390, height: 844 });
  await shot("room-mobile");
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1))
    throw new Error("Room mobile horizontal overflow");
  await page.setViewportSize({ width: 960, height: 560 });
  await page.goto("/brand/board.svg");
  await page.screenshot({ path: `${output}/brand-board.png` });
  if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);
  console.log(
    JSON.stringify({
      ok: true,
      screenshots: output,
      maps: 5,
      avatarTabs: 8,
      previewDirections: poseImages.size,
      previewActions: actionImages.size,
      persistedAvatar: me.user.avatar,
      browserErrors: errors.length,
    }),
  );
} finally {
  await browser.close();
}
