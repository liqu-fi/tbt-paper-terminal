import { formatPrice, formatRatio, formatUsd, wadToNumber } from "@liq/core";

/**
 * Здесь только то, чего нет в `@liq/core`: деньги, количества, разбор WAD и
 * адреса печатает SDK (`formatUsd`, `formatQty`, `parseWadLoose`, `wadToFixed`,
 * `truncateAddress`, `sanitizeDecimal`) — стакан и таблицы говорят одним языком.
 */

/** Прочерк — единственное написание «данных нет» на экране. */
export const DASH = "—";

/**
 * Цена в таблицах и шапке: без `$` (валюту называет заголовок колонки) и без
 * обязательных копеек — «69,900», а не «$69,900.00».
 */
export function fmtPrice(v: bigint): string {
  return formatPrice(v, { sign: "", minDecimals: 0 });
}

/** «+$12.34» / «-$12.34»: SDK ставит только минус, плюс дописывается здесь. */
export function fmtSignedUsd(v: bigint): string {
  return (v < 0n ? "" : "+") + formatUsd(v);
}

/** WAD-доля (1e18 = 100%) со знаком: «+1.23%». */
export function fmtSignedPct(ratio: bigint): string {
  return (ratio < 0n ? "" : "+") + formatRatio(ratio);
}

/** WAD-плечо: «10x», «3.5x». Целое печатается без дробной части. */
export function fmtLeverage(wad: bigint): string {
  return `${Number(wadToNumber(wad).toFixed(1))}x`;
}

/** Unix-миллисекунды → «02.09 14:35» в локали пользователя. */
export function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Число из поля ввода: пустое или неразборчивое — `0n`, то есть «не введено».
 *
 * @remarks `Price.parse("")` уже отдаёт `0n`; try/catch — на мусор, который
 * поле по идее не пропускает, но проверка на границе с пользователем остаётся.
 */
export function parseOrZero(
  parse: (raw: string) => bigint,
  raw: string,
): bigint {
  try {
    return parse(raw);
  } catch {
    return 0n;
  }
}
