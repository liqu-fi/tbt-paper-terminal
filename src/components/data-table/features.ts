import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table";

/**
 * Значение фильтра «рынок не выбран».
 *
 * @remarks Отдельная строка, а не `undefined`: radix `DropdownMenuRadioGroup`
 * хранит выбор строкой и пустую строку считает «ничего не выбрано», из-за чего
 * пункт «все рынки» не подсвечивался бы как активный.
 */
export const ALL_MARKETS = "all";

/**
 * Набор возможностей таблицы. В v9 фичи регистрируются явно: без
 * `rowSortingFeature` у колонки нет ни `getIsSorted`, ни `getToggleSortingHandler`,
 * и отсутствие метода читается как ошибка типов, а не как незарегистрированная фича.
 */
export const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnVisibilityFeature,
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  sortFns,
});

/**
 * Общий предикат фильтра по рынку.
 *
 * @remarks Один на все семь таблиц: рынок — единственное измерение, которое есть
 * в каждой из них, и фильтр обязан значить в них одно и то же. Сравнение
 * строковое, потому что `marketId` доезжает в строках `bigint`-ом (позиции) и
 * строкой (ордера, сделки, леджер).
 */
export function marketFilterFn(rowMarketId: string, filter: unknown): boolean {
  if (filter === undefined || filter === null) return true;
  const wanted = String(filter);
  if (wanted === "" || wanted === ALL_MARKETS) return true;
  return rowMarketId === wanted;
}
