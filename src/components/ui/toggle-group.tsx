import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

// shadcn-словарь заменён нашим:
//   hover:bg-muted hover:text-muted-foreground → hover:bg-surface-2 hover:text-text
//     (та же пара, что в TabsTrigger: неактивный элемент светлеет на hover)
//   focus-visible:border-ring / ring-ring → focus-visible:border-accent / ring-accent
//     (border-ring и ring-ring — токенов с такими именами в теме терминала нет;
//      замена дословно как в button.tsx)
//   aria-invalid:border-destructive / ring-destructive → …-short (нет brand
//     "destructive", у терминала это "short" — тот же цвет, что в button.tsx)
//   data-[state=on]:bg-accent/text-accent-foreground → bg-surface/text-text
//     ("accent" в shadcn — нейтральная подсветка, а не бренд-синий; выбранное
//     состояние сегмента здесь ведёт себя как активный таб — bg-surface, а не
//     заливка бренд-цветом)
//   dark:aria-invalid:ring-destructive/40 — убран: у терминала одна тёмная
//     тема через CSS-переменные, класса `.dark` в разметке не бывает
//
// Классы жили в отдельном `toggle.tsx` как словарь `cva` с осями `variant`
// (default/outline) и `size` (default/sm/lg). Ни одну из них не передавал ни
// один вызов — ни снаружи, ни через контекст группы, — поэтому от словаря
// осталась одна строка, и ей незачем быть отдельным модулем: одиночного
// `Toggle` в терминале нет, сегменты книги строит `ToggleGroupItem` ниже.
const ITEM =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-surface-2 hover:text-text focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-short aria-invalid:ring-short/20 data-[state=on]:bg-surface data-[state=on]:text-text bg-transparent h-9 min-w-9 px-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

function ToggleGroup({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn("flex w-fit items-center rounded-md", className)}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  );
}

// Сегменты стоят вплотную и скругляются только по краям группы — прежний
// шаблон выражал это через `data-[spacing=0]`, где `spacing` всегда был нулём.
function ToggleGroupItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        ITEM,
        "w-auto min-w-0 shrink-0 rounded-none px-3 shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10",
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem };
