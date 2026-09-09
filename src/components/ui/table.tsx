import * as React from "react";

import { cn } from "@/lib/utils";

// shadcn-словарь заменён нашим, дословно:
//   text-muted-foreground → text-muted   (подписи шапки)
//   bg-muted/50, data-[state=selected]:bg-muted → bg-surface-2
//     (в словаре shadcn `muted` — нейтральная подложка, у нас этот тон занят
//      под «выделено/нажато»: тем же bg-surface-2 красит активный таб TabsList)
//   border-b/border-t у строк оставлены голыми: базовый слой в index.css
//     красит любую границу в var(--border), поэтому цвет называть не нужно.

function Table({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<"table"> & {
  /**
   * Классы прокручиваемой обёртки таблицы.
   *
   * @remarks Скроллить обязана именно она, а не внешний div: липкая шапка
   * прилипает к ближайшему прокручиваемому предку, и пока вертикальный скролл
   * жил снаружи, `sticky` в `thead` был бы пустым обещанием — шапка уезжала бы
   * вместе со строками.
   */
  containerClassName?: string;
}) {
  return (
    <div
      data-slot="table-container"
      className={cn("relative w-full overflow-auto", containerClassName)}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        // Подложка обязательна: под липкой шапкой проезжают строки.
        "sticky top-0 z-10 bg-surface [&_tr]:border-b",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-surface-2 data-[state=selected]:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-8 px-2 text-left align-middle text-[11px] font-normal whitespace-nowrap text-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("p-2 align-middle whitespace-nowrap", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
};
