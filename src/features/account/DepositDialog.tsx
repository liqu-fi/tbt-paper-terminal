import { Margin } from "@liq/sdk";
import {
  useAccountId,
  useDepositMutation,
  useDepositableBalance,
  useNetworkId,
} from "@liq/react";
import { formatUsd, getChainConfig, getCollaterals, wadToFixed } from "@liq/core";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseOrZero } from "../../lib/format";
import { DecimalInput } from "../../components/ui/DecimalInput";

export function DepositDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const accountId = useAccountId();
  const networkId = useNetworkId();
  const deposit = useDepositMutation();
  const [amount, setAmount] = useState("");
  // Депозитные токены контура из конфига SDK: на prod один USDC, на staging
  // ещё USDm. Переключатель рисуется только когда есть из чего выбирать.
  const collaterals = getCollaterals(getChainConfig(networkId));
  const symbols = Object.keys(collaterals);
  const [symbol, setSymbol] = useState(symbols[0]);
  const { decimals } = collaterals[symbol];

  // Wallet balance of the token this deposit actually spends (lifted to WAD) —
  // gating on the synth here would show $0.00 and block every deposit for a
  // fresh faucet user who holds the token and none of its synth. Best-effort:
  // an unavailable read resolves to 0n → no Max, no cap.
  const { data } = useDepositableBalance(symbol);
  const balance = data?.token;

  const amountWad = parseOrZero(Margin.parse, amount);
  const exceedsBalance = balance !== undefined && amountWad > balance;
  const invalid = exceedsBalance;

  // `mutate` (not `mutateAsync`): a failed deposit must surface via the
  // mutation's `error` (rendered below), not reject this handler — a rejected
  // `void onDeposit()` would otherwise log an unhandled promise rejection.
  function onDeposit() {
    if (accountId === undefined || amountWad <= 0n || invalid) return;
    deposit.mutate(
      { amount, accountId, collateral: symbol },
      {
        onSuccess: () => {
          setAmount("");
          onClose();
        },
        // An explicit error handler keeps a reverted deposit from becoming an
        // unhandled rejection. The SDK does not surface the revert as
        // `deposit.error` (monorepo#434) — the error-UI fix needs the SDK.
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
        data-testid="deposit-dialog"
        overlayTestId="dialog-overlay"
        className="w-[min(320px,calc(100vw-2rem))]"
      >
        <DialogHeader className="mb-3">
          <DialogTitle className="text-sm font-semibold">
            Deposit {symbol}
          </DialogTitle>
        </DialogHeader>
        {symbols.length > 1 && (
          <Tabs
            value={symbol}
            onValueChange={(next) => {
              setSymbol(next);
              setAmount("");
            }}
            className="mb-2"
          >
            <TabsList className="h-7 w-full">
              {symbols.map((s) => (
                <TabsTrigger
                  key={s}
                  value={s}
                  className="text-xs"
                  data-testid={`deposit-token-${s}`}
                >
                  {s}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        {balance !== undefined && (
          <div className="mb-1 flex justify-between text-[11px] text-muted">
            <span>Wallet balance</span>
            <span className="text-text" data-testid="deposit-balance">
              {formatUsd(balance)}
            </span>
          </div>
        )}
        <DecimalInput
          value={amount}
          onValueChange={setAmount}
          maxDecimals={decimals}
          invalid={invalid}
          placeholder="100"
          data-testid="deposit-amount-input"
          rightSlot={
            balance !== undefined && balance > 0n ? (
              <button
                type="button"
                onClick={() => setAmount(wadToFixed(balance, 2))}
                className="rounded-[var(--radius-sm)] bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-accent hover:brightness-110"
                data-testid="deposit-max-button"
              >
                MAX
              </button>
            ) : undefined
          }
        />
        {exceedsBalance && (
          <p
            className="mt-1 text-[10px] text-short"
            data-testid="deposit-validation"
          >
            Exceeds wallet balance.
          </p>
        )}
        {deposit.error && (
          <p
            className="mt-2 text-[11px] text-short"
            data-testid="deposit-error"
          >
            {deposit.error.message}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={onClose}
            data-testid="deposit-cancel-button"
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={
              deposit.isPending ||
              amountWad <= 0n ||
              accountId === undefined ||
              invalid
            }
            onClick={onDeposit}
            data-testid="deposit-submit-button"
          >
            {deposit.isPending ? "Depositing…" : "Deposit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
