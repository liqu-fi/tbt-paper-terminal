import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-sm)] text-sm font-semibold whitespace-nowrap transition-all outline-none focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed aria-invalid:border-short aria-invalid:ring-short/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Прежний `primary` был умолчанием и красился в `bg-accent`: восемь
        // вызовов не передают variant вовсе, и подмена на shadcn-овский
        // `bg-primary` (токена с таким именем в теме нет) стёрла бы им фон.
        default: "bg-accent text-white hover:bg-accent/90",
        long: "bg-long text-[#06281d] hover:bg-long/90",
        short: "bg-short text-white hover:bg-short/90",
        // Вариант с этим именем есть и в shadcn, но выглядит иначе; молчаливая
        // подмена изменила бы вид трёх кнопок. Классы прежние, дословно.
        ghost: "bg-surface-2 text-muted border border-border hover:text-text",
        outline: "border border-border bg-transparent hover:bg-surface-2",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button };
