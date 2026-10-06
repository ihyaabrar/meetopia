import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

// Code-native geometry guides for the illustration artist. These are NOT final assets.
const bundle = await build({
  stdin: {
    contents: `import {renderWorld} from './src/client/art/world'; import {buildTemplate} from './src/shared/templates'; window.renderGuide = (id) => { const w = renderWorld(buildTemplate(id), k => k, {illustration:false}); const ctx = w.floor.getContext('2d'); for (const s of w.sprites) ctx.drawImage(s.canvas,s.x,s.y); return w.floor.toDataURL('image/png'); };`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
});
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await mkdir(".data/map-guides", { recursive: true });
  for (const id of ["office", "home", "gaming", "studio", "rooftop"]) {
    const data = await page.evaluate((id) => window.renderGuide(id), id);
    await writeFile(`.data/map-guides/${id}.png`, Buffer.from(data.split(",")[1], "base64"));
  }
} finally {
  await browser.close();
}
