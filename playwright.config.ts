import { defineConfig } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    },
    permissions: ["microphone", "camera"],
    viewport: { width: 1360, height: 860 },
  },
  webServer: {
    command: `tsx server.ts`,
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      PGLITE_DIR: "memory://",
      NODE_ENV: "development",
      APP_URL: `http://localhost:${PORT}`,
      REGISTER_PER_HOUR: "1000",
    },
  },
});
