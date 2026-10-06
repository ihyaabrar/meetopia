import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const baseURL = process.env.UI_CHECK_URL ?? "http://localhost:3000";
const output = "D:/Github/meetopia/.data/avatar-ui";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-gpu"],
  executablePath: process.env.CHROMIUM_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const ctx = await browser.newContext({
  baseURL,
  viewport: { width: 1500, height: 1000 },
  reducedMotion: "no-preference",
});
await ctx.addCookies([{ name: "mt_locale", value: "id", url: baseURL }]);
await ctx.addInitScript(() => {
  sessionStorage.setItem("mt_device_checked", "1");
  sessionStorage.setItem("mt_tips_seen", "1");
  localStorage.setItem(
    "mt_prefs",
    JSON.stringify({ reducedMotion: false, showMinimap: false, showLifeHud: false, micOnJoin: false }),
  );
});
const page = await ctx.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const password = "Avatar-qa-2026!",
  stamp = Date.now();
try {
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill(`avatar-${stamp}@meetopia.invalid`);
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Lanjut", exact: true }).click();
  await expect(page.locator(".avatar-pedestal canvas")).toHaveAttribute("data-renderer", "painted", {
    timeout: 30000,
  });
  await page.getByRole("radio", { name: "Pria", exact: true }).click();
  await page.getByLabel("Nama tampilan").fill("Raka");
  await page.screenshot({ path: `${output}/creator-male.png`, fullPage: true });
  const select = page.getByLabel("Pose & aktivitas", { exact: true }),
    preview = page.locator(".avatar-pedestal canvas");
  // A short skin bridge below the broad jaw contour must remain visible above the collar.
  const neckCheck = await preview.evaluate((canvas) => {
    const { width: w, height: h } = canvas;
    const pixels = canvas.getContext("2d").getImageData(0, 0, w, h).data;
    const mid = Math.round(w / 2),
      side = Math.round((w / 64) * 2);
    let consecutive = 0,
      longest = 0;
    let chinFound = false;
    for (let y = Math.round(h * 0.4); y < h * 0.62; y++) {
      const j = (y * w + mid) * 4;
      const skin =
        pixels[j] > pixels[j + 1] * 1.1 && pixels[j + 1] > pixels[j + 2] * 1.08 && pixels[j + 3] > 200;
      const dark = (x) => {
        const k = (y * w + x) * 4;
        return pixels[k] < 85 && pixels[k + 1] < 85 && pixels[k + 2] < 85 && pixels[k + 3] > 200;
      };
      if (dark(mid) && dark(mid - side) && dark(mid + side)) chinFound = true;
      consecutive = skin && chinFound ? consecutive + 1 : 0;
      longest = Math.max(longest, consecutive);
    }
    return {
      visible: longest >= w / 64,
      longest,
      chinFound,
      scale: w / 64,
      rows: Array.from({ length: Math.ceil(h * 0.22) }, (_, i) => {
        const y = Math.round(h * 0.4) + i,
          j = (y * w + mid) * 4;
        return {
          y,
          rgb: [...pixels.subarray(j, j + 3)],
          edges: [-side, side].map((dx) => [
            ...pixels.subarray((y * w + mid + dx) * 4, (y * w + mid + dx) * 4 + 3),
          ]),
        };
      }),
    };
  });
  const visibleNeck = neckCheck.visible;
  if (!visibleNeck) console.log(JSON.stringify({ neckCheck }));
  expect(visibleNeck).toBe(true);
  const actions = await select
    .locator("option")
    .evaluateAll((opts) => opts.map((o) => ({ value: o.value, label: o.textContent })));
  expect(actions.length).toBe(44);
  const moving = [];
  for (const { value } of actions) {
    await select.selectOption(value);
    await page.waitForTimeout(40);
    const first = await preview.evaluate((c) => c.toDataURL());
    let changed = false;
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(125);
      if (first !== (await preview.evaluate((c) => c.toDataURL()))) {
        changed = true;
        break;
      }
    }
    if (!changed) throw new Error(`Frozen animation: ${value}`);
    moving.push(value);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  const portraits = [];
  for (const { value, label } of actions) {
    await select.selectOption(value);
    await page.waitForTimeout(35);
    portraits.push({ value, label, png: await preview.evaluate((c) => c.toDataURL()) });
  }
  const still = await preview.evaluate((c) => c.toDataURL());
  await page.waitForTimeout(250);
  expect(await preview.evaluate((c) => c.toDataURL())).toBe(still);
  await page.evaluate((items) => {
    const board = document.createElement("div");
    board.id = "qa-avatar-board";
    board.style.cssText =
      "position:absolute;z-index:999999;left:0;top:0;display:grid;grid-template-columns:repeat(8,150px);background:#102523;padding:20px;gap:8px;color:#f4eee4;font:12px sans-serif";
    for (const item of items) {
      const cell = document.createElement("div");
      cell.style.cssText = "background:#193330;border-radius:8px;text-align:center;padding:6px";
      const img = document.createElement("img");
      img.src = item.png;
      img.width = 138;
      img.height = 138;
      cell.append(img, document.createTextNode(item.label));
      board.append(cell);
    }
    document.body.append(board);
  }, portraits);
  await page.locator("#qa-avatar-board img").evaluateAll((imgs) => Promise.all(imgs.map((i) => i.decode())));
  await page.locator("#qa-avatar-board").screenshot({ path: `${output}/animation-library.png` });
  await page.evaluate(() => {
    const board = document.querySelector("#qa-avatar-board");
    [...board.children].slice(3).forEach((cell) => cell.remove());
    board.style.gridTemplateColumns = "repeat(3, 220px)";
    board.querySelectorAll("img").forEach((img) => {
      img.width = 208;
      img.height = 208;
    });
  });
  await page.locator("#qa-avatar-board").screenshot({ path: `${output}/clothing-idle-walk-run.png` });
  await page.evaluate(() => document.querySelector("#qa-avatar-board").remove());
  await select.selectOption("idle");
  await page.getByRole("radio", { name: "Wanita", exact: true }).click();
  await page.screenshot({ path: `${output}/creator-female.png`, fullPage: true });
  await page.getByRole("button", { name: "Masuk ke Meetopia", exact: true }).click();
  await page.waitForURL("**/app");
  const tip = page.getByRole("button", { name: "Mengerti!" });
  if (await tip.isVisible()) await tip.click();
  const response = await ctx.request.post("/api/groups", {
    data: { name: `Avatar QA ${stamp}`, template: "office" },
  });
  expect(response.ok()).toBe(true);
  const { id: group } = await response.json();
  await page.goto(`/app?g=${group}`);
  await page.waitForFunction(
    () => window.__meetopia?.room.snapshot.conn === "open" && window.__meetopia.room.self?.id,
    { timeout: 30000 },
  );
  const id = await page.evaluate(() => window.__meetopia.room.self.id);
  const invite = await (await ctx.request.post(`/api/groups/${group}/invites`, { data: {} })).json();
  const ctxB = await browser.newContext({
    baseURL,
    viewport: { width: 1400, height: 960 },
    reducedMotion: "reduce",
  });
  await ctxB.addInitScript(() => {
    sessionStorage.setItem("mt_device_checked", "1");
    localStorage.setItem(
      "mt_prefs",
      JSON.stringify({ reducedMotion: true, micOnJoin: false, showLifeHud: false }),
    );
  });
  const account = await ctxB.request.post("/api/auth/register", {
    data: {
      email: `avatar-peer-${stamp}@meetopia.invalid`,
      password,
      name: "Dito",
      avatar: { gender: "male", hair: "short", outfit: "hoodie" },
      locale: "id",
    },
  });
  expect(account.ok()).toBe(true);
  const joined = await ctxB.request.post("/api/invites/join", { data: { code: invite.invite.code } });
  expect(joined.ok()).toBe(true);
  const peer = await ctxB.newPage();
  peer.on("pageerror", (e) => errors.push(e.message));
  await peer.goto(`/app?g=${group}`);
  await peer.waitForFunction(
    () => window.__meetopia?.room.snapshot.conn === "open" && window.__meetopia.room.self?.id,
    { timeout: 30000 },
  );
  await page.waitForFunction(() => window.__meetopia?.room.snapshot.peers.size === 2);
  await page
    .locator(".dock-btn")
    .filter({ has: page.locator("svg") })
    .count();
  await page.getByRole("button", { name: "Reaksi", exact: true }).click();
  await page.getByRole("button", { name: "Kerja", exact: true }).click();
  await page.locator('[data-action="type"]').click();
  await peer.waitForFunction(
    (uid) => window.__meetopia.room.snapshot.peers.get(uid)?.avatarAction === "type",
    id,
  );
  await page.screenshot({ path: `${output}/live-actions.png`, fullPage: true });
  await page.getByRole("button", { name: "Kondisi", exact: true }).click();
  await page.locator('[data-action="dizzy"]').click();
  await peer.waitForFunction(
    (uid) => window.__meetopia.room.snapshot.peers.get(uid)?.avatarAction === "dizzy",
    id,
  );
  const presence = await peer.evaluate((uid) => window.__meetopia.room.snapshot.peers.get(uid), id);
  expect("life" in presence).toBe(false);
  expect("needs" in presence).toBe(false);
  await page.keyboard.press("Escape");
  await page.locator("canvas.map").focus();
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("ArrowDown");
  await peer.waitForFunction((uid) => {
    const p = window.__meetopia.room.snapshot.peers.get(uid);
    return p?.dir === "down-right" && p.avatarAction === "idle";
  }, id);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("ArrowRight");
  await page.setViewportSize({ width: 390, height: 844 });
  if (!(await page.locator(".avatar-live-actions").isVisible()))
    await page.getByRole("button", { name: "Reaksi", exact: true }).click();
  await expect(page.locator(".avatar-live-actions")).toBeVisible();
  await page.screenshot({ path: `${output}/actions-mobile.png`, fullPage: true });
  const box = await page.locator(".avatar-action-pop").boundingBox();
  expect(box.x >= 0 && box.x + box.width <= 391).toBe(true);
  const clipped = await page.locator(".avatar-action-pop button").evaluateAll((buttons) =>
    buttons
      .filter((b) => {
        const rect = b.getBoundingClientRect();
        return (
          rect.left < 0 ||
          rect.right > innerWidth ||
          b.scrollWidth > b.clientWidth + 1 ||
          b.scrollHeight > b.clientHeight + 1
        );
      })
      .map((b) => b.textContent),
  );
  expect(clipped).toEqual([]);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    JSON.stringify({
      ok: true,
      animatedActions: moving.length,
      visibleNeck,
      reducedMotion: true,
      peerActionSync: true,
      liveDiagonalDirection: true,
      privateNeedsNotPublished: true,
      screenshots: output,
    }),
  );
} finally {
  await browser.close();
}
