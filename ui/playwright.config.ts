import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // serial — tests share a real DB
  retries: 0,
  use: {
    baseURL: "http://localhost:5174",
    headless: true,
  },
  webServer: {
    command: "npm run dev -- --port 5174",
    url: "http://localhost:5174",
    reuseExistingServer: true,
  },
})
