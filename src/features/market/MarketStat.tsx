import type { ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const VALUE = "text-xs font-semibold text-text tabular-nums";

/**
 * Одна ячейка шапки: подпись сверху, значение снизу.
 *
 * @param note - почему значение такое, какое есть. Тултип появляется только
 * там, где источника нет вовсе, — иначе прочерк читается как поломка.
 *
 * @remarks Триггер тултипа — сам span значения, а не обёртка вокруг него:
 * обёртка наследовала line-height шапки и делала ячейку с тултипом на 4px
 * выше соседних, и в `items-center` подписи разъезжались по высоте.
 */
export function MarketStat({
  label,
  testid,
  note,
  children,
}: {
  label: string;
  testid: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted">{label}</span>
      {note ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`${VALUE} cursor-help`} data-testid={testid}>
              {children}
            </span>
          </TooltipTrigger>
          <TooltipContent>{note}</TooltipContent>
        </Tooltip>
      ) : (
        <span className={VALUE} data-testid={testid}>
          {children}
        </span>
      )}
    </div>
  );
}
