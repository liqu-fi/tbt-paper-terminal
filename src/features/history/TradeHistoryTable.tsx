import type { TradeRow } from "@liq/api-client";
import { useAccountId, useTradesRestQuery } from "@liq/react";
import { createColumnHelper } from "@tanstack/react-table";
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

interface Row {
  trade: TradeRow;
  symbol: string;
}

const helper = createColumnHelper<typeof features, Row>();

const columns = helper.columns([
  helper.accessor((r) => r.trade.timestamp, {
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
      marketFilterFn(row.original.trade.marketId.toString(), value),
    cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
  }),
  helper.accessor((r) => r.trade.side, {
    id: "side",
    header: "Side",
    cell: (info) => (
      <span className={info.getValue() === "BUY" ? "text-long" : "text-short"}>
        {info.getValue()}
      </span>
    ),
  }),
  helper.accessor((r) => Number(r.trade.price), {
    id: "price",
    header: "Price",
    cell: (info) => fmtPrice(info.row.original.trade.price),
  }),
  helper.accessor((r) => Number(r.trade.size), {
    id: "size",
    header: "Size",
    cell: (info) => fmtQty(info.row.original.trade.size),
  }),
  helper.accessor((r) => r.trade.role ?? "", {
    id: "role",
    header: "Role",
    cell: (info) => (
      <span className="text-muted">{info.getValue() || DASH}</span>
    ),
  }),
  helper.accessor((r) => Number(r.trade.fee ?? 0n), {
    id: "fee",
    header: "Fee",
    // `null` — «доля этого филла недоказуема» (контракт списывает агрегат по
    // счёту в транзакции) или «батч ещё не расчитан». Ноль читался бы как
    // бесплатная сделка.
    cell: (info) => {
      const fee = info.row.original.trade.fee;
      return fee === null ? DASH : fmtUsd(fee);
    },
  }),
  helper.accessor((r) => Number(r.trade.realizedPnl ?? 0n), {
    id: "rpnl",
    header: "Realized P&L",
    cell: (info) => {
      const pnl = info.row.original.trade.realizedPnl;
      if (pnl === null) return <span className="text-muted">{DASH}</span>;
      return (
        <span className={pnl < 0n ? "text-short" : "text-long"}>
          {fmtSignedUsd(pnl)}
        </span>
      );
    },
  }),
  helper.accessor((r) => r.trade.txHash ?? "", {
    id: "tx",
    header: "Tx",
    cell: (info) => {
      const hash = info.row.original.trade.txHash;
      return (
        <span className="text-muted">
          {hash === null ? DASH : fmtHash(hash)}
        </span>
      );
    },
  }),
]);

export function TradeHistoryTable() {
  const { markets } = useSelectedMarket();
  const accountId = useAccountId();
  const { data, isLoading } = useTradesRestQuery({ accountId, limit: 50 });

  const rows = useMemo<Row[]>(
    () =>
      (data?.rows ?? []).map((trade) => ({
        trade,
        symbol: marketSymbol(markets, trade.marketId),
      })),
    [data, markets],
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      testid="trade-history-table"
      rowId={(r) => r.trade.id}
      loading={isLoading}
      emptyText="No trades yet."
    />
  );
}
