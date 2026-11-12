import { defineConfig } from "@playwright/test";

const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
  : {};

export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 15_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: "http://127.0.0.1:4179",
    browserName: "chromium",
    launchOptions,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node src/server.mjs",
    url: "http://127.0.0.1:4179/api/status",
    reuseExistingServer: false,
    timeout: 15_000,
    env: {
      PORT: "4179",
      PAYMENTS_ENABLED: "false",
      FACILITATOR_SETTLEMENT_ENABLED: "false",
    },
  },
});
