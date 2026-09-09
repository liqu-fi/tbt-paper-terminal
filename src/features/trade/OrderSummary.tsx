import { fmtPrice, fmtQty, fmtUsd } from "../../lib/format";
import type { TicketSummary } from "./ticketSummary";

/**
 * Сводка тикета.
 *
 * @remarks Количество, объём и стоимость у обеих сторон одинаковы — это один
 * расчёт, и печатается он один раз. Пара «зелёное / красное» осталась только
 * у `Liq. Price`: единственной строки, где лонг и шорт дают разные числа.
 *
 * Блок показан всегда, а не от непустого размера: сторона выбирается
 * нажатием кнопки, и сводка — единственное место, где видно, чем два нажатия
 * различаются. Появляясь только с размером, она прятала бы это различие ровно
 * тогда, когда его и разглядывают.
 */
export function OrderSummary({
  summary,
  baseSymbol,
  quoteSymbol,
}: {
  summary: TicketSummary;
  baseSymbol: string;
  quoteSymbol: string;
}) {
  const dash = "—";
  const liq = (v: bigint | null) => (v === null ? dash : fmtPrice(v));
  return (
    <div
      className="flex flex-col gap-0.5 rounded-[var(--radius-sm)] border border-border bg-surface-2 p-1.5 text-[10px]"
      data-testid="order-summary"
    >
      <Row label="Order qty." value={fmtQty(summary.qty)} unit={baseSymbol} testid="order-qty" />
      <Row label="Order value" value={fmtUsd(summary.value)} unit={quoteSymbol} testid="order-value" />
      <Row label="Cost" value={fmtUsd(summary.cost)} unit={quoteSymbol} testid="order-cost" />
      <div className="flex justify-between">
        <span className="text-muted">Liq. Price</span>
        <span data-testid="order-liq-price">
          <span className="text-long">{liq(summary.long.liqPrice)}</span>
          <span className="text-muted"> / </span>
          <span className="text-short">{liq(summary.short.liqPrice)}</span>
        </span>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  unit,
  testid,
}: {
  label: string;
  value: string;
  unit: string;
  testid: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span data-testid={testid}>
        <span className="text-text">{value}</span>
        <span className="text-muted"> {unit}</span>
      </span>
    </div>
  );
}
