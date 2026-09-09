import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Панель сетки терминала.
 *
 * @remarks Без своей рамки и скругления: панели стоят вплотную, единственная
 * линия между ними — ручка ресайза, а рамка со скруглением одна на всю сетку
 * (`Terminal`). Своя рамка у каждой панели складывалась с линией ручки в
 * трёхслойный шов и давала «зазубрины» скруглений на каждом стыке.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("bg-surface text-text", className)}
      {...props}
    />
  );
}

export { Card };
