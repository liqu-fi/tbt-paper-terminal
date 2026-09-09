import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { leverageSteps } from "./leverageSteps";

/**
 * Выбор плеча — правый край строки табов тикета.
 *
 * @remarks
 * Макет ставит рядом вторую пилюлю — `Cross ▾`. Она не рисуется: режима маржи
 * в API нет, и переключатель, который ничего не переключает, обещает
 * возможность, которой у площадки нет.
 *
 * Доступной маржи здесь тоже нет: то же число уже стоит в шапке рынка
 * (`margin …`) рядом с Deposit/Withdraw, и второй экземпляр под другой
 * подписью читался как другая величина.
 */
export function TicketHeader({
  leverage,
  maxLeverage,
  onLeverage,
}: {
  leverage: number;
  /** Потолок плеча рынка; `null` — рынок его не объявил. */
  maxLeverage: number | null;
  onLeverage: (l: number) => void;
}) {
  return (
    <div className="ml-auto flex shrink-0 items-center text-[11px]">
      <Select
        value={String(leverage)}
        onValueChange={(v) => onLeverage(Number(v))}
      >
        <SelectTrigger
          className="h-7 w-auto shrink-0 gap-1 rounded-full bg-surface-2 px-3 text-[11px]"
          data-testid="leverage-select"
        >
          <SelectValue data-testid="leverage-value">{leverage}×</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {leverageSteps(maxLeverage).map((l) => (
            <SelectItem
              key={l}
              value={String(l)}
              data-testid={`leverage-option-${l}`}
            >
              {l}×
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
