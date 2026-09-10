import { Columns3, Filter } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ALL_MARKETS } from "./features";

/** Что тулбару нужно знать о колонке — ровно столько и ничего больше. */
interface ToolbarColumn {
  id: string;
  label: string;
  visible: boolean;
  canHide: boolean;
  toggle: () => void;
}

interface ToolbarMarket {
  id: string;
  symbol: string;
}

export function DataTableToolbar({
  columns,
  markets,
  market,
  onMarketChange,
}: {
  columns: ToolbarColumn[];
  markets: ToolbarMarket[];
  market: string;
  onMarketChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2" data-testid="table-toolbar">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="text-muted hover:text-text data-[state=open]:text-text"
          aria-label="Видимость колонок"
          data-testid="table-columns-button"
        >
          <Columns3 size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" data-testid="table-columns-menu">
          {columns.map((c) => (
            <DropdownMenuCheckboxItem
              key={c.id}
              checked={c.visible}
              disabled={!c.canHide}
              onCheckedChange={c.toggle}
              onSelect={(e) => e.preventDefault()}
              data-testid={`table-column-toggle-${c.id}`}
            >
              {c.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          className={
            market === ALL_MARKETS
              ? "text-muted hover:text-text"
              : "text-accent"
          }
          aria-label="Фильтр по рынку"
          data-testid="table-filter-button"
        >
          <Filter size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" data-testid="table-filter-menu">
          <DropdownMenuRadioGroup value={market} onValueChange={onMarketChange}>
            <DropdownMenuRadioItem
              value={ALL_MARKETS}
              data-testid="table-filter-option-all"
            >
              All markets
            </DropdownMenuRadioItem>
            {markets.map((m) => (
              <DropdownMenuRadioItem
                key={m.id}
                value={m.id}
                data-testid={`table-filter-option-${m.id}`}
              >
                {m.symbol}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
