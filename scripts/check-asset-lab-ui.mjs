import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const output = "D:/Github/meetopia/.data/workstation-v2";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto((process.env.UI_CHECK_URL ?? "http://localhost:3000") + "/asset-lab");
  await expect(page.locator('canvas[data-ready="true"]')).toHaveCount(4, { timeout: 60000 });
  await page.screenshot({ path: output + "/lab-desktop.png", fullPage: true });
  const sample = page.locator('canvas[data-direction="right"]');
  async function changed(action) {
    const before = await sample.evaluate((c) => c.toDataURL());
    await action();
    await expect.poll(() => sample.evaluate((c) => c.toDataURL()), { timeout: 10000 }).not.toBe(before);
  }
  await changed(() => page.getByLabel("Bentuk tubuh", { exact: true }).selectOption("small"));
  await changed(() => page.getByLabel("Karakter uji", { exact: true }).selectOption("female"));
  await changed(() => page.getByLabel("Baju", { exact: true }).selectOption("hoodie"));
  await changed(() => page.getByRole("button", { name: "Mengetik", exact: true }).click());
  await expect(page.getByRole("button", { name: "Mengetik", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await changed(() => page.getByLabel("Zoom", { exact: true }).selectOption("1"));
  await changed(() => page.getByLabel("Grid & titik duduk", { exact: true }).check());
  await page.getByLabel("Grid & titik duduk", { exact: true }).uncheck();
  await page.getByLabel("Zoom", { exact: true }).selectOption("2");
  await changed(() => page.getByLabel("Putar animasi", { exact: true }).check());
  await page.getByLabel("Putar animasi", { exact: true }).uncheck();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await expect(page.getByRole("button", { name: "Mengetik", exact: true })).toBeVisible();
  await page.screenshot({ path: output + "/lab-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      ready: 4,
      desktop: 1100,
      mobile: 390,
      bodyGenderOutfitPoseZoomGuidesAnimation: true,
      horizontalOverflow: false,
      browserErrors: errors,
    }),
  );
} finally {
  await browser.close();
}
