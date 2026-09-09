import { getChainConfig } from "@liq/sdk";
import { useLiqOnchain, useNetworkId, useWallet } from "@liq/react";
import { usdcToWad } from "@liq/core";
import { useQuery } from "@tanstack/react-query";


/**
 * Wallet USDC balance — the token a perps deposit actually spends — read in its
 * native 6 decimals and lifted to the 18-dec WAD domain the money UI formats in
 * (see {@link usdcToWad}).
 *
 * The deposit dialog must gate, cap (Max), and validate against this balance,
 * NOT the sUSDC balance from `useBalancesQuery`: `useDepositMutation` runs the
 * `DepositBuilder.usdc(amount)` path, which spends wallet USDC and wraps it to
 * sUSDC. A fresh faucet user holds USDC and zero sUSDC, so gating on sUSDC
 * shows a $0.00 balance and blocks every deposit.
 *
 * Best-effort: the SDK's `erc20BalanceAndAllowance` never throws (a failed read
 * defaults to 0n), so on an unknown/unmocked chain the query simply resolves to
 * 0n and the dialog renders no Max / no cap rather than crashing.
 */
export function useUsdcBalanceWad() {
  const wallet = useWallet();
  const networkId = useNetworkId();
  const onchain = useLiqOnchain();

  return useQuery({
    queryKey: ["usdc-balance-wad", networkId, wallet],
    queryFn: async () => {
      if (!wallet) throw new Error("Wallet required");
      const usdc = getChainConfig(networkId).contracts.USDC;
      const { balance } = await onchain.collateral.erc20BalanceAndAllowance(
        usdc,
        wallet,
      );
      return usdcToWad(balance);
    },
    enabled: Boolean(wallet),
    refetchInterval: 30_000,
  });
}
