import type { SettlementLedgerRow } from "@liq/api-client";
import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { DataTable, MARKET_COLUMN_ID } from "@/components/data-table/DataTable";
import { features, marketFilterFn } from "@/components/data-table/features";

import {
  DASH,
  fmtHash,
  fmtPrice,
  fmtQty,
  fmtSignedUsd,
  fmtTime,
  fmtUsd,
} from "../../lib/format";
import { marketSymbol, useSelectedMarket } from "../market/useSelectedMarket";
import { useAccountLedger } from "./useAccountLedger";

interface Row {
  ledger: SettlementLedgerRow;
  symbol: string;
}

const helper = createColumnHelper<typeof features, Row>();

/** WAD со знаком либо прочерк — `null` в леджере значит «недоказуемо». */
function signed(v: bigint | null): ReactNode {
  if (v === null) return <span className="text-muted">{DASH}</span>;
  return (
    <span className={v < 0n ? "text-short" : "text-long"}>
      {fmtSignedUsd(v)}
    </span>
  );
}

const columns = helper.columns([
  helper.accessor((r) => r.ledger.timestampMs, {
    id: "time",
    header: "Time",
    cell: (info) => (
      <span className="text-muted">{fmtTime(info.getValue())}</span>
    ),
  }),
  helper.accessor((r) => r.symbol, {
    id: MARKET_COLUMN_ID,
    header: "Market",
    enableHiding: false,
    filterFn: (row, _id, value) =>
      marketFilterFn(row.original.ledger.marketId.toString(), value),
    cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
  }),
  helper.accessor((r) => r.ledger.kind, {
    id: "kind",
    header: "Kind",
    cell: (info) => (
      <span
        className={
          info.getValue() === "liquidation" ? "text-short" : "text-muted"
        }
      >
        {info.getValue() === "liquidation" ? "Liquidation" : "Settlement"}
      </span>
    ),
  }),
  helper.accessor((r) => Number(r.ledger.sizeDelta ?? 0n), {
    id: "sizeDelta",
    header: "Size Δ",
    cell: (info) => {
      const d = info.row.original.ledger.sizeDelta;
      return d === null ? DASH : fmtQty(d);
    },
  }),
  helper.accessor((r) => Number(r.ledger.fillPrice ?? 0n), {
    id: "fillPrice",
    header: "Fill Price",
    cell: (info) => {
      const px = info.row.original.ledger.fillPrice;
      return px === null ? DASH : fmtPrice(px);
    },
  }),
  helper.accessor((r) => Number(r.ledger.pricePnl ?? 0n), {
    id: "pricePnl",
    header: "Price PnL",
    cell: (info) => signed(info.row.original.ledger.pricePnl),
  }),
  helper.accessor((r) => Number(r.ledger.accruedFunding ?? 0n), {
    id: "funding",
    header: "Funding",
    cell: (info) => signed(info.row.original.ledger.accruedFunding),
  }),
  helper.accessor((r) => Number(r.ledger.interest ?? 0n), {
    id: "interest",
    header: "Interest",
    cell: (info) => {
      const i = info.row.original.ledger.interest;
      return i === null ? DASH : fmtUsd(i);
    },
  }),
  helper.accessor((r) => Number(r.ledger.totalFees ?? 0n), {
    id: "fees",
    header: "Fees",
    cell: (info) => {
      const f = info.row.original.ledger.totalFees;
      return f === null ? DASH : fmtUsd(f);
    },
  }),
  helper.accessor((r) => Number(r.ledger.netBalanceDelta ?? 0n), {
    id: "net",
    header: "Net Δ",
    cell: (info) => signed(info.row.original.ledger.netBalanceDelta),
  }),
  helper.accessor((r) => r.ledger.txHash, {
    id: "tx",
    header: "Tx",
    cell: (info) => (
      <span className="text-muted">{fmtHash(info.getValue())}</span>
    ),
  }),
]);

export function AccountHistoryTable() {
  const { markets } = useSelectedMarket();
  const { rows: ledger, isLoading } = useAccountLedger();

  const rows = useMemo<Row[]>(
    () =>
      ledger.map((row) => ({
        ledger: row,
        symbol: marketSymbol(markets, row.marketId),
      })),
    [ledger, markets],
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      testid="account-history-table"
      rowId={(r) => `${r.ledger.txHash}-${r.ledger.logIndex}`}
      loading={isLoading}
      emptyText="No settlements yet."
    />
  );
}
