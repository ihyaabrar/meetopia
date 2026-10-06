/**
 * Uji multi-instance: pengguna A di instance 1 (Next + real-time), pengguna B di instance real-time 2.
 * Keduanya hanya terhubung lewat Redis pub/sub dan PostgreSQL. Butuh DATABASE_URL dan REDIS_URL.
 *   DATABASE_URL=postgres://... REDIS_URL=redis://... npm run test:e2e:multi
 */
import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

const env = {
  NODE_ENV: "development",
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  REDIS_URL: process.env.REDIS_URL ?? "",
  APP_URL: "http://localhost:3100",
  REGISTER_PER_HOUR: "1000",
};

process.env.E2E_RT_URL_B = "ws://localhost:3101";

export default defineConfig({
  ...base,
  webServer: [
    {
      command: "tsx server.ts",
      url: "http://localhost:3100",
      timeout: 120_000,
      env: { ...env, PORT: "3100" },
    },
    {
      command: "tsx src/realtime/standalone.ts",
      url: "http://localhost:3101/health",
      timeout: 60_000,
      env: { ...env, PORT: "3101" },
    },
  ],
});
