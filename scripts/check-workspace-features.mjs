import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const baseURL = process.env.UI_CHECK_URL ?? "http://localhost:3000",
  output = "D:/Github/meetopia/.data/layered-world";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const contexts = [],
  errors = [];
const stamp = Date.now();
let activePage;
// Dev route compilation can be slow on the owner's machine; keep API limits explicit.
const qaHttp = (ctx) =>
  Object.fromEntries(
    ["get", "post", "patch", "delete"].map((method) => [
      method,
      (url, options = {}) => ctx.request[method](url, { timeout: 90_000, ...options }),
    ]),
  );
async function account(name) {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 980 } });
  contexts.push(ctx);
  ctx.setDefaultTimeout(90_000);
  await ctx.addInitScript(() => {
    sessionStorage.setItem("mt_device_checked", "1");
    localStorage.setItem("mt_tips_seen", "1");
    localStorage.setItem("mt_prefs", JSON.stringify({ micOnJoin: false, showLifeHud: false }));
  });
  await ctx.addCookies([{ name: "mt_locale", value: "id", url: baseURL }]);
  const r = await ctx.request.post("/api/auth/register", {
    data: {
      email: `layered-${name}-${stamp}@meetopia.invalid`,
      password: "Layered-qa-2026!",
      name,
      locale: "id",
      avatar: {
        gender: name === "Raka" ? "male" : "female",
        hair: "spiky",
        hairColor: "#257fc6",
        outfit: "jacket",
        bodyColor: "#168f79",
      },
    },
  });
  expect(r.ok()).toBe(true);
  return ctx;
}
async function open(ctx, group) {
  const page = await ctx.newPage();
  page.setDefaultTimeout(90_000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/app?g=" + group);
  await page.waitForFunction(
    () => window.__meetopia?.room.snapshot.conn === "open" && window.__meetopia.room.self?.id,
  );
  return page;
}
try {
  const a = await account("Raka"),
    b = await account("Nadia");
  const httpA = qaHttp(a),
    httpB = qaHttp(b);
  const group = await (
    await httpA.post("/api/groups", { data: { name: "Layered QA " + stamp, template: "office" } })
  ).json();
  const id = group.id;
  const invite = await (await httpA.post(`/api/groups/${id}/invites`, { data: {} })).json();
  expect((await httpB.post("/api/invites/join", { data: { code: invite.invite.code } })).ok()).toBe(true);
  const page = await open(a, id),
    peer = await open(b, id);
  activePage = page;
  await page.waitForFunction(() => window.__meetopia.room.snapshot.peers.size === 2);
  const pid = await peer.evaluate(() => window.__meetopia.room.self.id);
  const initial = await page.evaluate(() => window.__meetopia.room.self.avatar);
  await page.reload();
  await page.waitForFunction(() => window.__meetopia?.room.snapshot.conn === "open");
  expect(await page.evaluate(() => window.__meetopia.room.self.avatar)).toEqual(initial);
  const state = await (await httpA.get(`/api/groups/${id}/map`)).json();
  const chair = state.map.objects.find((o) => o.kind === "chair" && !o.facing);
  const sit = async (p) =>
    p.evaluate((o) => {
      const room = window.__meetopia.room;
      room.updateSelf({ x: o.x + 0.5, y: o.y + 0.6, dir: "down", moving: false });
      room.send({ t: "move", x: o.x + 0.5, y: o.y + 0.6, dir: "down", moving: false });
      room.send({ t: "sit", sitting: true, objectId: o.id });
    }, chair);
  await sit(page);
  await page.waitForFunction(
    (cid) => window.__meetopia.room.self.sitting && window.__meetopia.room.self.seatId === cid,
    chair.id,
  );
  expect(await page.evaluate(() => window.__meetopia.room.self.dir)).toBe("up");
  await peer.evaluate(() => window.__meetopia.room.on("error", (e) => (window.seatError = e)));
  await sit(peer);
  await peer.waitForFunction(() => window.seatError === "seatOccupied");
  expect(await peer.evaluate(() => window.__meetopia.room.self.sitting)).toBe(false);
  await page.screenshot({ path: output + "/live-seated.png", fullPage: true });
  await page.evaluate(() => window.__meetopia.room.send({ t: "sit", sitting: false }));
  await page.waitForFunction(() => !window.__meetopia.room.self.sitting);
  for (const [p, x] of [
    [page, 14.5],
    [peer, 15.4],
  ])
    await p.evaluate((x) => {
      const r = window.__meetopia.room;
      r.updateSelf({ x, y: 18.5, dir: "down", moving: false });
      r.send({ t: "move", x, y: 18.5, dir: "down", moving: false });
    }, x);
  await page.waitForFunction((pid) => {
    const r = window.__meetopia.room,
      p = r.snapshot.peers.get(pid);
    return p && !p.sitting && Math.abs(p.x - 15.4) < 0.01 && Math.abs(p.y - 18.5) < 0.01;
  }, pid);
  await peer.waitForFunction(() => {
    const r = window.__meetopia.room;
    return [...r.snapshot.peers.values()].some(
      (p) => p.id !== r.self.id && !p.sitting && Math.abs(p.x - 14.5) < 0.01 && Math.abs(p.y - 18.5) < 0.01,
    );
  });
  await peer.evaluate(() => window.__meetopia.room.on("pairInvite", (r) => (window.pairRequest = r)));
  await page.evaluate(() => window.__meetopia.room.on("pairResult", (r) => (window.pairResult = r)));
  for (const action of ["handshake", "high-five", "fist-bump"]) {
    console.log("Paired gesture:", action);
    await peer.evaluate(() => (window.pairRequest = null));
    await page.evaluate(() => (window.pairResult = null));
    await page.evaluate(
      ({ pid, action }) => window.__meetopia.room.send({ t: "pairInvite", toUserId: pid, action }),
      { pid, action },
    );
    await expect
      .poll(
        async () => {
          const result = await page.evaluate(() => window.pairResult);
          if (result && !result.accepted) throw new Error("Pair invite rejected: " + JSON.stringify(result));
          return await peer.evaluate(() => !!window.pairRequest);
        },
        { timeout: 30_000 },
      )
      .toBe(true);
    await peer.evaluate(() =>
      window.__meetopia.room.send({ t: "pairReply", requestId: window.pairRequest.requestId, accept: true }),
    );
    await page.waitForFunction(() => window.__meetopia.room.self.pairedAction);
    await peer.waitForFunction(() => window.__meetopia.room.self.pairedAction);
    const pa = await page.evaluate(() => window.__meetopia.room.self),
      pb = await peer.evaluate(() => window.__meetopia.room.self);
    expect(pa.pairedAction.startedAt).toBe(pb.pairedAction.startedAt);
    expect(pa.dir).toBe("right");
    expect(pb.dir).toBe("left");
    await page.screenshot({ path: output + "/pair-" + action + ".png", fullPage: true });
    await page.waitForFunction(() => !window.__meetopia.room.self.pairedAction);
    await peer.waitForFunction(() => !window.__meetopia.room.self.pairedAction);
  }
  for (const body of [
    { kind: "task", title: "Review aset chibi" },
    { kind: "agenda", title: "Design review", startsAt: new Date(Date.now() + 86400000).toISOString() },
    { kind: "resource", title: "Dokumentasi", url: "https://example.com/design" },
  ])
    expect((await httpA.post(`/api/groups/${id}/board`, { data: body })).ok()).toBe(true);
  expect(
    (
      await httpA.post(`/api/groups/${id}/board`, {
        data: { kind: "resource", title: "Unsafe", url: "javascript:alert(1)" },
      })
    ).status(),
  ).toBe(400);
  const upload = await httpA.post(`/api/groups/${id}/files`, {
    multipart: {
      file: { name: "design-notes.txt", mimeType: "text/plain", buffer: Buffer.from("Meetopia layered QA") },
    },
  });
  expect(upload.ok()).toBe(true);
  expect(
    (
      await httpA.post(`/api/groups/${id}/files`, {
        multipart: {
          file: { name: "unsafe.html", mimeType: "text/html", buffer: Buffer.from("<script>bad()</script>") },
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await httpA.post(`/api/groups/${id}/files`, {
        multipart: {
          file: { name: "large.txt", mimeType: "text/plain", buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 65) },
        },
      })
    ).status(),
  ).toBe(413);
  const entries = (await (await httpA.get(`/api/groups/${id}/board`)).json()).entries;
  expect(entries.length).toBe(4);
  const task = entries.find((e) => e.kind === "task");
  expect((await httpB.patch(`/api/groups/${id}/board/${task.id}`, { data: { completed: true } })).ok()).toBe(
    true,
  );
  const file = entries.find((e) => e.kind === "file");
  const download = await httpB.get(`/api/groups/${id}/files/${file.id}`);
  expect(await download.text()).toBe("Meetopia layered QA");
  expect(download.headers()["content-disposition"]).toContain("attachment");
  expect(
    (
      await httpB.patch(`/api/groups/${id}/map`, {
        data: {
          appearance: { ambience: "night", furnitureStyle: "tropical", roomSize: "large" },
          expectedVersion: state.map.version,
        },
      })
    ).status(),
  ).toBe(403);
  const modified = await httpA.patch(`/api/groups/${id}/map`, {
    data: {
      appearance: { ambience: "night", furnitureStyle: "tropical", roomSize: "large" },
      expectedVersion: state.map.version,
    },
  });
  expect(modified.ok()).toBe(true);
  let newer = (await modified.json()).map;
  expect(newer.width).toBeGreaterThan(state.map.width);
  expect(
    (
      await httpA.patch(`/api/groups/${id}/map`, {
        data: { appearance: newer.appearance, expectedVersion: state.map.version },
      })
    ).status(),
  ).toBe(409);
  await page.waitForFunction(() => window.__meetopia.room.snapshot.map.appearance?.ambience === "night");
  await page.reload();
  await page.waitForFunction(() => window.__meetopia?.room.snapshot.map?.appearance?.roomSize === "large");
  expect((await httpA.patch(`/api/groups/${id}`, { data: { template: "home" } })).ok()).toBe(true);
  newer = (await (await httpA.get(`/api/groups/${id}/map`)).json()).map;
  expect(newer.appearance.roomSize).toBe("large");
  expect(newer.width).toBeGreaterThan(48);
  await page.waitForFunction(() => window.__meetopia.room.snapshot.map.template === "home");
  await page.getByRole("button", { name: "Tugas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review aset chibi" })).toBeVisible();
  await page.screenshot({ path: output + "/tasks.png", fullPage: true });
  await page.getByRole("button", { name: "Tutup", exact: true }).click();
  await page.getByRole("button", { name: "File", exact: true }).click();
  await expect(page.getByRole("heading", { name: "design-notes.txt" })).toBeVisible();
  await page.screenshot({ path: output + "/files.png", fullPage: true });
  await page.getByRole("button", { name: "Tutup", exact: true }).click();
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await page.getByRole("button", { name: "Editor furnitur", exact: true }).click();
  await expect(page.locator(".editor-canvas")).toBeVisible();
  await page.locator(".editor-catalog").getByRole("button", { name: "Kursi", exact: true }).click();
  const firstX = Number(await page.getByLabel("Posisi X", { exact: true }).inputValue());
  await page.locator(".editor-canvas").focus();
  await page.keyboard.press("ArrowRight");
  expect(Number(await page.getByLabel("Posisi X", { exact: true }).inputValue())).toBe(firstX + 1);
  await page.keyboard.press("r");
  await expect(page.locator(".editor-inspector select")).toHaveValue("right");
  await page.keyboard.press("Delete");
  await expect(page.locator(".editor-inspector")).not.toBeVisible();
  await page.getByRole("button", { name: "Urungkan", exact: true }).click();
  const saveResponse = page.waitForResponse(
    (r) => r.request().method() === "PATCH" && r.url().endsWith(`/api/groups/${id}/map`),
    { timeout: 90_000 },
  );
  await page.getByRole("button", { name: "Simpan tata ruang", exact: true }).click();
  const savedResponse = await saveResponse;
  expect(savedResponse.status()).toBe(200);
  await expect(page.getByText("Tata ruang tersimpan", { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: output + "/editor.png", fullPage: true });
  const final = (await (await httpA.get(`/api/groups/${id}/map`)).json()).map;
  expect(final.objects.length).toBe(newer.objects.length + 1);
  expect(final.customLayout).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".furniture-editor .save-bar").scrollIntoViewIfNeeded();
  const previewBox = await page.locator(".editor-canvas").boundingBox();
  const footerBox = await page.locator(".furniture-editor .save-bar").boundingBox();
  expect(previewBox.y + previewBox.height <= footerBox.y).toBe(true);
  await page.screenshot({ path: output + "/editor-mobile.png", fullPage: true });
  const statusBox = await page.locator(".furniture-editor .save-bar [role=status]").boundingBox();
  for (const btn of await page.locator(".furniture-editor .save-bar button").all()) {
    const box = await btn.boundingBox();
    expect(statusBox.y + statusBox.height <= box.y).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Buka menu", exact: true }).click();
  await page.getByRole("button", { name: "Tugas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review aset chibi" })).toBeVisible();
  await page.screenshot({ path: output + "/tasks-mobile.png", fullPage: true });
  const dialog = page.getByRole("dialog");
  await dialog.locator("button").last().focus();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement.closest("[role=dialog]"))).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      ok: true,
      seatDirection: "up",
      occupiedSeatRejected: true,
      pairedGestures: 3,
      persistedAppearance: true,
      templateRetainsSize: true,
      optimisticVersion: true,
      boardEntries: 4,
      fileDownload: true,
      editorSaved: true,
      editorKeyboard: true,
      mobile: true,
      focusTrap: true,
      profileRetained: true,
      screenshots: output,
    }),
  );
} catch (error) {
  if (activePage) {
    await activePage
      .screenshot({ path: output + "/failure.png", fullPage: true, timeout: 90_000 })
      .catch(() => {});
    console.error((await activePage.locator("body").innerText()).slice(-4500));
  }
  throw error;
} finally {
  await browser.close();
}
