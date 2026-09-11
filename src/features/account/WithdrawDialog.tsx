import { Margin } from "@liq/sdk";
import {
  useAccountId,
  useAvailableMarginQuery,
  useCollateralAmountQuery,
  useLiqOnchain,
  useNetworkId,
  useRelayedWithdrawMutation,
} from "@liq/react";
import { formatUsd, getChainConfig, getCollaterals, wadToFixed } from "@liq/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

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
  const { data: margins } = useAvailableMarginQuery();
  const [amount, setAmount] = useState("");

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

  // Один подписанный батч через релеер (ADR-0063): снять синт с аккаунта и
  // развернуть его в токен, а при долге — погасить в голове того же батча.
  // Долг хук читает сам, отдельных транзакций approve больше нет, и ETH в
  // кошельке не нужен: за газ платит релеер.
  const withdraw = useRelayedWithdrawMutation();

  const pending = withdraw.isPending;
  const error = withdraw.error;

  // `mutate` (not `mutateAsync`): a failed op surfaces via the mutation's
  // `error` (rendered below).
  function onSubmit() {
    if (accountId === undefined || amountWad <= 0n || invalid) return;
    withdraw.mutate(
      { accountId, amountWad, collateral: symbol },
      {
        onSuccess: () => {
          setAmount("");
          onClose();
        },
        // Без обработчика отказ стал бы unhandled rejection: клик связан через
        // `void`. Сам текст показывается ниже из `withdraw.error`.
        onError: () => {},
      },
    );
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
