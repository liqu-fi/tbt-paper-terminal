import { Maximize2, Minimize2 } from "lucide-react";
import { useState } from "react";

import { ToolbarSlotContext } from "@/components/data-table/ToolbarSlotContext";
import { Card } from "@/components/ui/card";
import { useTerminalUiStore } from "@/stores/useTerminalUiStore";

import { AccountHistoryTable } from "../history/AccountHistoryTable";
import { FundingHistoryTable } from "../history/FundingHistoryTable";
import { PositionHistoryTable } from "../history/PositionHistoryTable";
import { TradeHistoryTable } from "../history/TradeHistoryTable";
import { OpenOrdersTable } from "../orders/OpenOrdersTable";
import { OrderHistoryTable } from "../orders/OrderHistoryTable";
import { useOpenOrderRows } from "../orders/useOpenOrderRows";
import { PositionsTable } from "../positions/PositionsTable";
import { USER_TABS, type UserTabSlug } from "./tabs";
import { useLiveOrders } from "./useLiveOrders";

export function UserInfoTabs({
  fullscreenToggle = true,
}: {
  /** `false` — там, где фуллскрин нижней панели не существует (телефон). */
  fullscreenToggle?: boolean;
} = {}) {
  useLiveOrders(); // SSE subscription side-effect
  const [tab, setTab] = useState<UserTabSlug>("positions");
  // Элемент, а не ref: портал должен перерисоваться, когда узел появится, а
  // изменение ref-объекта рендер не запускает — таблица нарисовала бы тулбар
  // мимо слота на первом проходе и осталась бы так навсегда.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const bottomFullscreen = useTerminalUiStore((s) => s.bottomFullscreen);
  const toggleBottomFullscreen = useTerminalUiStore(
    (s) => s.toggleBottomFullscreen,
  );
  // Бейдж считает ЗАГРУЖЕННЫЕ строки, а не всё, что есть на шлюзе: `orders.count`
  // отдельным запросом здесь не зовётся, а полная страница неотличима от
  // обрезанной. Для нынешнего лимита это одно и то же число.
  const { rows: openOrderRows } = useOpenOrderRows();

  const fullscreenButton = (
    <button
      type="button"
      onClick={toggleBottomFullscreen}
      data-testid="bottom-fullscreen-toggle"
      aria-label={bottomFullscreen ? "Свернуть панель" : "Развернуть панель"}
      className="shrink-0 text-muted hover:text-text"
    >
      {bottomFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </button>
  );

  return (
    <Card
      className="flex min-h-0 flex-1 flex-col overflow-hidden p-2.5"
      data-testid="userinfo"
    >
      {/* Строка вкладок не сжимается и не переносится: на узком экране она
          прокручивается по горизонтали, а не съедает высоту таблицы вторым
          рядом. `shrink-0` — потому что таблица под ней растяжимая. */}
      <div className="mb-2 flex shrink-0 items-center gap-4 overflow-x-auto border-b border-border pb-2 text-sm">
        {USER_TABS.map((t) => (
          <button
            key={t.slug}
            onClick={() => setTab(t.slug)}
            data-testid={`userinfo-tab-${t.slug}`}
            aria-pressed={tab === t.slug}
            className={`shrink-0 whitespace-nowrap ${
              tab === t.slug ? "font-semibold text-text" : "text-muted"
            }`}
          >
            {t.label}
            {t.slug === "open-orders" && openOrderRows.length > 0 && (
              <span
                className="ml-1 rounded-sm bg-surface-2 px-1 text-[11px] text-muted"
                data-testid="userinfo-tab-badge-open-orders"
              >
                {openOrderRows.length}
              </span>
            )}
          </button>
        ))}
        <div className="min-w-2 flex-1" />
        {/* Слот тулбара активной таблицы; фуллскрин — рядом, а не внутри:
            он принадлежит панели и обязан быть виден на любой вкладке,
            в том числе на той, чья таблица ещё не смонтирована. */}
        <div ref={setSlot} className="flex shrink-0 items-center gap-2" />
        {fullscreenToggle && fullscreenButton}
      </div>
      <ToolbarSlotContext.Provider value={slot}>
        {tab === "positions" && <PositionsTable />}
        {tab === "open-orders" && <OpenOrdersTable />}
        {tab === "trade-history" && <TradeHistoryTable />}
        {tab === "order-history" && <OrderHistoryTable />}
        {tab === "position-history" && <PositionHistoryTable />}
        {tab === "funding-history" && <FundingHistoryTable />}
        {tab === "account-history" && <AccountHistoryTable />}
      </ToolbarSlotContext.Provider>
    </Card>
  );
}
