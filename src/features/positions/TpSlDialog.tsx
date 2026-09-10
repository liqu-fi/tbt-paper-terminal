import { Price } from "@liq/sdk";
import {
  useAccountId,
  useCancelOrdersMutation,
  useOrderSubmission,
} from "@liq/react";
import { wadToFixed } from "@liq/core";
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
import { tpslPlan } from "./tpslPlan";
import type { PositionRow } from "./usePositionRows";

/**
 * Правка скобок одной позиции.
 *
 * @remarks Поля предзаполнены текущими триггерами: диалог показывает состояние,
 * а не пустой бланк, — иначе «Save» с нетронутым полем снял бы обе скобки.
 * Начальное значение берётся при монтировании, а родитель монтирует диалог с
 * `key` по рынку: сброс полей через эффект переписывал бы уже набранное на
 * каждом опросе позиций.
 *
 * Отмены уходят одной пачкой, подачи — по очереди: каждый ордер подписывается
 * следующим nonce, и параллельная подача гонит `withNonceRetry` сам с собой.
 */
export function TpSlDialog({
  row,
  onClose,
}: {
  row: PositionRow;
  onClose: () => void;
}) {
  const accountId = useAccountId();
  const cancelOrders = useCancelOrdersMutation(accountId);
  const submit = useOrderSubmission();
  const [tp, setTp] = useState(() =>
    row.brackets.takeProfit
      ? wadToFixed(row.brackets.takeProfit.triggerPrice, 2)
      : "",
  );
  const [sl, setSl] = useState(() =>
    row.brackets.stopLoss
      ? wadToFixed(row.brackets.stopLoss.triggerPrice, 2)
      : "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (accountId === undefined) return;
    const plan = tpslPlan({
      position: row.position,
      brackets: row.brackets,
      // Пустое поле — `0n`, то есть «снять».
      takeProfit: parseOrZero(Price.parse, tp),
      stopLoss: parseOrZero(Price.parse, sl),
    });
    if (plan.cancel.length === 0 && plan.submit.length === 0) {
      onClose();
      return;
    }

    setPending(true);
    setError(null);
    try {
      if (plan.cancel.length > 0) {
        await cancelOrders.mutateAsync(plan.cancel);
      }
      for (const order of plan.submit) {
        await submit({ kind: "conditional", accountId, ...order });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        data-testid="tpsl-dialog"
        overlayTestId="dialog-overlay"
        className="w-[min(320px,calc(100vw-2rem))]"
      >
        <DialogHeader className="mb-3">
          <DialogTitle className="text-sm font-semibold">
            TP / SL — {row.symbol}
          </DialogTitle>
        </DialogHeader>

        <label className="mb-1 block text-[10px] uppercase text-muted">
          Take profit
        </label>
        <DecimalInput
          value={tp}
          onValueChange={setTp}
          maxDecimals={2}
          placeholder="0.00"
          data-testid="tpsl-tp-input"
        />

        <label className="mb-1 mt-3 block text-[10px] uppercase text-muted">
          Stop loss
        </label>
        <DecimalInput
          value={sl}
          onValueChange={setSl}
          maxDecimals={2}
          placeholder="0.00"
          data-testid="tpsl-sl-input"
        />

        <p className="mt-2 text-[11px] text-muted">
          Empty field removes the bracket. Orders are reduce-only.
        </p>

        {error && (
          <p className="mt-2 text-[11px] text-short" data-testid="tpsl-error">
            {error}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={onClose}
            data-testid="tpsl-cancel"
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={pending || accountId === undefined}
            onClick={() => void save()}
            data-testid="tpsl-save"
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
