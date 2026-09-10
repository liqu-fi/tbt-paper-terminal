import { defineConfig, devices } from "@playwright/test";

import { liveConfigured, liveEnv } from "./env";

/**
 * Tier 2 — live e2e against a real order-gateway + RPC with a real wallet.
 * Opt-in: run with `pnpm test:e2e:live` after setting E2E_LIVE=1 and the creds
 * in `.env.e2e.example` (copy to `.env.e2e.local`, then `source` it or export).
 * Without configuration every spec skips and the run exits green; the dev
 * server is only started when live is configured.
 */
const PORT = 5174;
const configured = liveConfigured().ok;

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.live.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: liveEnv.fillTimeoutMs + 60_000,
  expect: { timeout: 30_000 },
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: configured
    ? {
        command: [
          `VITE_GATEWAY_URL=${liveEnv.gatewayUrl}`,
          `VITE_RPC_URL=${liveEnv.rpcUrl}`,
          `VITE_DEPLOY_ENV=${liveEnv.deployEnv}`,
          "VITE_WALLETCONNECT_PROJECT_ID=",
          // The live tier signs with the mnemonic-derived injected wallet, not
          // the Turnkey door (the product's only one) — see src/config/env.ts.
          "VITE_E2E_WALLET=true",
          // Turnkey stays OFF unless explicitly configured: with the flag on but
          // the org/proxy ids missing the SDK yields a null manager, and the
          // 1-click pill silently disappears for the whole live run.
          `VITE_TURNKEY_SESSION=${liveEnv.turnkey.enabled}`,
          `VITE_TURNKEY_ORG_ID=${liveEnv.turnkey.orgId}`,
          `VITE_TURNKEY_AUTH_PROXY_URL=${liveEnv.turnkey.authProxyUrl}`,
          `VITE_TURNKEY_AUTH_PROXY_CONFIG_ID=${liveEnv.turnkey.authProxyConfigId}`,
          `pnpm exec vite --port ${PORT} --strictPort`,
        ].join(" "),
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        // Cold vite start pre-bundles the wagmi/viem dep graph with an empty
        // `.vite` cache, which can exceed 2 min on first run; 120s was too tight.
        timeout: 240_000,
      }
    : undefined,
});
