import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const baseURL = process.env.PERF_CHECK_URL ?? "http://localhost:3001";
const output = "D:/Github/meetopia/.data/layered-world";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 980 } });
try {
  await ctx.addCookies([{ name: "mt_locale", value: "id", url: baseURL }]);
  const registered = await ctx.request.post("/api/auth/register", {
    data: {
      email: `visual-perf-${Date.now()}@meetopia.invalid`,
      password: "Visual-perf-2026!",
      name: "Visual QA",
      locale: "id",
      avatar: {},
    },
  });
  expect(registered.ok()).toBe(true);
  const group = await (
    await ctx.request.post("/api/groups", { data: { name: "Visual performance QA", template: "office" } })
  ).json();
  await ctx.addInitScript(() => {
    sessionStorage.setItem("mt_device_checked", "1");
    localStorage.setItem("mt_tips_seen", "1");
    localStorage.setItem("mt_prefs", JSON.stringify({ micOnJoin: false, showLifeHud: false }));
    window.visualQaLoads = [];
    const NativeImage = window.Image;
    window.Image = function (...args) {
      const img = new NativeImage(...args);
      img.addEventListener("load", () =>
        window.visualQaLoads.push({ src: new URL(img.src).pathname, at: performance.now() }),
      );
      return img;
    };
    window.Image.prototype = NativeImage.prototype;
  });
  const page = await ctx.newPage(),
    cdp = await ctx.newCDPSession(page),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  // Reproducible constrained network, not a claim about every real mobile connection.
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 1600000 / 8,
    uploadThroughput: 750000 / 8,
  });
  await page.goto(`/app?g=${group.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await expect(page.locator("canvas.map")).toBeVisible({ timeout: 120000 });
  const mapVisibleMs = await page.evaluate(() => performance.now());
  await page.waitForFunction(
    () =>
      new Set(window.visualQaLoads.filter((r) => r.src.startsWith("/environment/")).map((r) => r.src))
        .size === 5 &&
      new Set(window.visualQaLoads.filter((r) => r.src.startsWith("/avatars/painted/")).map((r) => r.src))
        .size === 7,
    {},
    { timeout: 120000 },
  );
  const report = await page.evaluate(() => ({
    network: { downMbps: 1.6, upMbps: 0.75, latencyMs: 150, cache: "cold" },
    assetReadyMs: Math.round(Math.max(...window.visualQaLoads.map((r) => r.at))),
    loads: window.visualQaLoads.filter((r) => /^\/(environment|avatars\/painted)\//.test(r.src)),
    bytes: performance
      .getEntriesByType("resource")
      .filter((r) => /\/(environment|avatars\/painted)\//.test(r.name))
      .reduce((sum, r) => sum + r.encodedBodySize, 0),
  }));
  report.mapVisibleMs = Math.round(mapVisibleMs);
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await page.screenshot({ path: output + "/production-room.png", fullPage: true });
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
  await page.reload();
  await page.waitForFunction(() => window.visualQaLoads.length >= 12);
  await page.reload();
  await expect(page.locator("canvas.map")).toBeVisible();
  report.warmMapVisibleMs = Math.round(await page.evaluate(() => performance.now()));
  await page.waitForFunction(() => window.visualQaLoads.length >= 12);
  report.warmAssetReadyMs = Math.round(
    await page.evaluate(() => Math.max(...window.visualQaLoads.map((r) => r.at))),
  );
  expect(errors).toEqual([]);
  await writeFile(output + "/performance.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
