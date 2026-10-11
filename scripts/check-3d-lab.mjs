import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "D:/Github/meetopia/.data/3d-master";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [],
    failedRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => {
    if (!r.url().includes("fonts.googleapis") && !r.url().includes("fonts.gstatic"))
      failedRequests.push(`${r.method()} ${r.url()} ${r.failure()?.errorText}`);
  });
  await page.goto((process.env.UI_CHECK_URL ?? "http://localhost:3000") + "/3d-lab");
  const stage = page.getByLabel("Ruang 3D interaktif", { exact: true }),
    diagnostic = page.getByLabel("Diagnostik renderer");
  async function rendered() {
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  }
  await expect(stage).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await expect(diagnostic).toHaveAttribute("data-phase", "idle");
  await page.screenshot({ path: output + "/desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Mengetik", exact: true }).click();
  await expect(diagnostic).toHaveAttribute("data-phase", "typing", { timeout: 20000 });
  for (const view of ["Depan", "Belakang", "Kiri", "Kanan"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    await expect(page.getByRole("button", { name: view, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await rendered();
    await page.screenshot({ path: `${output}/hoodie-${view.toLowerCase()}.png` });
  }
  await page.getByRole("button", { name: /Jaket & kacamata/ }).click();
  await rendered();
  await page.screenshot({ path: output + "/jacket-side.png" });
  await page.getByRole("button", { name: "Belakang", exact: true }).click();
  await rendered();
  await page.screenshot({ path: output + "/jacket-back.png" });
  await page.getByRole("button", { name: /Rambut bob/ }).click();
  await page.getByRole("button", { name: "Depan", exact: true }).click();
  await rendered();
  await page.screenshot({ path: output + "/bob-front.png" });
  await page.getByRole("checkbox", { name: /Isolasi avatar/ }).check();
  await page.getByRole("checkbox", { name: /Kurangi gerak/ }).check();
  for (const look of [/Hoodie/, /Jaket & kacamata/, /Rambut bob/]) {
    await page.getByRole("button", { name: look }).click();
    for (const side of ["Depan", "Belakang", "Kanan"]) {
      await page.getByRole("button", { name: side, exact: true }).click();
      await rendered();
      await page.screenshot({
        path: `${output}/isolated-${look.source.replaceAll(/[^a-zA-Z]/g, "")}-${side}.png`,
      });
    }
  }
  const originalOrbit = await stage.screenshot();
  const bounds = await stage.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 100, bounds.y + bounds.height / 2 + 20, { steps: 12 });
  await page.mouse.up();
  await rendered();
  expect(Buffer.compare(originalOrbit, await stage.screenshot())).not.toBe(0);
  await page.getByRole("checkbox", { name: /Isolasi avatar/ }).uncheck();
  for (const degrees of [90, 180, 270, 0]) {
    await page.getByLabel("Arah workstation").selectOption(String(degrees));
    await expect(diagnostic).toHaveAttribute("data-phase", "idle");
    await page.getByRole("button", { name: "Duduk", exact: true }).click();
    await expect(diagnostic).toHaveAttribute("data-phase", "seated", { timeout: 20000 });
    await expect
      .poll(async () => Number(await diagnostic.getAttribute("data-yaw")))
      .toBeCloseTo(degrees > 180 ? -Math.PI / 2 : (degrees * Math.PI) / 180, 1);
    await page.getByRole("button", { name: "Berdiri", exact: true }).click();
    await expect(diagnostic).toHaveAttribute("data-phase", "idle", { timeout: 10000 });
  }
  await stage.focus();
  const before = Number(await diagnostic.getAttribute("data-x"));
  await page.keyboard.down("a");
  await expect.poll(async () => Number(await diagnostic.getAttribute("data-x"))).toBeLessThan(before - 0.07);
  await page.keyboard.up("a");
  await page.getByRole("checkbox", { name: /Titik kontak & grid/ }).check();
  await page.getByRole("checkbox", { name: /Kurangi gerak/ }).check();
  await page.getByRole("button", { name: "Diorama", exact: true }).click();
  await page.getByRole("button", { name: "Reset pose & posisi", exact: false }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await expect(stage).toBeVisible();
  await page.screenshot({ path: output + "/mobile.png", fullPage: true });
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
  console.log(
    JSON.stringify({
      ready: true,
      fourSeatRotations: true,
      walkSitTypeStand: true,
      keyboardMovement: true,
      cameraViews: 5,
      looks: 3,
      mobileOverflow: false,
      browserErrors: errors,
      failedRequests,
      renderer: await diagnostic.textContent(),
      output,
    }),
  );
} finally {
  await browser.close();
}
