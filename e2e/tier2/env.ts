/**
 * Tier 2 (live) configuration, read from the environment. Tier 2 runs the real
 * SPA against a real order-gateway + RPC with a real (mnemonic-derived) wallet.
 * It is opt-in: without `E2E_LIVE=1` and the required secrets, every live spec
 * skips, so the suite stays green out of the box.
 *
 * Configure via env vars or an (untracked) `.env.e2e.local` — see
 * `.env.e2e.example`.
 */
interface LiveEnv {
  enabled: boolean;
  gatewayUrl: string;
  rpcUrl: string;
  deployEnv: string;
  chainId: number;
  mnemonic: string;
  accountCount: number;
  /** Opt-in: run the cold-onboarding spec (mints an account NFT per run). */
  onboarding: boolean;
  /** Upper bound (ms) for an on-chain settlement / fill to land on staging. */
  fillTimeoutMs: number;
  /** Opt-in: exercise the Turnkey (enclave-backed) session-key path. */
  turnkey: {
    enabled: boolean;
    orgId: string;
    authProxyUrl: string;
    authProxyConfigId: string;
  };
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const liveEnv: LiveEnv = {
  enabled: process.env.E2E_LIVE === "1" || process.env.E2E_LIVE === "true",
  gatewayUrl: (process.env.E2E_GATEWAY_URL ?? "").replace(/\/$/, ""),
  rpcUrl: process.env.E2E_RPC_URL ?? "https://carrot.megaeth.com/rpc",
  deployEnv: process.env.E2E_DEPLOY_ENV ?? "staging",
  chainId: num(process.env.E2E_CHAIN_ID, 6343),
  mnemonic: process.env.E2E_MNEMONIC ?? "",
  accountCount: num(process.env.E2E_ACCOUNT_COUNT, 4),
  onboarding:
    process.env.E2E_LIVE_ONBOARDING === "1" ||
    process.env.E2E_LIVE_ONBOARDING === "true",
  fillTimeoutMs: num(process.env.E2E_FILL_TIMEOUT_MS, 180_000),
  turnkey: {
    enabled:
      process.env.E2E_TURNKEY_SESSION === "1" ||
      process.env.E2E_TURNKEY_SESSION === "true",
    orgId: process.env.E2E_TURNKEY_ORG_ID ?? "",
    authProxyUrl:
      process.env.E2E_TURNKEY_AUTH_PROXY_URL ?? "https://authproxy.turnkey.com",
    authProxyConfigId: process.env.E2E_TURNKEY_AUTH_PROXY_CONFIG_ID ?? "",
  },
};

/**
 * Whether the Turnkey session-key specs can run. Separate from
 * {@link liveConfigured} so the rest of Tier 2 stays runnable without enclave
 * credentials — the SDK returns a null manager when any of these is missing,
 * which would surface as a confusing "pill not found" rather than a skip.
 */
export function turnkeyConfigured(): { ok: boolean; reason: string } {
  const gate = liveConfigured();
  if (!gate.ok) return gate;
  if (!liveEnv.turnkey.enabled) {
    return { ok: false, reason: "E2E_TURNKEY_SESSION is not set" };
  }
  if (!liveEnv.turnkey.orgId) {
    return { ok: false, reason: "E2E_TURNKEY_ORG_ID is not set" };
  }
  if (!liveEnv.turnkey.authProxyConfigId) {
    return { ok: false, reason: "E2E_TURNKEY_AUTH_PROXY_CONFIG_ID is not set" };
  }
  return { ok: true, reason: "" };
}

/** Whether the live tier has everything it needs to run. */
export function liveConfigured(): { ok: boolean; reason: string } {
  if (!liveEnv.enabled) return { ok: false, reason: "E2E_LIVE is not set" };
  if (!liveEnv.gatewayUrl) {
    return { ok: false, reason: "E2E_GATEWAY_URL is not set" };
  }
  if (!liveEnv.mnemonic) {
    return { ok: false, reason: "E2E_MNEMONIC is not set" };
  }
  return { ok: true, reason: "" };
}
