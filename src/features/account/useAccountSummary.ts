import type { AccountMargin } from "@liq/api-client";
import {
  useAccountId,
  useAvailableMarginQuery,
  useEnrichedPositions,
  useLiqClient,
  useLiqOnchain,
} from "@liq/react";
import { useQuery } from "@tanstack/react-query";

import { useSelectedMarket } from "../market/useSelectedMarket";

const WAD = 10n ** 18n;

/** Ровно то, что панели нужно знать о позиции. */
interface SummaryPosition {
  unrealizedPnl: bigint;
  notional: bigint;
}

interface SummaryInput {
  /** `getAvailableMargin` — залог, переоценённый по марку. `undefined` = не прочитано. */
  available: bigint | undefined;
  /** Офчейн-лок под неурегулированные филлы. */
  locked: bigint;
  debt: bigint;
  positions: SummaryPosition[];
}

interface AccountSummary {
  unrealizedPnl: bigint;
  accountValue: bigint | undefined;
  equity: bigint | undefined;
  borrowed: bigint;
  exposure: bigint;
  /** WAD-кратность. `undefined`, когда стоимость счёта неизвестна или неположительна. */
  leverage: bigint | undefined;
}

/**
 * Шесть чисел панели из четырёх чтений.
 *
 * @remarks Чистая функция — вся её работа складывать и делить уже посчитанное:
 * `unrealizedPnl` и `notional` приходят из `enrichPosition`, `available` из
 * `getAvailableMargin`. Ни одна величина здесь не выводится заново.
 *
 * `undefined` вместо нуля там, где чтение не состоялось: обнулившийся счёт и
 * непрочитанный счёт — разные вещи, и на экране кризиса их путать нельзя.
 */
export function summarize(input: SummaryInput): AccountSummary {
  const unrealizedPnl = input.positions.reduce(
    (sum, p) => sum + p.unrealizedPnl,
    0n,
  );
  const exposure = input.positions.reduce((sum, p) => sum + p.notional, 0n);
  const accountValue = input.available;
  const equity =
    accountValue === undefined ? undefined : accountValue - input.locked;
  const leverage =
    accountValue === undefined || accountValue <= 0n
      ? undefined
      : (exposure * WAD) / accountValue;
  return {
    unrealizedPnl,
    accountValue,
    equity,
    borrowed: input.debt,
    exposure,
    leverage,
  };
}

/**
 * Панель Account поверх четырёх чтений SDK.
 *
 * @remarks Двух из них нет хуками в `@liq/react` — `accounts.getMargin` и
 * `collateral.debt` живут только методами сервисов, поэтому здесь стоит
 * локальный `useQuery`. Это пробел SDK, а не разрешение считать в терминале:
 * логика чтения остаётся за швом, снаружи только проводка. Имена запросов не
 * начинаются с `liq/`, поэтому `resetAuthedQueries` их не сметает; ключ несёт
 * `accountId`, так что вход другим кошельком получает другую запись кэша, а не
 * чужие числа.
 */
export function useAccountSummary(): {
  summary: AccountSummary;
  isLoading: boolean;
} {
  const accountId = useAccountId();
  const client = useLiqClient();
  const onchain = useLiqOnchain();
  const { allMarketIds } = useSelectedMarket();

  const { data: margins, isLoading: marginsLoading } = useAvailableMarginQuery();
  const { data: positions = EMPTY } = useEnrichedPositions(allMarketIds);

  const { data: gatewayMargin } = useQuery<AccountMargin>({
    queryKey: ["terminal", "account-margin", accountId?.toString() ?? "none"],
    queryFn: () => client.accounts.getMargin(accountId!),
    enabled: accountId !== undefined,
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  const { data: debt } = useQuery<bigint>({
    queryKey: ["terminal", "account-debt", accountId?.toString() ?? "none"],
    queryFn: () => onchain.collateral.debt(accountId!),
    enabled: accountId !== undefined,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    summary: summarize({
      available: margins?.available,
      locked: gatewayMargin?.locked ?? 0n,
      debt: debt ?? 0n,
      positions: positions.map((p) => ({
        unrealizedPnl: p.unrealizedPnl,
        notional: p.notional,
      })),
    }),
    isLoading: marginsLoading,
  };
}

const EMPTY: { unrealizedPnl: bigint; notional: bigint }[] = [];
