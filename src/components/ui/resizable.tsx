import { GripVerticalIcon } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

function ResizablePanelGroup({
  className,
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        // `min-h-0`/`min-w-0` — не косметика: вложенная группа (горизонтальная
        // внутри вертикальной) сама является flex-элементом и без них растёт
        // под свой контент вместо отведённого ей размера.
        "flex h-full w-full min-h-0 min-w-0 aria-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Панель группы.
 *
 * @remarks Библиотека рисует ДВА div-а: внешний (`data-panel`, несёт flex-размер
 * и жёстко зашитый инлайном `overflow: visible`) и внутренний, которому достаются
 * наши `className` и `style`. Отсюда разделение обязанностей:
 *
 * - внешнему `min-height: 0` даёт правило `[data-panel]` в `index.css` — классом
 *   до него не дотянуться, а без него `min-height: auto` flex-элемента позволяет
 *   контенту распирать панель наружу, поверх соседей;
 * - внутреннему здесь ставится `overflow: hidden` СТИЛЕМ, а не классом: свой
 *   `overflow: auto` библиотека пишет инлайном, и класс его не перебьёт. Панель
 *   не прокручивается целиком — скроллом заведует та область внутри неё, которой
 *   он положен (форма ордера, тело таблицы).
 */
function ResizablePanel({
  className,
  style,
  ...props
}: ResizablePrimitive.PanelProps) {
  return (
    <ResizablePrimitive.Panel
      data-slot="resizable-panel"
      className={cn("flex min-h-0 min-w-0 flex-col", className)}
      style={{ overflow: "hidden", ...style }}
      {...props}
    />
  );
}

/**
 * Ручка ресайза — единственный шов между панелями.
 *
 * @remarks Три слоя, каждый со своей ролью:
 * - сам элемент — волосяная линия в 1px цвета рамки; это и есть граница
 *   панелей, у которых своей рамки нет (см. `Card`);
 * - `before` — подсветка в 3px акцентом, в покое невидима, проявляется при
 *   наведении и на всё время перетаскивания (`data-separator="active"` —
 *   состояние ставит библиотека, поэтому подсветка не гаснет, когда курсор
 *   во время драга уходит с линии);
 * - `after` — зона захвата в 9px, раскладку не двигает: промахнуться по
 *   линии мышью нельзя, а грип-бейдж показывается только под курсором —
 *   постоянный бейдж на каждом шве был шумом.
 *
 * Отключённая ручка (`disabled`) теряет курсор, подсветку и грип — мёртвая
 * зона не должна выглядеть живой.
 */
function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "group relative flex w-px cursor-col-resize items-center justify-center bg-border",
        "focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-hidden",
        // подсветка
        "before:absolute before:inset-y-0 before:left-1/2 before:z-10 before:w-[3px] before:-translate-x-1/2 before:bg-accent before:opacity-0 before:transition-opacity",
        "hover:before:opacity-100 data-[separator=active]:before:opacity-100",
        // зона захвата
        "after:absolute after:inset-y-0 after:left-1/2 after:w-[9px] after:-translate-x-1/2",
        // горизонтальная ориентация
        "aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:cursor-row-resize",
        "aria-[orientation=horizontal]:before:inset-x-0 aria-[orientation=horizontal]:before:inset-y-auto aria-[orientation=horizontal]:before:top-1/2 aria-[orientation=horizontal]:before:h-[3px] aria-[orientation=horizontal]:before:w-full aria-[orientation=horizontal]:before:translate-x-0 aria-[orientation=horizontal]:before:-translate-y-1/2",
        "aria-[orientation=horizontal]:after:inset-x-0 aria-[orientation=horizontal]:after:inset-y-auto aria-[orientation=horizontal]:after:top-1/2 aria-[orientation=horizontal]:after:h-[9px] aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2",
        "[&[aria-orientation=horizontal]>div]:rotate-90",
        // отключённая
        "data-[disabled]:cursor-default data-[disabled]:before:hidden data-[disabled]:[&>div]:hidden",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-20 flex h-4 w-3 items-center justify-center rounded-xs border bg-border opacity-0 transition-opacity group-hover:opacity-100 group-data-[separator=active]:opacity-100">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
