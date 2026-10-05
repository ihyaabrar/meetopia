/**
 * Smoke test terhadap situs yang sudah dideploy (tanpa server lokal).
 *   LIVE_URL=https://meetopia-two.vercel.app npm run test:live
 * Membuat akun & grup tes lalu menghapusnya kembali.
 * Harus dijalankan dari jaringan yang meneruskan WebSocket (proxy sandbox cloud tidak).
 */
import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...base,
  testDir: "tests/live",
  timeout: 180_000,
  use: { ...base.use, baseURL: process.env.LIVE_URL ?? "https://meetopia-two.vercel.app" },
  webServer: undefined,
});
