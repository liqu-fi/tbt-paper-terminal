import { maxBarsPerRequest, ORACLE_INTERVALS } from "@liq/core";

import { useTerminalUiStore } from "@/stores/useTerminalUiStore";

import { CandleChart, CHART_ROUTE } from "./CandleChart";

function Control({
  testid,
  active,
  onClick,
  children,
}: {
  testid: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      data-active={active ? "true" : "false"}
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 text-[11px] ${
        active ? "bg-surface-2 text-text" : "text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Рамка чарта: одна строка — интервал бара слева, шкала справа.
 *
 * @remarks
 * Окна («1D…1Y») нет: история листается прокруткой чарта, а грузится сразу
 * столько баров, сколько маршрут отдаёт за запрос (`maxBarsPerRequest`) — для
 * минуты это сутки, для часа два месяца, для дня четыре года. Второй ряд
 * кнопок читался как дубль первого, и глубже потолка маршрута он всё равно
 * не заглядывал.
 *
 * Кнопки `1s` нет — минимальный интервал обоих маршрутов минута, и кнопка,
 * которая не может показать секунды, обещала бы их.
 */
export function ChartFrame({
  marketId,
  actions,
}: {
  marketId: bigint | undefined;
  /** Управление рамкой от владельца — сейчас кнопка свёртки колонки. */
  actions?: React.ReactNode;
}) {
  const interval = useTerminalUiStore((s) => s.chartInterval);
  const scaleMode = useTerminalUiStore((s) => s.chartScaleMode);
  const autoScale = useTerminalUiStore((s) => s.chartAutoScale);
  const setChartInterval = useTerminalUiStore((s) => s.setChartInterval);
  const setChartScaleMode = useTerminalUiStore((s) => s.setChartScaleMode);
  const toggleAutoScale = useTerminalUiStore((s) => s.toggleAutoScale);

  return (
    <div className="flex h-full min-h-0 flex-col gap-1" data-testid="chart-frame">
      <div className="flex items-center gap-1">
        {ORACLE_INTERVALS.map((iv) => (
          <Control
            key={iv}
            testid={`chart-interval-${iv}`}
            active={iv === interval}
            onClick={() => setChartInterval(iv)}
          >
            {iv}
          </Control>
        ))}
        <div className="flex-1" />
        <Control
          testid="chart-scale-percent"
          active={scaleMode === "percent"}
          onClick={() => setChartScaleMode("percent")}
        >
          %
        </Control>
        <Control
          testid="chart-scale-log"
          active={scaleMode === "log"}
          onClick={() => setChartScaleMode("log")}
        >
          log
        </Control>
        <Control
          testid="chart-scale-auto"
          active={autoScale}
          onClick={toggleAutoScale}
        >
          auto
        </Control>
        {actions ? <div className="ml-1 flex items-center">{actions}</div> : null}
      </div>
      <div className="min-h-0 flex-1">
        <CandleChart
          marketId={marketId}
          interval={interval}
          bars={maxBarsPerRequest(interval, CHART_ROUTE)}
          scaleMode={scaleMode}
          autoScale={autoScale}
        />
      </div>
    </div>
  );
}
