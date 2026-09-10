import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Переключатель токена коллатерала для диалогов депозита и вывода. Рисуется
 * только когда у контура есть из чего выбирать (staging: USDC | USDm).
 */
export function CollateralTabs({
  symbols,
  value,
  onChange,
  testIdPrefix,
}: {
  symbols: string[];
  value: string;
  onChange: (symbol: string) => void;
  testIdPrefix: string;
}) {
  if (symbols.length < 2) return null;
  return (
    <Tabs value={value} onValueChange={onChange} className="mb-2">
      <TabsList className="h-7 w-full">
        {symbols.map((s) => (
          <TabsTrigger
            key={s}
            value={s}
            className="text-xs"
            data-testid={`${testIdPrefix}-token-${s}`}
          >
            {s}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
