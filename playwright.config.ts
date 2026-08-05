import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/playwright/report", open: "never" }],
  ],
  outputDir: "output/playwright/test-results",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 1100 },
  },
  projects: [
    {
      name: "remote-safe",
      testMatch: /remote\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.PLAYWRIGHT_REMOTE_BASE_URL ?? "http://127.0.0.1:3000",
      },
    },
    {
      name: "local-wallet",
      testMatch: /local\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.PLAYWRIGHT_LOCAL_BASE_URL ?? "http://127.0.0.1:3001",
      },
    },
    {
      name: "local-personas",
      testMatch: /personas\/.*\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1100 },
        baseURL: process.env.PLAYWRIGHT_PERSONA_BASE_URL ?? "http://127.0.0.1:3002",
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    },
  ],
})
