import {
  type BookRow,
  formatPrice,
  formatQty,
  Price,
  tickDecimals,
} from "@liq/sdk";
import { wadToNumber } from "@liq/core";


/** Пустой слот сетки: место занято, данных нет. */
export type Slot = BookRow | null;

/**
 * Раскладывает список строк в сетку фиксированной высоты.
 *
 * @remarks Высота панели не должна зависеть от толщины содержимого — иначе
 * соседний график или соседняя вкладка дёргается на каждом снимке. Лишние
 * строки отбрасываются, недостающие добиваются пустыми слотами с указанной
 * стороны. Дженерик, а не `BookRow[]`: та же раскладка нужна ленте сделок
 * (`TapeRow[]` в `useTradesTape.ts`) — рядов книги от рядов ленты эта функция
 * ничем не отличает, обеим достаточно `slice` + добивки.
 */
export function padSlots<T>(
  rows: readonly T[],
  slots: number,
  where: "start" | "end",
): (T | null)[] {
  const kept = rows.slice(0, slots);
  const blanks = Array.from<T | null>({
    length: Math.max(0, slots - kept.length),
  });
  const filled = blanks.fill(null);
  return where === "start" ? [...filled, ...kept] : [...kept, ...filled];
}

/**
 * Аски сверху вниз: худшая цена первой, лучшая — вплотную к спреду.
 *
 * @remarks `BookSnapshot.asks` приходит от лучшей цены к худшей; на экране
 * порядок обратный, поэтому разворот делается здесь, а не в SDK.
 */
export function askSlots(asks: readonly BookRow[], slots: number): Slot[] {
  return padSlots([...asks].slice(0, slots).reverse(), slots, "start");
}

/** Биды сверху вниз: лучшая цена сразу под спредом. */
export function bidSlots(bids: readonly BookRow[], slots: number): Slot[] {
  return padSlots(bids, slots, "end");
}

/**
 * Цена группы: знаков ровно столько, сколько различает шаг.
 *
 * @remarks Тонкая обёртка над `formatPrice` из SDK — своей арифметики
 * форматирования не заводим. `$`-префикс гасится: он уже стоит в заголовке
 * колонки книги, дублировать его на каждой строке незачем. `tickDecimals`
 * принимает брендированный `Price`, а не голый `bigint`; здесь единственное
 * место, где это приводится — конструктором бренда, а не кастом — дальше по
 * модулю приведение не тащим.
 */
export function fmtBookPrice(price: bigint, tick: bigint): string {
  const decimals = tickDecimals(Price(tick));
  return formatPrice(price, {
    sign: "",
    minDecimals: decimals,
    maxDecimals: decimals,
  });
}

/**
 * Объём уровня: мелкий показывается подробнее крупного.
 *
 * @remarks Разрядность — доменное решение (объём меньше единицы заслуживает
 * больше значащих цифр, чем объём в десятки и сотни), поэтому шаг принятия
 * решения остаётся здесь; собственно печать бренда делегирована `formatQty`
 * из SDK. SDK усекает дробную часть, а не округляет — то же соглашение, что
 * и у `wadToFixed` в этом репозитории: показанный объём не должен читаться
 * как больший, чем есть на самом деле.
 */
export function fmtBookSize(size: bigint): string {
  const decimals = wadToNumber(size) < 1 ? 5 : 2;
  return formatQty(size, { minDecimals: decimals, maxDecimals: decimals });
}

/**
 * Кумулятив: выше порога сжимается суффиксом, иначе печатается как есть.
 *
 * @remarks Порог и суффиксы (`K`/`M`/…) — поведение `formatQty` c
 * `compact: true` из SDK, своего порога здесь больше нет.
 */
export function fmtBookTotal(total: bigint): string {
  return formatQty(total, { compact: true });
}

/**
 * Ширина полосы глубины в процентах.
 *
 * @remarks Знаменатель — максимум по показанным строкам обеих сторон
 * (`BookSnapshot.maxTotal`): общая шкала и есть то, что делает перевес
 * читаемым. Нулевой максимум означает пустую книгу — полосы нет.
 */
export function barPct(total: bigint, maxTotal: bigint): number {
  if (maxTotal <= 0n) return 0;
  return Math.min(100, Number((total * 100n) / maxTotal));
}

/**
 * Доля бидов в процентах, усечённая до целого.
 *
 * @remarks `null` приходит, когда сторон нет вовсе; перевеса в этом случае
 * тоже нет, и половина честнее нуля, который читался бы как «все продают».
 * Усечение, а не округление: `(ratio * 100n) / 10n ** 18n` — целочисленное
 * деление bigint, оно уже отбросило дробную часть до того, как значение
 * попало в `Number`, так что `Math.round` поверх него был мёртвым кодом —
 * округлять там было уже нечего. Для строки спреда, где сотые доли процента
 * важны, эта функция не годится — там печатает `formatRatio` из SDK.
 */
export function ratioPct(ratio: bigint | null): number {
  if (ratio === null) return 50;
  return Number((ratio * 100n) / 10n ** 18n);
}

/** Базовый актив рынка: `ETH-PERP` → `ETH`. Без рынка — пустая строка. */
export function baseSymbolOf(symbol: string | undefined): string {
  return symbol?.split(/[-/]/)[0]?.toUpperCase() ?? "";
}

/**
 * Время строки ленты сделок: часы:минуты:секунды, местное время зрителя.
 *
 * @remarks Местное, а не UTC: соседняя `HistoryTable` на этом же экране тоже
 * печатает время сделки через `toLocaleTimeString`, и лента в UTC рядом с
 * историей в местном была бы двумя разными часами на одном экране. Совпадает
 * при этом только часовой пояс, но не вид: `HistoryTable` зовёт
 * `toLocaleTimeString()` без опций — это 12-часовой формат с AM/PM, — а здесь
 * стоит `hour12: false`. Свести оба к одному виду — работа Ф3, которая эти
 * таблицы переписывает; до тех пор расхождение известное, а не случайное.
 * Готовое форматирование браузера, не свой `padStart` по `getUTC*` — как и по
 * всей арке. Детерминированность для тестов идёт не отсюда: e2e пришпиливает
 * `timezoneId: "UTC"` в `playwright.config.ts` и там же проверяет конкретное
 * значение (`21-trades-tape.spec.ts`); юнит-тест на этот файл проверяет только
 * форму строки — значение зависит от TZ машины, на которой идёт vitest.
 */
export function fmtTapeTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
