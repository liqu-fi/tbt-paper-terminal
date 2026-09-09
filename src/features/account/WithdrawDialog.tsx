import { getChainConfig, Margin } from "@liq/sdk";
import {
  liqQueryKeys,
  useAccountId,
  useAvailableMarginQuery,
  useLiqOnchain,
  useNetworkId,
  useTransactionMutation,
  useWallet,
} from "@liq/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  decodeFunctionData,
  encodeFunctionData,
  type Hex,
  parseAbi,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DecimalInput } from "../../components/ui/DecimalInput";
import { fmtUsd, wadToFixed } from "../../lib/format";

/**
 * Снятие и разворот в одной транзакции — через TrustedMulticallForwarder,
 * тем же `aggregate3`, которым SDK сам батчит `payDebt + modifyCollateral`
 * (RepayBuilder) и `withdraw + unwrap` для LP (LpWithdrawBuilder): оба целевых
 * прокси доверяют форвардеру по ERC-2771, и внутри батча `_msgSender()` —
 * владелец аккаунта. `requireSuccess: true` на каждом вызове: откат любого
 * шага откатывает всё, sUSDC на кошельке не повисает.
 *
 * ABI набраны вручную, потому что `@liq/sdk` не реэкспортирует ни
 * `trustedMulticallForwarderAbi`, ни `spotMarketProxyAbi` из liq-onchain.
 */
const FORWARDER_ABI = parseAbi([
  "function aggregate3((address target, bool requireSuccess, bytes callData)[] calls)",
]);
const PERPS_ABI = parseAbi([
  "function modifyCollateral(uint128 accountId, uint128 collateralId, int256 amountDelta)",
]);
/** sUSDC → USDC на SpotMarketProxy; синт сжигается у msg.sender, approve не нужен. */
const UNWRAP_ABI = parseAbi([
  "function unwrap(uint128 marketId, uint256 unwrapAmount, uint256 minAmountReceived)",
]);
/** WAD (18) → USDC (6): столько же и ждём на выходе, как считает SDK в LpWithdrawBuilder. */
const WAD_TO_USDC = 10n ** 12n;

type ForwarderCall = { target: `0x${string}`; requireSuccess: boolean; callData: Hex };

function parseAmount(amount: string): bigint {
  if (!amount) return 0n;
  try {
    return Margin.parse(amount);
  } catch {
    return 0n;
  }
}

export function WithdrawDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const accountId = useAccountId();
  const onchain = useLiqOnchain();
  const networkId = useNetworkId();
  const wallet = useWallet();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { data: margins } = useAvailableMarginQuery();
  const [amount, setAmount] = useState("");

  // sUSDC collateral lives under the chain's sUSDC synth-market id (staging = 1,
  // prod = 3) — the same id DepositBuilder credits. Hardcoding 0 withdrew from an
  // empty collateral slot and reverted on-chain (#459). Resolved via the SDK
  // chain config (deploy env is wired through process.env.DEPLOY_ENV at build).
  const chain = getChainConfig(networkId);
  const susdcCollateralId = BigInt(chain.susdcMarketId);

  // Synthetix blocks ALL collateral withdrawals while the account carries debt
  // (closed-at-loss); a plain withdraw would revert. Read it so we can offer an
  // atomic repay+withdraw instead. Best-effort: on error/loading the value is
  // `undefined`, which falls through to the normal withdraw path (so debt-free
  // or mocked accounts are unaffected).
  const debtKey = ["liq", "account", "debt", accountId?.toString() ?? ""];
  const { data: debt } = useQuery<bigint>({
    queryKey: debtKey,
    queryFn: () => onchain.collateral.debt(accountId!),
    enabled: open && accountId !== undefined,
    retry: false,
    staleTime: 10_000,
  });
  const hasDebt = debt !== undefined && debt > 0n;

  // Потолок вывода. Без долга — withdrawable (≤ available; ниже при открытых
  // позициях). С долгом протокол отвечает withdrawable = 0, а repay снимает
  // этот запрет в той же транзакции, поэтому потолком служит available; если
  // позиции его не отпустят, откажет сам контракт — ошибка ниже.
  const limit = hasDebt ? margins?.available : margins?.withdrawable;
  const amountWad = parseAmount(amount);
  const exceedsLimit = limit !== undefined && amountWad > limit;
  const invalid = exceedsLimit;

  // Одна транзакция на оба пути: снять sUSDC с аккаунта и тут же развернуть
  // его в USDC — на кошелёк приходит тот же токен, который принимает депозит.
  // С долгом батч строит SDK (`payDebt` снимает запрет на вывод внутри той же
  // транзакции — RepayBuilder.thenWithdraw), а `unwrap` дописывается к нему.
  const withdraw = useTransactionMutation<
    `0x${string}`,
    { accountId: bigint; amountWad: bigint }
  >({
    transactionType: "WITHDRAW",
    mutationFn: async ({ accountId, amountWad }) => {
      if (!walletClient || !publicClient) throw new Error("Wallet not connected");
      const send = (to: `0x${string}`, data: Hex) =>
        walletClient.sendTransaction({
          account: walletClient.account,
          chain: walletClient.chain,
          to,
          data,
        });

      const unwrap: ForwarderCall = {
        target: chain.contracts.SpotMarketProxy,
        requireSuccess: true,
        callData: encodeFunctionData({
          abi: UNWRAP_ABI,
          functionName: "unwrap",
          args: [susdcCollateralId, amountWad, amountWad / WAD_TO_USDC],
        }),
      };

      let calls: readonly ForwarderCall[];
      if (hasDebt) {
        const { approvals, tx } = onchain.deposit
          .repay(debt!)
          .forAccount(accountId)
          .thenWithdraw(amountWad)
          .build();
        // Approve под оплату долга с кошелька — отдельными транзакциями, как
        // делает useRepay: approve через форвардер не проходит (msg.sender —
        // форвардер, а не владелец).
        for (const approval of approvals) {
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: await send(approval.to, approval.data),
          });
          if (receipt.status === "reverted") throw new Error("Approve reverted");
        }
        const { args } = decodeFunctionData({ abi: FORWARDER_ABI, data: tx.data });
        calls = [...args[0], unwrap];
      } else {
        calls = [
          {
            target: chain.contracts.PerpsMarketProxy,
            requireSuccess: true,
            // modifyCollateral(accountId, collateralId, amountDelta); negative = withdraw.
            callData: encodeFunctionData({
              abi: PERPS_ABI,
              functionName: "modifyCollateral",
              args: [accountId, susdcCollateralId, -amountWad],
            }),
          },
          unwrap,
        ];
      }
      return send(
        chain.contracts.TrustedMulticallForwarder,
        encodeFunctionData({ abi: FORWARDER_ABI, functionName: "aggregate3", args: [calls] }),
      );
    },
    invalidateKeys: wallet
      ? [
          { queryKey: liqQueryKeys.account.margin(networkId, wallet) },
          { queryKey: debtKey },
          // Баланс USDC кошелька для диалога депозита живёт в своём запросе.
          { queryKey: ["usdc-balance-wad"] },
        ]
      : [],
    onTransactionSuccess: () => {
      setAmount("");
      onClose();
    },
  });

  const pending = withdraw.isPending;
  const error = withdraw.error;

  // `mutate` (not `mutateAsync`): a failed op surfaces via the mutation's
  // `error` (rendered below); rejecting this handler would log an unhandled
  // promise rejection via the `void` click binding.
  function onSubmit() {
    if (accountId === undefined || amountWad <= 0n || invalid) return;
    withdraw.mutate({ accountId, amountWad });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        data-testid="withdraw-dialog"
        overlayTestId="dialog-overlay"
        className="w-[320px]"
      >
        <DialogHeader className="mb-3">
          <DialogTitle className="text-sm font-semibold">
            Withdraw USDC
          </DialogTitle>
        </DialogHeader>
        {hasDebt && (
          <div
            className="mb-3 rounded border border-short/40 bg-short/10 p-2 text-[11px] text-short"
            data-testid="withdraw-debt-notice"
          >
            ⚠ Account debt: {fmtUsd(debt ?? 0n)}. Withdrawals are blocked until
            repaid — this repays your debt (from wallet funds) and withdraws in
            one transaction.
          </div>
        )}
        {limit !== undefined && (
          <div className="mb-1 flex justify-between text-[11px] text-muted">
            <span>Available to withdraw</span>
            <span className="text-text" data-testid="withdraw-balance">
              {fmtUsd(limit)}
            </span>
          </div>
        )}
        <DecimalInput
          value={amount}
          onValueChange={setAmount}
          maxDecimals={6}
          invalid={invalid}
          placeholder="100"
          data-testid="withdraw-amount-input"
          rightSlot={
            limit !== undefined && limit > 0n ? (
              <button
                type="button"
                onClick={() => setAmount(wadToFixed(limit, 2))}
                className="rounded-[var(--radius-sm)] bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-accent hover:brightness-110"
                data-testid="withdraw-max-button"
              >
                MAX
              </button>
            ) : undefined
          }
        />
        {exceedsLimit && (
          <p
            className="mt-1 text-[10px] text-short"
            data-testid="withdraw-validation"
          >
            Exceeds available to withdraw.
          </p>
        )}
        {error && (
          <p
            className="mt-2 text-[11px] text-short"
            data-testid="withdraw-error"
          >
            {error.message}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={onClose}
            data-testid="withdraw-cancel-button"
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={
              pending || amountWad <= 0n || accountId === undefined || invalid
            }
            onClick={onSubmit}
            data-testid="withdraw-submit-button"
          >
            {pending
              ? hasDebt
                ? "Repaying…"
                : "Withdrawing…"
              : hasDebt
                ? "Repay & Withdraw"
                : "Withdraw"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
