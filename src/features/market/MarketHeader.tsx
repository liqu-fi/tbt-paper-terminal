import { compactUsd } from "@liq/core";
import { useAvailableMarginQuery, usePricesQuery } from "@liq/react";
import { useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

import { DASH, fmtPrice, fmtUsd, toNum } from "../../lib/format";
import { DepositDialog } from "../account/DepositDialog";
import { FaucetDialog } from "../account/FaucetDialog";
import { WithdrawDialog } from "../account/WithdrawDialog";
import { MarketSearch } from "./MarketSearch";
import { MarketStat } from "./MarketStat";
import { useDailyChange } from "./useDailyChange";
import { useFunding } from "./useFunding";
import { useMarketRows } from "./useMarketRows";
import { useSelectedMarket } from "./useSelectedMarket";

export function MarketHeader() {
  const { marketId, marketIds } = useSelectedMarket();
  const { data: prices } = usePricesQuery(marketIds);
  const { data: funding } = useFunding(marketId);
  const { data: margins } = useAvailableMarginQuery();
  const { change } = useDailyChange(marketId);
  const { rows } = useMarketRows();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [faucetOpen, setFaucetOpen] = useState(false);

  const info =
    marketId !== undefined ? prices?.[marketId.toString()] : undefined;
  const row = rows.find((r) => r.id === marketId);
  // Направление последнего тика — не то же, что изменение за сутки, и одно
  // другим не заменяется: макет рисует статичный снимок, а здесь цена живая.
  const dirColor =
    info?.change === "up"
      ? "text-long"
      : info?.change === "down"
        ? "text-short"
        : "text-text";

  return (
    <TooltipProvider>
      <div
        className="flex shrink-0 items-center gap-6 border-b border-border px-3 py-1.5"
        data-testid="market-header"
      >
        <MarketSearch />
        <div className="flex flex-col">
          <span
            className={`text-lg font-bold tabular-nums ${dirColor}`}
            data-testid="market-price"
          >
            {info ? `$${fmtPrice(info.price)}` : DASH}
            {info?.change === "up" ? " ▲" : info?.change === "down" ? " ▼" : ""}
          </span>
          <span
            className={`text-[11px] tabular-nums ${
              change && change.pct < 0 ? "text-short" : "text-long"
            }`}
            data-testid="market-change"
          >
            {change
              ? `${change.pct >= 0 ? "+" : ""}${change.pct.toFixed(2)}%`
              : DASH}
          </span>
        </div>

        <MarketStat label="Mark Price" testid="stat-mark-price">
          {info ? fmtPrice(info.price) : DASH}
        </MarketStat>
        <MarketStat
          label="Funding Rate"
          testid="stat-funding"
          note="Фандинг начисляется непрерывно — момента следующего списания не существует, отсчитывать нечего."
        >
          {/* Суточная ставка, WAD, знаковая. Пустой снимок (синк лежит, рынок
              новый, шлюз старее 0.34.0) обязан быть прочерком: его null,
              отформатированный числом, показал бы измеренные 0.0000 %. */}
          <span data-testid="funding-rate">
            {funding?.available && funding.rate !== null
              ? `${(toNum(funding.rate) * 100).toFixed(4)}%`
              : DASH}
          </span>
        </MarketStat>
        <MarketStat label="Open Interest" testid="stat-open-interest">
          {row?.openInterest == null ? DASH : compactUsd(row.openInterest)}
        </MarketStat>
        <MarketStat label="24h Volume" testid="stat-volume-24h">
          {row?.volumeUsd == null ? DASH : compactUsd(row.volumeUsd)}
        </MarketStat>

        <div className="flex-1" />
        <span className="text-xs text-muted">
          margin{" "}
          <span
            className="font-semibold text-text"
            data-testid="available-margin"
          >
            {margins ? fmtUsd(margins.available) : DASH}
          </span>
        </span>
        <button
          type="button"
          className="text-[11px] text-accent"
          onClick={() => setDepositOpen(true)}
          data-testid="open-deposit-button"
        >
          Deposit
        </button>
        <button
          type="button"
          className="text-[11px] text-muted"
          onClick={() => setWithdrawOpen(true)}
          data-testid="open-withdraw-button"
        >
          Withdraw
        </button>
        <button
          type="button"
          className="text-[11px] text-muted"
          onClick={() => setFaucetOpen(true)}
          data-testid="open-faucet-button"
        >
          Faucet
        </button>
        <DepositDialog
          open={depositOpen}
          onClose={() => setDepositOpen(false)}
        />
        <WithdrawDialog
          open={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
        />
        <FaucetDialog open={faucetOpen} onClose={() => setFaucetOpen(false)} />
      </div>
    </TooltipProvider>
  );
}
