/**
 * Contract addresses + ABI fragments the SDK touches on-chain, used by the
 * mock JSON-RPC layer (mockChain.ts).
 *
 * The app resolves its address set from `@liq/core` at runtime. Because that
 * resolution reads `globalThis.process.env.DEPLOY_ENV` (absent in the browser),
 * the running SPA actually falls back to the *production* address set — but to
 * stay robust against either resolution we register BOTH the production and the
 * staging addresses for every logical contract and dispatch eth_call by
 * (logical-contract, function-selector). Match is case-insensitive.
 *
 * @remarks
 * This table is a hand-kept duplicate of `@liqpro/liq-core`'s per-version chain
 * config (`src/chain.ts`, `chains[6343]`), not an import of it — so it goes
 * stale silently whenever the staging contour is redeployed and the SDK is
 * bumped to match. A stale `staging` address here doesn't error: `classify()`
 * falls through to `"unknown"`, and the mock's ERC-20 `balanceOf` branch
 * answers a plausible-looking `1_000_000 * 10^18`. For `PerpsAccountProxy`
 * that number becomes the account count fed into
 * `Array.from({ length: n })`, which throws — poisoning `useAccountQuery`
 * forever and stranding the UI on "Loading account…" with a clean console
 * (the query keeps retrying, not erroring visibly). Re-sync every address
 * below against the target SDK version's `staging` block whenever bumping
 * `@liqpro/liq-*`.
 */
import type { Abi } from "viem";

const lower = (a: string) => a.toLowerCase();

/** prod + staging addresses per logical contract (chainId 6343). */
export const ADDR = {
  perpsMarketProxy: [
    "0x330E5A387DFD403a71A81A368eC649b7c1be3AC9", // production
    "0x60A9D256fdF5E60FcbA26cc85A51c075e9B7336B", // staging (post 2026-08-25 contour redeploy)
  ].map(lower),
  perpsAccountProxy: [
    "0xE5718c35497c1A902abE2Cf5353EF42F4b23F4D6", // production
    "0x2415A99a50C975AcF2FE70417A073747bf87435A", // staging (post 2026-08-25 contour redeploy)
  ].map(lower),
  trustedMulticallForwarder: ["0xE2C5658cC5C448B48141168f3e475dF8f65A1e3e"].map(
    lower,
  ),
  usdc: [
    "0x7E58474Fd67c921F85592C2131A25e55f38A5715", // production
    "0x9e2084633fFCF9f84E2863196423F1D5755906C3", // staging (post 2026-08-25 contour redeploy)
  ].map(lower),
  susdc: [
    "0x371503C5851E271456FBDFDfe93169Ade2D55b61", // production
    "0xD07B0387f27D409ECbf9be3E89477B719d1108A2", // staging (post 2026-08-25 contour redeploy)
  ].map(lower),
} as const;

/** Canonical Multicall3 (same on every chain; in the app's chain config). */
const MULTICALL3 = lower("0xcA11bde05977b3631167028862bE2a173976CA11");

type LogicalContract =
  | "perpsMarketProxy"
  | "perpsAccountProxy"
  | "trustedMulticallForwarder"
  | "usdc"
  | "susdc"
  | "multicall3"
  | "unknown";

export function classify(address: string): LogicalContract {
  const a = lower(address);
  if (a === MULTICALL3) return "multicall3";
  for (const key of Object.keys(ADDR) as (keyof typeof ADDR)[]) {
    if ((ADDR[key] as readonly string[]).includes(a)) return key;
  }
  return "unknown";
}

/** ERC-721 enumerable reads on the perps account NFT. */
export const accountProxyAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "holder", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const satisfies Abi;

/** Reads + writes the SDK performs against PerpsMarketProxy. */
export const perpsMarketProxyAbi = [
  // --- reads ---
  {
    name: "getAvailableMargin",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "accountId", type: "uint128" }],
    outputs: [{ name: "", type: "int256" }],
  },
  {
    name: "getWithdrawableMargin",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "accountId", type: "uint128" }],
    outputs: [{ name: "", type: "int256" }],
  },
  {
    name: "debt",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "accountId", type: "uint128" }],
    outputs: [{ name: "accountDebt", type: "uint256" }],
  },
  {
    name: "getOrderMode",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "accountId", type: "uint128" }],
    outputs: [{ name: "", type: "bytes16" }],
  },
  {
    name: "canLiquidate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "accountId", type: "uint128" }],
    outputs: [{ name: "", type: "bool" }],
  },
  // The SDK's useEnrichedPositions/getAccountPositionSnapshot (0.42) reads
  // positions through these two, not the per-market getOpenPosition below —
  // that older read is unused by the app now but kept for ABI completeness.
  {
    name: "getAccountFullPositionInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "accountId", type: "uint128" }],
    outputs: [
      {
        name: "detailedPositions",
        type: "tuple[]",
        components: [
          { name: "marketId", type: "uint128" },
          { name: "size", type: "int256" },
          { name: "pnl", type: "int256" },
          { name: "accruedFunding", type: "int256" },
          { name: "chargedInterest", type: "uint256" },
          { name: "currentPrice", type: "uint256" },
          { name: "entryPrice", type: "uint256" },
          { name: "requiredInitialMargin", type: "uint256" },
          { name: "requiredMaintenanceMargin", type: "uint256" },
          { name: "marketName", type: "string" },
          { name: "marketSymbol", type: "string" },
        ],
      },
    ],
  },
  {
    name: "getRequiredMargins",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "accountId", type: "uint128" }],
    outputs: [
      { name: "requiredInitialMargin", type: "uint256" },
      { name: "requiredMaintenanceMargin", type: "uint256" },
      { name: "maxLiquidationReward", type: "uint256" },
    ],
  },
  {
    name: "getOpenPosition",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "accountId", type: "uint128" },
      { name: "marketId", type: "uint128" },
    ],
    outputs: [
      { name: "totalPnl", type: "int256" },
      { name: "accruedFunding", type: "int256" },
      { name: "positionSize", type: "int128" },
    ],
  },
  {
    name: "indexPrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint128" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getOrderFees",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint128" }],
    outputs: [
      { name: "makerFee", type: "uint256" },
      { name: "takerFee", type: "uint256" },
    ],
  },
  {
    name: "skew",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint128" }],
    outputs: [{ name: "", type: "int256" }],
  },
  {
    name: "fillPrice",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "marketId", type: "uint128" },
      { name: "orderSize", type: "int128" },
      { name: "price", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getSettlementRewardCost",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "marketId", type: "uint128" },
      { name: "settlementStrategyId", type: "uint128" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  // --- writes ---
  {
    name: "createAccount",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "accountId", type: "uint128" }],
  },
  {
    name: "createAccount",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "requestedAccountId", type: "uint128" }],
    outputs: [],
  },
  {
    name: "setBookMode",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "accountId", type: "uint128" },
      { name: "enabled", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "modifyCollateral",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "accountId", type: "uint128" },
      { name: "synthMarketId", type: "uint128" },
      { name: "amountDelta", type: "int256" },
    ],
    outputs: [],
  },
  // --- events ---
  {
    name: "AccountCreated",
    type: "event",
    inputs: [
      { name: "accountId", type: "uint128", indexed: true },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const satisfies Abi;

/** Minimal ERC-20 reads/writes that the deposit builder may perform. */
const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const satisfies Abi;

/** Multicall3 aggregate3 — viem batches `multicall()` through this. */
export const multicall3Abi = [
  {
    name: "aggregate3",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
] as const satisfies Abi;

/** Everything except aggregate3 — used to decode/encode individual calls. */
export const combinedAbi = [
  ...accountProxyAbi,
  ...perpsMarketProxyAbi,
  ...erc20Abi,
] as const satisfies Abi;
