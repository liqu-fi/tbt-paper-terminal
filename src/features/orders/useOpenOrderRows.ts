import { type GatewayOrder, isInFlight } from "@liq/core";
import {
  useAccountId,
  useCancelOrderMutation,
  useConditionalOrders,
  useOpenOrdersQuery,
} from "@liq/react";
import { useMemo } from "react";

import { marketSymbol, useSelectedMarket } from "../market/useSelectedMarket";

/** Строка таблицы открытых ордеров: ордер плюс подпись рынка и отмена. */
export interface OrderRow {
  order: GatewayOrder;
  symbol: string;
  cancel: (id: string) => void;
  cancelling: boolean;
  /**
   * Можно ли ещё отменить.
   *
   * @remarks Ордер в полёте (`MATCHED`, `SETTLEMENT_SUBMITTED`,
   * `FAILED_RETRYABLE`) вышел из книги, но исхода ещё не получил: отменять
   * нечего, отмена вернула бы отказ шлюза. До SDK 0.46.0 такой ордер не
   * попадал ни в открытый список, ни в историю и просто исчезал с экрана
   * между матчингом и сеттлментом; теперь он виден — с выключенной отменой.
   */
  cancellable: boolean;
}

/** Открытые и условные ордера одной таблицей — как их видит трейдер. */
export function useOpenOrderRows(): {
  rows: OrderRow[];
  isLoading: boolean;
} {
  const { markets } = useSelectedMarket();
  const accountId = useAccountId();
  const { data: open = EMPTY, isLoading } = useOpenOrdersQuery(accountId);
  const { data: conditional = EMPTY } = useConditionalOrders();
  // Отмена в SDK инвалидирует оба списка (monorepo#453), поэтому здесь ничего
  // инвалидировать не надо.
  const cancel = useCancelOrderMutation(accountId);

  const rows = useMemo<OrderRow[]>(
    () =>
      [...open, ...conditional].map((order) => ({
        order,
        symbol: marketSymbol(markets, order.marketId),
        cancel: (id: string) => cancel.mutate(id),
        cancelling: cancel.isPending,
        cancellable: !isInFlight(order.status),
      })),
    [open, conditional, markets, cancel],
  );

  return { rows, isLoading };
}

const EMPTY: GatewayOrder[] = [];
