import type { OracleCandleInterval } from "@liq/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Окно чарта — ключи нижнего ряда рамки. */
export type ChartRangeKey = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y";

/**
 * Режим ценовой шкалы.
 *
 * @remarks Одно поле, а не два флага: `%` и `log` — два значения одного
 * `PriceScaleMode` в lightweight-charts, одновременно их не бывает.
 */
export type ChartScaleMode = "normal" | "percent" | "log";

interface TerminalUiState {
  /** Свёрнут ли чарт — раскладка Frame-12. */
  chartCollapsed: boolean;
  /** Нижняя панель на весь экран — раскладка Frame-13. */
  bottomFullscreen: boolean;
  /**
   * Рынки, отмеченные звездой.
   *
   * @remarks Идентификаторы строками: стор персистится, а `bigint` не
   * переживает `JSON.stringify`.
   */
  favoriteMarkets: string[];
  chartInterval: OracleCandleInterval;
  chartRange: ChartRangeKey;
  chartScaleMode: ChartScaleMode;
  chartAutoScale: boolean;
}

interface TerminalUiActions {
  toggleChart: () => void;
  toggleBottomFullscreen: () => void;
  toggleFavorite: (marketId: string) => void;
  setChartInterval: (interval: OracleCandleInterval) => void;
  setChartRange: (range: ChartRangeKey) => void;
  setChartScaleMode: (mode: ChartScaleMode) => void;
  toggleAutoScale: () => void;
  reset: () => void;
}

const INITIAL: TerminalUiState = {
  chartCollapsed: false,
  bottomFullscreen: false,
  favoriteMarkets: [],
  chartInterval: "1h",
  chartRange: "1D",
  chartScaleMode: "normal",
  chartAutoScale: true,
};

/**
 * Состояние экрана — то, чего нет и не должно быть в SDK: что свёрнуто, что
 * развёрнуто. Персистится, потому что раскладка терминала — настройка рабочего
 * места, а не сессии.
 *
 * @remarks Состояние ордера сюда не кладётся: им владеет `useTradeStore`
 * из `@liq/react`.
 */
export const useTerminalUiStore = create<TerminalUiState & TerminalUiActions>()(
  persist(
    (set) => ({
      ...INITIAL,
      toggleChart: () => set((s) => ({ chartCollapsed: !s.chartCollapsed })),
      toggleBottomFullscreen: () =>
        set((s) => ({ bottomFullscreen: !s.bottomFullscreen })),
      toggleFavorite: (marketId) =>
        set((s) => ({
          favoriteMarkets: s.favoriteMarkets.includes(marketId)
            ? s.favoriteMarkets.filter((id) => id !== marketId)
            : [...s.favoriteMarkets, marketId],
        })),
      setChartInterval: (chartInterval) => set({ chartInterval }),
      setChartRange: (chartRange) => set({ chartRange }),
      setChartScaleMode: (mode) =>
        set((s) => ({
          // Повторный клик по включённому режиму возвращает обычную шкалу:
          // третьей кнопки «normal» в макете нет, а выйти из режима надо.
          chartScaleMode: s.chartScaleMode === mode ? "normal" : mode,
        })),
      toggleAutoScale: () => set((s) => ({ chartAutoScale: !s.chartAutoScale })),
      reset: () => set({ ...INITIAL }),
    }),
    {
      name: "terminal-ui",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
