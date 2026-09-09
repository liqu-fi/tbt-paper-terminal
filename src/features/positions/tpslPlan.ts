import {
  closingOrderFor,
  type Position,
  type PositionBrackets,
  Side,
} from "@liq/sdk";

/** Условный ордер, который надо подать. */
interface BracketOrder {
  marketId: bigint;
  sizeDelta: bigint;
  side: Side;
  orderType: "TAKE_PROFIT_MARKET" | "STOP_MARKET";
  triggerPrice: bigint;
  triggerAbove: boolean;
  reduceOnly: true;
}

/** Что сделать, чтобы скобки позиции стали такими, как просят. */
interface TpSlPlan {
  /** Идентификаторы заявок под отмену. */
  cancel: string[];
  submit: BracketOrder[];
}

/**
 * Разница между тем, что у позиции есть, и тем, что у неё просят.
 *
 * @remarks Правка скобки — это отмена **конкретной** заявки и подача новой:
 * шлюз не умеет менять триггер на месте. Отсюда и `orderId` в
 * {@link PositionBrackets} — без него отменять нечего.
 *
 * Ноль в цене означает «снять», а не «оставить как было»: иначе снять скобку
 * было бы нечем. Неизменная цена не даёт ни отмены, ни подачи — переподача той
 * же скобки сожгла бы nonce и на секунду оставила позицию без стопа.
 *
 * Направление триггера берётся от стороны позиции: у длинной TP выше, SL ниже;
 * у короткой зеркально. Сторону и размер закрывающего ордера считает
 * `closingOrderFor` — здесь они не пересчитываются.
 */
export function tpslPlan(input: {
  position: Pick<Position, "marketId" | "side" | "size">;
  brackets: PositionBrackets;
  /** Желаемая цена TP; `0n` — снять. */
  takeProfit: bigint;
  /** Желаемая цена SL; `0n` — снять. */
  stopLoss: bigint;
}): TpSlPlan {
  const closing = closingOrderFor(input.position);
  const long = input.position.side === Side.BUY;
  const plan: TpSlPlan = { cancel: [], submit: [] };

  const leg = (
    current: PositionBrackets["takeProfit"],
    wanted: bigint,
    orderType: BracketOrder["orderType"],
    above: boolean,
  ) => {
    if (current !== null && current.triggerPrice === wanted) return;
    if (current !== null) plan.cancel.push(current.orderId);
    // Позиции нет — подавать закрывающий ордер не от чего; снять скобку всё
    // равно надо, поэтому отмена выше отмены не отменяется.
    if (wanted <= 0n || closing === null) return;
    plan.submit.push({
      marketId: closing.marketId,
      sizeDelta: closing.sizeDelta,
      side: closing.side,
      orderType,
      triggerPrice: wanted,
      triggerAbove: above,
      reduceOnly: true,
    });
  };

  leg(input.brackets.takeProfit, input.takeProfit, "TAKE_PROFIT_MARKET", long);
  leg(input.brackets.stopLoss, input.stopLoss, "STOP_MARKET", !long);

  return plan;
}
