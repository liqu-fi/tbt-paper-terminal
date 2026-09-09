import type { SettlementLedgerRow } from "@liq/api-client";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";

import { DataTable, MARKET_COLUMN_ID } from "@/components/data-table/DataTable";
import { features, marketFilterFn } from "@/components/data-table/features";

import { DASH, fmtHash, fmtSignedUsd, fmtTime } from "../../lib/format";
import { marketSymbol, useSelectedMarket } from "../market/useSelectedMarket";
import { fundingRows, useAccountLedger } from "./useAccountLedger";

interface Row {
  ledger: SettlementLedgerRow;
  symbol: string;
}

const helper = createColumnHelper<typeof features, Row>();

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
  helper.accessor((r) => Number(r.ledger.accruedFunding ?? 0n), {
    id: "payment",
    header: "Funding",
    // Знак — протокольный: положительное КРЕДИТУЕТ трейдера. Строки без
    // доказанного платежа сюда не доходят — их отсеял `fundingRows`.
    cell: (info) => {
      const v = info.row.original.ledger.accruedFunding ?? 0n;
      return (
        <span className={v < 0n ? "text-short" : "text-long"}>
          {fmtSignedUsd(v)}
        </span>
      );
    },
  }),
  helper.display({
    id: "rate",
    header: "Rate",
    // Ставки НА МОМЕНТ ПЛАТЕЖА не хранит никто: гейтвей отдаёт текущую ставку
    // рынка (`markets.getFunding`), а она к прошлому расчёту отношения не имеет.
    // Подставить её сюда значило бы напечатать измеренной величиной цифру,
    // которой в этот момент не было.
    cell: () => <span className="text-muted">{DASH}</span>,
  }),
  helper.accessor((r) => r.ledger.txHash, {
    id: "tx",
    header: "Tx",
    cell: (info) => (
      <span className="text-muted">{fmtHash(info.getValue())}</span>
    ),
  }),
]);

export function FundingHistoryTable() {
  const { markets } = useSelectedMarket();
  const { rows: ledger, isLoading } = useAccountLedger();

  const rows = useMemo<Row[]>(
    () =>
      fundingRows(ledger).map((row) => ({
        ledger: row,
        symbol: marketSymbol(markets, row.marketId),
      })),
    [ledger, markets],
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      testid="funding-history-table"
      rowId={(r) => `${r.ledger.txHash}-${r.ledger.logIndex}`}
      loading={isLoading}
      emptyText="No funding payments yet."
    />
  );
}
