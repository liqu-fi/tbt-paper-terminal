import { SessionGate } from "./features/auth/SessionGate";
import { ConnectButton } from "./features/wallet/ConnectButton";
import { MarketProvider } from "./features/market/MarketContext";
import { Terminal } from "./features/terminal/Terminal";

/**
 * Оболочка экрана.
 *
 * @remarks `h-full` + `min-h-0` по всей цепочке до панелей: терминал делит
 * ИМЕЮЩУЮСЯ высоту окна, а не растёт под свой контент. `min-h-[600px]` — предел,
 * ниже которого делить уже нечего: вместо схлопывания панелей до нечитаемых
 * полосок страница отдаёт вертикальный скролл.
 */
export default function App() {
  return (
    <MarketProvider>
      <div
        className="flex h-full min-h-[600px] flex-col"
        data-testid="app-root"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface-2 px-4 py-1.5">
          <span className="font-bold tracking-wide" data-testid="app-brand">
            ◢ terminal
          </span>
          <div className="flex-1" />
          <ConnectButton />
        </header>
        <main className="flex min-h-0 flex-1 flex-col p-2">
          <SessionGate>
            <Terminal />
          </SessionGate>
        </main>
      </div>
    </MarketProvider>
  );
}
