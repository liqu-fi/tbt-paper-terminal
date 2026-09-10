import { formatUsd } from "@liq/core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DecimalInput } from "../../components/ui/DecimalInput";
import type { SizeUnit } from "./useOrderSizing";

/**
 * Количество ордера: значение, выбор единиц и пересчёт под полем.
 *
 * @remarks
 * Пересчёт считается от МАРКА, а не от введённой цены ордера: строка отвечает
 * на «сколько это стоит сейчас», а не «сколько я предлагаю». В макете это
 * видно числом — `1 ETH` при цене ордера `2446.07` подписан как `≈ 2 440.00`,
 * то есть маркой из шапки.
 *
 * Пусто, когда пересчитывать нечем: числа, которого не из чего получить, здесь
 * быть не должно.
 *
 * @param quoteSymbol - имя единицы САМОГО ПОЛЯ (в чём набирается количество),
 *   а не расчётного токена контура. Валюту расчётов терминалу назвать нечем —
 *   рынок котировочного символа не отдаёт.
 */
export function QuantityField({
  value,
  onChange,
  unit,
  onUnit,
  baseSymbol,
  quoteSymbol,
  notional,
  invalid,
  unitDisabled,
}: {
  value: string;
  onChange: (v: string) => void;
  unit: SizeUnit;
  onUnit: (u: SizeUnit) => void;
  baseSymbol: string;
  quoteSymbol: string;
  /** Объём по марку, 18 знаков; `0n` — пересчитывать нечем. */
  notional: bigint;
  invalid?: boolean;
  /** Нет марка — конвертировать между единицами нечем. */
  unitDisabled?: boolean;
}) {
  const base = baseSymbol || "BASE";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[10px] uppercase text-muted">Quantity</label>
        <Select
          value={unit}
          onValueChange={(v) => onUnit(v as SizeUnit)}
          disabled={unitDisabled}
        >
          <SelectTrigger
            className="h-6 w-auto gap-1 border-0 bg-transparent px-1 text-[10px] text-muted"
            data-testid="size-unit-select"
          >
            <SelectValue>{unit === "base" ? base : quoteSymbol}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="base" data-testid="size-unit-base">
              {base}
            </SelectItem>
            <SelectItem value="usd" data-testid="size-unit-usd">
              {quoteSymbol}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DecimalInput
        value={value}
        onValueChange={onChange}
        maxDecimals={unit === "base" ? 8 : 2}
        invalid={invalid}
        placeholder="0.00"
        data-testid="size-input"
      />
      <div
        className="mt-1 text-right text-[10px] text-muted"
        data-testid="size-quote-value"
      >
        {/* `fmtUsd` уже ставит `$` — второй раз называть единицу нечем и незачем. */}
        {notional > 0n ? `≈ ${formatUsd(notional)}` : ""}
      </div>
    </div>
  );
}
