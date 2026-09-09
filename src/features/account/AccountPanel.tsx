import { useState } from "react";

import { Card } from "@/components/ui/card";

import { DASH, fmtSignedUsd, fmtUsd, toNum } from "../../lib/format";
import { DepositDialog } from "./DepositDialog";
import { useAccountSummary } from "./useAccountSummary";
import { WithdrawDialog } from "./WithdrawDialog";

export function AccountPanel() {
  const { summary } = useAccountSummary();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    // `shrink-0`: карточка счёта — подвал колонки тикета, а не её соперник за
    // высоту. Сжимаясь, она отдавала бы форме ноль пикселей скролла и рисовалась
    // поверх неё (см. e2e/tier1/29-layout-containment.spec.ts).
    <Card
      className="flex shrink-0 flex-col gap-1.5 border-t border-border p-2.5"
      data-testid="account-panel"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Account</span>
      </div>

      {/* Две колонки, а не шесть строк подряд: столбиком карточка занимала
          218px высоты колонки тикета — больше, чем оставалось самой форме. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <Row
          label="Unrealized PnL"
          testid="account-unrealized-pnl"
          tone={summary.unrealizedPnl < 0n ? "text-short" : "text-long"}
          value={fmtSignedUsd(summary.unrealizedPnl)}
        />
        <Row
          label="Equity"
          testid="account-equity"
          value={summary.equity === undefined ? DASH : fmtUsd(summary.equity)}
        />
        <Row
          label="Borrowed"
          testid="account-borrowed"
          value={fmtUsd(summary.borrowed)}
        />
        <Row
          label="Exposure"
          testid="account-exposure"
          value={fmtUsd(summary.exposure)}
        />
        <Row
          label="Account Leverage"
          testid="account-leverage"
          value={
            summary.leverage === undefined
              ? DASH
              : toNum(summary.leverage).toFixed(2)
          }
        />
      </div>

      <DepositDialog open={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
      />
    </Card>
  );
}

function Row({
  label,
  value,
  testid,
  tone,
}: {
  label: string;
  value: string;
  testid: string;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="truncate text-muted">{label}</span>
      <span
        className={`tabular-nums ${tone ?? "text-text"}`}
        data-testid={testid}
      >
        {value}
      </span>
    </div>
  );
}
