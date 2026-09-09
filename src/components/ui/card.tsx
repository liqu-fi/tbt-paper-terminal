import * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-[var(--radius-card)] border bg-surface text-text",
        className,
      )}
      {...props}
    />
  );
}

export { Card };
