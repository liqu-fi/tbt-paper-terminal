import {
  calcRequiredMaintenanceMargin,
  draftLiquidationPrice,
  type Margin,
  marginCost,
  type Price,
  type Qty,
  Side,
  sizeDelta,
  sizeToUsd,
  type Usd,
} from "@liq/sdk";

/** Одна сторона предполагаемого ордера. */
interface TicketSide {
  /** Знаковый размер: положительный — лонг, отрицательный — шорт. */
  sizeDelta: Qty;
  /**
   * Оценка ликвидации черновика, или `null`.
   *
   * @remarks `null` — «уровня нет», а не «уровень в нуле»: ноль здесь читался
   * бы как измеренная цена. Приходит из `draftLiquidationPrice`, который
   * отвечает на вопрос тикета «куда мне нельзя», а не на вопрос аккаунта
   * «когда меня ликвидируют».
   */
  liqPrice: Price | null;
}

/** Сводка тикета: общая часть плюс по стороне на каждый исход. */
export interface TicketSummary {
  /** Величина без знака — одна на обе стороны. */
  qty: Qty;
  /** Объём в USD по марку. */
  value: Usd;
  /** Маржа, которую ордер стоит при выбранном плече. */
  cost: Margin;
  long: TicketSide;
  short: TicketSide;
}

function sideOf(
  side: Side,
  sizeQty: Qty,
  markPrice: Price,
  margin: Margin,
  mmfWad: bigint | undefined,
): TicketSide {
  const delta = sizeDelta(sizeQty, side);
  // Проверяется ровно то, чего `draftLiquidationPrice` не знает: доля рынка и
  // маржа. Нулевой размер и отсутствующий марк он отвергает сам — повторить
  // это условие здесь значило бы завести вторую копию правила, которая может
  // с первой разойтись.
  if (mmfWad === undefined || margin <= 0n) {
    return { sizeDelta: delta, liqPrice: null };
  }
  const requirement = calcRequiredMaintenanceMargin(delta, markPrice, mmfWad);
  return {
    sizeDelta: delta,
    liqPrice:
      draftLiquidationPrice({
        size: delta,
        mark: markPrice,
        margin,
        requirement,
      }) ?? null,
  };
}

/**
 * Обе стороны одного черновика разом.
 *
 * @remarks
 * Тикет по макету показывает лонг и шорт рядом, а не по выбранной стороне,
 * поэтому обе оценки ликвидации считаются всегда — и различаются: относительно
 * входа уровень асимметричен.
 *
 * @param input.mmfWad - поддерживающая доля маржи в WAD; `undefined`, когда
 *   рынок её не отдал. Тогда уровня нет ни у одной стороны, но количество,
 *   объём и стоимость остаются посчитанными: отсутствие одной величины не
 *   повод стереть остальные.
 */
export function ticketSummary(input: {
  sizeQty: Qty;
  markPrice: Price;
  leverage: number;
  mmfWad: bigint | undefined;
}): TicketSummary {
  const { sizeQty, markPrice, leverage, mmfWad } = input;
  // Без марка `sizeToUsd` сам отдаёт ноль — тернарник на `markPrice > 0n` был
  // бы веткой, которую ничем не отличить от её отсутствия.
  const value = sizeToUsd(sizeQty, markPrice);
  const cost = marginCost(value, leverage);
  return {
    qty: sizeQty,
    value,
    cost,
    long: sideOf(Side.BUY, sizeQty, markPrice, cost, mmfWad),
    short: sideOf(Side.SELL, sizeQty, markPrice, cost, mmfWad),
  };
}
