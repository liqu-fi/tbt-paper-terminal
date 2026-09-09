# End-to-end tests

Two tiers of Playwright e2e, mirroring the patterns in the sibling `kwenta`
app (injected viem wallet, Page Objects keyed on `data-testid`, the
connect → create-account → SIWE → trade lifecycle).

## Tier 1 — hermetic (default, CI)

`pnpm test:e2e`

Fully self-contained: no secrets, no live backend, deterministic, runs in CI.
The Playwright config (`playwright.config.ts`) launches the dev server with fixed
fake origins (`gateway.e2e.local`, `rpc.e2e.local`) and `VITE_E2E_WALLET=true` —
the product's only login is Turnkey, which cannot be mocked hermetically, so
that build-time constant swaps the single wagmi connector for `injected()` and
shows a plain Connect button (`src/config/env.ts`). Every request is intercepted
in-process:

- **`support/injectedWallet.ts`** — an EIP-1193 `window.ethereum` that signs with
  canned signatures and turns sends into world mutations + receipts.
- **`support/mockChain.ts` + `chain.ts`** — a viem-encoded JSON-RPC endpoint that
  answers `eth_call` (including Multicall3 `aggregate3` batches) and serves
  receipts, driven by a mutable **`MockWorld`** (`support/world.ts`).
- **`support/mockGateway.ts`** — the order-gateway REST + SSE, also driven by the
  world. Responses are bare shapes (the SDK parser returns `json.data ?? json`).

A test picks a scenario by seeding the world before navigating:

```ts
import { enterTerminal } from "../pages/flows";
const { trade, userInfo } = await enterTerminal(page, world, () =>
  readyWorld({ openOrders: [limitOrderFixture()] }),
);
```

Coverage (`tier1/`): boot + onboarding, market data, deposit/withdraw, market /
limit / conditional orders, form gating, positions, open orders + cancel,
history, live SSE updates, error states, disconnect, session keys (1-click).

### Session keys in Tier 1

`16-session-keys` (grant lifecycle) and `17-session-trading` (1-click) run
against the SDK's **wallet-signed** `SessionKeyManager`, not Turnkey: with
`VITE_TURNKEY_SESSION` unset the SDK still returns a working manager, so the
whole flow — grant, persistence, revoke, expiry, order signing — is hermetic.
The grant is registered through four mock-gateway routes (`/session-keys/nonce`,
`POST|GET /session-keys`, `DELETE /session-keys/:id`) backed by `world.sessionKeys`.

Who signed an order is asserted two ways, because either alone is ambiguous:
`world.signRequests` must gain no `eth_signTypedData_v4`, **and** the submitted
signature must differ from `WALLET_DUMMY_SIG` (the injected wallet's canned
value). The enclave path is Tier 2 only — see `live-session-keys.live.spec.ts`.

## Tier 2 — live (opt-in)

`pnpm test:e2e:live`

The real SPA against a real order-gateway + RPC, with a real (mnemonic-derived)
wallet doing real SIWE + EIP-712 signing and on-chain transactions — the
highest-fidelity check. **Skips entirely (green) unless configured**, so it never
blocks the default run or CI.

To run it, copy `../.env.e2e.example` to `.env.e2e.local`, fill in the gateway URL
+ a **funded testnet** mnemonic, export the vars, then run the live config:

```bash
set -a; . ./.env.e2e.local; set +a
pnpm test:e2e:live
```

Tier 2 reuses the same Page Objects as Tier 1; only the wallet + backend differ
(`tier2/liveWallet.ts`, `tier2/ensureTradeReady.ts`). Live fills can be slow on
staging — timeouts are governed by `E2E_FILL_TIMEOUT_MS`.
