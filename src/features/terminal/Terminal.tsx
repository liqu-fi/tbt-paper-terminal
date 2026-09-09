import { PanelBottomClose, PanelBottomOpen } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useTerminalUiStore } from "@/stores/useTerminalUiStore";

import { useMediaQuery } from "../../lib/useMediaQuery";

import { AccountPanel } from "../account/AccountPanel";
import { ChartFrame } from "../chart/ChartFrame";
import { MarketHeader } from "../market/MarketHeader";
import { useSelectedMarket } from "../market/useSelectedMarket";
import { OrderBookPanel } from "../orderbook/OrderBookPanel";
import { TradeForm } from "../trade/TradeForm";
import { UserInfoTabs } from "../userinfo/UserInfoTabs";

// react-resizable-panels@4 treats a numeric `defaultSize`/`minSize`/`maxSize`
// as PIXELS (see the library's `PanelProps` doc comment) — a bare string is
// what means percent-of-group. Every size below is a string on purpose; only
// the collapsed chart-column strip is intentionally pixel-fixed ("Npx").
const CHART_STRIP_PX = "32px";

/**
 * Нижние границы колонок в пикселях, а не в процентах.
 *
 * @remarks Процент от группы на узком экране даёт колонку, в которую контент не
 * влезает по ширине: 14% от 1280px — это 179px на стакан из трёх числовых
 * колонок, а 20% — 256px на тикет, чьи кнопки Buy/Sell перестают помещаться
 * рядом. Пиксели держат нижнюю границу одинаковой на любом экране; выше неё
 * пользователь волен тянуть ручку как хочет.
 */
const CHART_MIN_PX = "320px";
// 260, а не 200: строка «Both | Bids | Asks | шаг» на 200px обрезала
// переключатель шага правым краем карточки; шаг вроде «0.001» шире «0.1».
const BOOK_MIN_PX = "260px";
const TICKET_MIN_PX = "300px";
// Правая колонка — в пикселях, а не в доле экрана: тикет шире ~400px не
// становится удобнее, только растягивает поля, а всё, что он не занял,
// достаётся чарту и историям.
const TICKET_DEFAULT_PX = "380px";
const TICKET_MAX_PX = "480px";
// Вложенные группы своих минимумов наружу не сообщают — левой колонке
// минимум задаётся руками как сумма чарта и стакана.
const LEFT_MIN_PX = "580px";
/** Одна рамка на всё — шапку рынка и сетку; панели внутри без своих (см. `Card`). */
const FRAME = "overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface";
/** Ниже — одна прокручиваемая колонка вместо сетки с ручками. */
const MOBILE = "(max-width: 767px)";

/**
 * Раскладка: слева чарт со стаканом над историями, справа — колонка тикета и
 * счёта на всю высоту. Нижняя панель заканчивается у правой колонки, а не
 * тянется под ней.
 */
export function Terminal() {
  const { marketId } = useSelectedMarket();
  const mobile = useMediaQuery(MOBILE);
  const chartCollapsed = useTerminalUiStore((s) => s.chartCollapsed);
  const bottomFullscreen = useTerminalUiStore((s) => s.bottomFullscreen);
  const toggleChart = useTerminalUiStore((s) => s.toggleChart);

  // Телефон: те же панели стопкой, прокрутка всей колонки. Чарту и стакану
  // высота задана явно — оба меряют себя от родителя (`autoSize`,
  // `useBookSlots`) и в потоке без неё схлопнулись бы в ноль. Свёртка чарта и
  // фуллскрин нижней панели здесь не имеют смысла и не рисуются.
  if (mobile) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[var(--radius-card)] border border-border bg-surface"
        data-testid="terminal-root"
      >
        <MarketHeader />
        <Card
          className="flex h-72 shrink-0 flex-col overflow-hidden p-2"
          data-testid="chart-panel"
        >
          <ChartFrame marketId={marketId} />
        </Card>
        <div className="shrink-0 border-t border-border">
          <TradeForm />
        </div>
        <AccountPanel />
        <div className="h-80 shrink-0 border-t border-border">
          <OrderBookPanel />
        </div>
        <div
          className="flex h-96 shrink-0 flex-col border-t border-border"
          data-testid="bottom-panel"
        >
          <UserInfoTabs fullscreenToggle={false} />
        </div>
      </div>
    );
  }

  const chartToggle = (
    <button
      type="button"
      onClick={toggleChart}
      data-testid="chart-collapse-toggle"
      aria-label={chartCollapsed ? "Развернуть чарт" : "Свернуть чарт"}
      className="text-muted hover:text-text"
    >
      {chartCollapsed ? (
        <PanelBottomOpen size={16} />
      ) : (
        <PanelBottomClose size={16} />
      )}
    </button>
  );

  const bottom = (
    <div className="flex h-full min-h-0 flex-col" data-testid="bottom-panel">
      <UserInfoTabs />
    </div>
  );

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${FRAME}`}
      data-testid="terminal-root"
    >
      {!bottomFullscreen && <MarketHeader />}
      {bottomFullscreen ? (
        // Весь экран — нижней панели: ни шапки рынка, ни чарта, ни тикета.
        bottom
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel id="left-column" minSize={LEFT_MIN_PX}>
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel id="chart-row" defaultSize="64" minSize="25">
                {/* Keyed by collapse state: `defaultSize`/`minSize`/`maxSize`
                    are only consulted when a panel first registers with the
                    group, so freeing the chart column's width on collapse
                    needs a fresh mount, not just a prop change. Remounting
                    (rather than the library's own `collapsible` +
                    `collapsedSize`) also means there is no drag-to-collapse
                    gesture to fall out of sync with `useTerminalUiStore` —
                    the store's boolean is the only thing that decides which
                    layout is mounted. Освободившаяся ширина достаётся стакану:
                    правая колонка — постоянная рейка на всю высоту, и её
                    ширина от чарта не зависит. */}
                <ResizablePanelGroup
                  key={chartCollapsed ? "chart-collapsed" : "chart-expanded"}
                  orientation="horizontal"
                >
                  <ResizablePanel
                    id="chart-column"
                    defaultSize={chartCollapsed ? CHART_STRIP_PX : "76"}
                    minSize={chartCollapsed ? CHART_STRIP_PX : CHART_MIN_PX}
                    maxSize={chartCollapsed ? CHART_STRIP_PX : undefined}
                  >
                    {chartCollapsed ? (
                      <div className="flex h-full justify-center pt-1">
                        {chartToggle}
                      </div>
                    ) : (
                      <Card
                        className="flex min-h-0 flex-1 flex-col overflow-hidden p-2"
                        data-testid="chart-panel"
                      >
                        {/* Кнопка свёртки живёт в строке интервалов чарта, а не
                            отдельным рядом над карточкой: своя строка съедала
                            ~28px высоты у самого высокого блока экрана ради
                            одной иконки. */}
                        <ChartFrame marketId={marketId} actions={chartToggle} />
                      </Card>
                    )}
                  </ResizablePanel>
                  {/* Locked to CHART_STRIP_PX on both sides while collapsed —
                      nothing to drag, so the handle is disabled rather than
                      left as a dead affordance. */}
                  <ResizableHandle withHandle disabled={chartCollapsed} />
                  <ResizablePanel
                    id="book-column"
                    defaultSize={chartCollapsed ? undefined : "24"}
                    minSize={BOOK_MIN_PX}
                  >
                    <OrderBookPanel />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel id="bottom-row" defaultSize="36" minSize="20">
                {bottom}
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="trade-column"
            defaultSize={TICKET_DEFAULT_PX}
            minSize={TICKET_MIN_PX}
            maxSize={TICKET_MAX_PX}
          >
            <div
              className="flex h-full min-h-0 flex-col"
              data-testid="trade-column"
            >
              {/* Тикет — по содержимому, счёт сразу под ним: растянутый на всю
                  высоту тикет оставлял провал между полями и кнопками. На
                  коротком экране тикет сжимается (`min-h-0`) и прокручивает
                  поля внутри себя, оставляя кнопки подачи на виду; карточка
                  счёта не сжимается. */}
              <div className="min-h-0">
                <TradeForm />
              </div>
              <AccountPanel />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}
