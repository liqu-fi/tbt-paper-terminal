import { useMarketsQuery } from "@liq/react";
import { createContext, useContext } from "react";

export type MarketSummary = NonNullable<
  ReturnType<typeof useMarketsQuery>["data"]
>[number];

export type MarketCtx = {
  markets: MarketSummary[];
  /**
   * Список рынков ещё в полёте.
   *
   * @remarks Без этого признака `marketId === undefined` неотличимо от «рынка
   * нет вовсе»: пока `/markets` не ответил, выбирать не из чего, и экран,
   * утверждающий «рынок не выбран», говорит это ровно в тот момент, когда
   * рынок выбирается. Отличать выбор, которого ещё нет, от выбора, которого не
   * будет, — работа этого поля.
   */
  marketsLoading: boolean;
  marketId: bigint | undefined;
  market: MarketSummary | undefined;
  setMarketId: (id: bigint) => void;
  /** memoized [marketId] for single-market array-param hooks */
  marketIds: bigint[];
  /** memoized list of all market ids (for cross-market positions) */
  allMarketIds: bigint[];
};

/**
 * Символ рынка по его идентификатору.
 *
 * @remarks Один на все таблицы: `marketId` доезжает в строках то `bigint`-ом
 * (позиции, леджер), то строкой (ордера), поэтому сравнение приводит обе
 * стороны к строке. Рынок, которого нет в списке — не ошибка, а рынок,
 * закрытый после сделки: тогда печатается сам идентификатор, потому что
 * пустая ячейка на месте рынка читается как «сделка ни по чему».
 */
export function marketSymbol(
  // Ровно два поля и `readonly`: вызывающие держат список в разных формах
  // (контекст рынка, пропс `usePositionRows`), а функции нужен только он сам.
  markets: readonly { id: bigint; symbol: string }[],
  marketId: bigint | string,
): string {
  const key = marketId.toString();
  return markets.find((m) => m.id.toString() === key)?.symbol ?? key;
}

/** Shared selected-market context; provided by `MarketProvider`. */
export const SelectedMarketContext = createContext<MarketCtx | null>(null);

export function useSelectedMarket(): MarketCtx {
  const ctx = useContext(SelectedMarketContext);
  if (!ctx)
    throw new Error("useSelectedMarket must be used within MarketProvider");
  return ctx;
}
