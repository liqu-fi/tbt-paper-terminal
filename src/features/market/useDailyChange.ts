import type { CandleBar } from "@liq/core";
import { useCandles } from "@liq/react";

/** Сколько часовых баров нужно, чтобы у последнего был сосед сутками раньше. */
const BARS = 25;

interface DailyChange {
  /** Проценты, знаковые. */
  pct: number;
  /** Абсолютная разница цены, WAD, знаковая. */
  abs: bigint;
}

/**
 * Изменение против закрытия первого бара окна.
 *
 * @remarks
 * `null` — «сравнивать не с чем»: ряд короче двух баров или основание нулевое.
 * Ноль возвращается только когда цена действительно не изменилась, и эти два
 * ответа экран обязан различать.
 */
export function changeFromBars(bars: readonly CandleBar[]): DailyChange | null {
  if (bars.length < 2) return null;
  const base = bars[0].close;
  const last = bars[bars.length - 1].close;
  if (base === 0n) return null;
  const abs = last - base;
  // Через bigint, а не Number(abs) / Number(base): при 18 знаках оба операнда
  // выходят за безопасное целое, и деление теряет младшие разряды.
  return { pct: Number((abs * 1_000_000n) / base) / 10_000, abs };
}

/**
 * Изменение цены рынка за сутки.
 *
 * @remarks
 * Величины изменения нет ни в одном ответе шлюза: `PriceInfo.change` — это
 * направление последнего тика, а не размер движения.
 *
 * Маршрут оракульный намеренно: торговый ряд на рынке, где час никто не
 * торговал, бара просто не содержит, и «сутки» отсчитались бы от произвольно
 * давнего.
 */
export function useDailyChange(
  marketId: bigint | undefined,
  opts?: { enabled?: boolean },
): { change: DailyChange | null; isLoading: boolean } {
  const { bars, isLoading } = useCandles(marketId, "1h", {
    bars: BARS,
    route: "oracle",
    enabled: opts?.enabled ?? true,
  });
  return { change: changeFromBars(bars), isLoading };
}
