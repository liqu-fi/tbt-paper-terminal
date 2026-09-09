import { fmtPrice } from "@/lib/format";
import { formatRatio, type BookSnapshot } from "@liq/sdk";
import { useTradeStore } from "@liq/react";


import { BookRow } from "./BookRow";
import { askSlots, bidSlots, fmtBookPrice, ratioPct } from "./bookView";
import { pickLevel } from "./pickLevel";

interface BookGridProps {
  book: BookSnapshot;
  view: "both" | "bids" | "asks";
  slots: number;
  tick: bigint;
  markPrice: bigint;
  baseSymbol: string;
}

/**
 * Сетка книги: заголовок колонок, аски, строка спреда, биды, полоса
 * дисбаланса.
 *
 * @remarks Заголовок цены — `USD`, а не `USDT` с макета: контур торгует
 * sUSD, тикера котируемой валюты в конфигурации SDK нет, а перенесённый с
 * картинки `USDT` был бы утверждением о валюте, которого никто не проверял.
 */
export function BookGrid({
  book,
  view,
  slots,
  tick,
  markPrice,
  baseSymbol,
}: BookGridProps) {
  const setOrderType = useTradeStore((s) => s.setOrderType);
  const setLimitPrice = useTradeStore((s) => s.setLimitPrice);

  // Порядок несущий — см. TSDoc `pickLevel`. Вынесена в чистую функцию,
  // чтобы инвариант (стор после клика держит и `orderType`, и `limitPrice`)
  // проверялся юнит-тестом на самой функции, а не только через рендер формы.
  const pick = (price: bigint) =>
    pickLevel({ setOrderType, setLimitPrice }, price);

  const showAsks = view !== "bids";
  const showBids = view !== "asks";
  const asks = showAsks ? askSlots(book.asks, slots) : [];
  const bids = showBids ? bidSlots(book.bids, slots) : [];
  // Полоса дисбаланса всегда читает `book.bidShare` — долю по ВСЕЙ полученной
  // книге, а не по показанному срезу (см. TSDoc BookSnapshot.bidShare).
  const bidPct = ratioPct(book.bidShare);

  return (
    <div className="flex h-full min-h-0 flex-col text-xs">
      <div className="grid h-[22px] shrink-0 grid-cols-3 items-center px-1 text-[10px] text-muted">
        <span>Price (USD)</span>
        <span className="text-right">Size ({baseSymbol})</span>
        <span className="text-right">Total ({baseSymbol})</span>
      </div>

      {/* Строки прижаты к своей середине: шапка колонок сверху и полоса
          дисбаланса снизу имеют фиксированную высоту, из которой
          `useBookSlots` и вычитает `GRID_CHROME_PX`. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {showAsks && (
          <div>
            {asks.map((slot, i) => (
              <BookRow
                key={i}
                slot={slot}
                side="ask"
                tick={tick}
                maxTotal={book.maxTotal}
                testid={`book-ask-${i}`}
                onPick={pick}
              />
            ))}
          </div>
        )}

        <div
          className="flex h-7 shrink-0 items-center justify-between px-1 text-xs"
          data-testid="book-spread"
        >
          <span className="text-sm text-text">
            {markPrice > 0n ? fmtPrice(markPrice) : "—"}
          </span>
          <span className="text-muted">
            {book.spread === null || book.spreadRatio === null
              ? "Spread —"
              : `Spread ${fmtBookPrice(book.spread, tick)} (${formatRatio(book.spreadRatio, { maxDecimals: 3 })})`}
          </span>
        </div>

        {showBids && (
          <div>
            {bids.map((slot, i) => (
              <BookRow
                key={i}
                slot={slot}
                side="bid"
                tick={tick}
                maxTotal={book.maxTotal}
                testid={`book-bid-${i}`}
                onPick={pick}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className="mt-1 flex h-4 shrink-0 items-center gap-1 text-[10px]"
        data-testid="book-imbalance"
        title="Share of resting size on each side of the whole received book"
      >
        <span className="text-long" data-testid="book-imbalance-bid">
          {bidPct}%
        </span>
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full">
          <div className="bg-[var(--long)]" style={{ width: `${bidPct}%` }} />
          <div className="flex-1 bg-[var(--short)]" />
        </div>
        <span className="text-short" data-testid="book-imbalance-ask">
          {100 - bidPct}%
        </span>
      </div>
    </div>
  );
}
