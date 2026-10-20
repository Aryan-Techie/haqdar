import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
    // E2E_BROWSER_PATH points at a local Chromium-based browser (for example Edge); without it
    // Playwright uses its bundled Chromium (`npx playwright install chromium`, as CI does).
    launchOptions: process.env.E2E_BROWSER_PATH ? { executablePath: process.env.E2E_BROWSER_PATH } : {},
  },
  webServer: [
    {
      command: "cd ../api && uv run uvicorn app.main:app --port 8000",
      url: "http://localhost:8000/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm run dev -- -p 3000",
      url: "http://localhost:3000",
      env: { API_URL: "http://localhost:8000" },
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
