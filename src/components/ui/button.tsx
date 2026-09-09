import * as React from "react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-sm)] h-9 px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all outline-none focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed aria-invalid:border-short aria-invalid:ring-short/20 has-[>svg]:px-3 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

/**
 * Раскраска кнопки. Обычный объект вместо `cva`: осей вариантов осталась одна,
 * значений в ней четыре, и выбор — это индексация словаря.
 *
 * @remarks Ось `size` из шаблона shadcn (восемь значений) снята целиком: её не
 * передавал ни один вызов, а высота кнопки одна на весь терминал и уехала в
 * `BASE`. Оттуда же выброшены `outline` и `link` — тоже ни одного вызова.
 * `default` красится в `bg-accent`: восемь вызовов не передают `variant` вовсе.
 */
const VARIANTS = {
  default: "bg-accent text-white hover:bg-accent/90",
  long: "bg-long text-[#06281d] hover:bg-long/90",
  short: "bg-short text-white hover:bg-short/90",
  // Вариант с этим именем есть и в shadcn, но выглядит иначе; молчаливая
  // подмена изменила бы вид трёх кнопок. Классы прежние, дословно.
  ghost: "bg-surface-2 text-muted border border-border hover:text-text",
} as const;

function Button({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(BASE, VARIANTS[variant], className)}
      {...props}
    />
  );
}

export { Button };
