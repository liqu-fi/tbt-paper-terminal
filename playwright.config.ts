import { defineConfig, devices } from "@playwright/test";

/**
 * Tier 1 — hermetic e2e. The dev server is launched with fixed fake gateway /
 * RPC origins so the in-process mocks (see e2e/support/*) capture every request;
 * no secrets, no live backend, runnable in CI. Tier 2 (live staging) has its own
 * config at e2e/tier2/playwright.live.config.ts and is opt-in via E2E_LIVE.
 */
// Overridable via E2E_PORT: with a fixed port + `reuseExistingServer`, a stray
// dev server from a sibling app (e.g. another vite on 5173) gets silently
// reused and the whole suite runs against the wrong app. An override lets a
// polluted default be sidestepped without editing this file.
const PORT = Number(process.env.E2E_PORT) || 5173;

// Inline env wins over any inherited process.env in Vite's loadEnv, so these
// origins are deterministic regardless of the surrounding shell / CI.
const E2E_ENV = [
  "VITE_GATEWAY_URL=https://gateway.e2e.local/v1",
  "VITE_RPC_URL=https://rpc.e2e.local",
  "VITE_DEPLOY_ENV=staging",
  "VITE_CHAIN_ID=6343",
  "VITE_WALLETCONNECT_PROJECT_ID=",
  // Единственная дверь продукта — Turnkey; hermetic-тесты входят кошельком,
  // который ставит e2e/support/injectedWallet.ts (см. src/config/env.ts).
  "VITE_E2E_WALLET=true",
].join(" ");

export default defineConfig({
  testDir: "./e2e/tier1",
  // Warm Vite's dep-optimize once before the parallel workers start, so the
  // one-time cost doesn't slow (and flake) the opening test wave. See the file.
  globalSetup: "./e2e/support/globalSetup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Pins the browser's local clock to UTC so locale-formatted timestamps
    // (e.g. the trades tape's fmtTapeTime, and Ф3's history tables) assert
    // exact values without depending on the machine/CI runner's TZ.
    timezoneId: "UTC",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `${E2E_ENV} pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
