import { Margin } from "@liq/sdk";
import {
  useAccountId,
  useAvailableMarginQuery,
  useCollateralAmountQuery,
  useLiqOnchain,
  useNetworkId,
  useTransactionMutation,
} from "@liq/react";
import { formatUsd, getChainConfig, getCollaterals, wadToFixed } from "@liq/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Hex } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseOrZero } from "../../lib/format";
import { DecimalInput } from "../../components/ui/DecimalInput";
import { CollateralTabs } from "./CollateralTabs";

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
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { data: margins } = useAvailableMarginQuery();
  const [amount, setAmount] = useState("");
  // Реверт приходит НЕ через `mutation.error`: `useTransactionMutation`
  // резолвит мутацию хэшем, а откат ресипта отдаёт только колбэком
  // `onTransactionError`. Без своего состояния диалог молча проглатывал бы
  // откат — кнопка «мёртвая», маржа не менялась (e2e 03).
  const [txError, setTxError] = useState<Error | null>(null);

  // Те же токены, что принимает депозит; вывод отдаёт на кошелёк сам токен,
  // а не синт (SDK разворачивает его в том же батче).
  const collaterals = getCollaterals(getChainConfig(networkId));
  const symbols = Object.keys(collaterals);
  const [symbol, setSymbol] = useState(symbols[0]);
  const { marketId, decimals } = collaterals[symbol];
  // Сколько именно этого токена лежит на аккаунте: withdrawable — USD по всем
  // коллатералам, и с двумя синтами MAX подставил бы сумму, которой в этом
  // токене нет — контракт откатил бы без причины.
  const { data: held } = useCollateralAmountQuery(BigInt(marketId));

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
  // позиции его не отпустят, откажет сам контракт — ошибка ниже. И то и другое
  // режется остатком выбранного токена на аккаунте.
  const marginLimit = hasDebt ? margins?.available : margins?.withdrawable;
  const caps = [marginLimit, held].filter((x): x is bigint => x !== undefined);
  const limit = caps.length ? caps.reduce((a, b) => (a < b ? a : b)) : undefined;
  const amountWad = parseOrZero(Margin.parse, amount);
  const exceedsLimit = limit !== undefined && amountWad > limit;
  const invalid = exceedsLimit;

  // Одна транзакция: снять синт с аккаунта и тут же развернуть его в токен —
  // батч собирает SDK (`WithdrawBuilder`). С долгом `payDebt` встаёт в голову
  // того же батча (`afterRepay`), а approve под оплату долга с кошелька идут
  // отдельными транзакциями: через форвардер approve не проходит (msg.sender —
  // форвардер, а не владелец).
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

      const builder = onchain.deposit
        .withdraw(symbol, amountWad)
        .forAccount(accountId);
      if (hasDebt) {
        builder.afterRepay(onchain.deposit.repay(debt!).forAccount(accountId));
      }
      const { approvals, tx } = builder.build();
      for (const approval of approvals) {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: await send(approval.to, approval.data),
        });
        if (receipt.status === "reverted") throw new Error("Approve reverted");
      }
      return send(tx.to, tx.data);
    },
    // Событие вместо списка ключей: маржа, остаток коллатерала и баланс
    // кошелька протухают срезами SDK. У долга среза нет — его ключ свой.
    stale: ["withdrawn"],
    invalidateKeys: [{ queryKey: debtKey }],
    onTransactionSuccess: () => {
      setAmount("");
      onClose();
    },
    onTransactionError: setTxError,
  });

  const pending = withdraw.isPending;
  // Отказ кошелька — в `withdraw.error` (SDK не зовёт колбэк на user-reject),
  // реверт — в `txError`; показываем любой.
  const error = withdraw.error ?? txError;

  // `mutate` (not `mutateAsync`): a failed op surfaces via the mutation's
  // `error` (rendered below); rejecting this handler would log an unhandled
  // promise rejection via the `void` click binding.
  function onSubmit() {
    if (accountId === undefined || amountWad <= 0n || invalid) return;
    setTxError(null);
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
        className="w-[min(320px,calc(100vw-2rem))]"
      >
        <DialogHeader className="mb-3">
          <DialogTitle className="text-sm font-semibold">
            Withdraw {symbol}
          </DialogTitle>
        </DialogHeader>
        <CollateralTabs
          symbols={symbols}
          value={symbol}
          onChange={(next) => {
            setSymbol(next);
            setAmount("");
            setTxError(null);
          }}
          testIdPrefix="withdraw"
        />
        {hasDebt && (
          <div
            className="mb-3 rounded border border-short/40 bg-short/10 p-2 text-[11px] text-short"
            data-testid="withdraw-debt-notice"
          >
            ⚠ Account debt: {formatUsd(debt ?? 0n)}. Withdrawals are blocked until
            repaid — this repays your debt (from wallet funds) and withdraws in
            one transaction.
          </div>
        )}
        {limit !== undefined && (
          <div className="mb-1 flex justify-between text-[11px] text-muted">
            <span>Available to withdraw</span>
            <span className="text-text" data-testid="withdraw-balance">
              {formatUsd(limit)}
            </span>
          </div>
        )}
        <DecimalInput
          value={amount}
          onValueChange={setAmount}
          maxDecimals={decimals}
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
