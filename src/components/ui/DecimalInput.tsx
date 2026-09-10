import { sanitizeDecimal } from "@liq/core";
import type { InputHTMLAttributes, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "type"
> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Max fractional digits accepted (default 6). */
  maxDecimals?: number;
  /** Marks the field as invalid (red ring + `aria-invalid`). */
  invalid?: boolean;
  /** Trailing in-field affordance — unit toggle, Max button, asset symbol. */
  rightSlot?: ReactNode;
};

/**
 * A validated money/quantity input. Wraps the visual `Input` look, rejects
 * non-numeric keystrokes via {@link sanitizeDecimal}, and renders an optional
 * trailing slot (unit toggle / Max). Controlled: owns no state.
 */
export function DecimalInput({
  value,
  onValueChange,
  maxDecimals = 6,
  invalid = false,
  rightSlot,
  className = "",
  ...props
}: Props) {
  return (
    <div className="relative flex items-center">
      <Input
        inputMode="decimal"
        autoComplete="off"
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) =>
          onValueChange(sanitizeDecimal(e.target.value, maxDecimals))
        }
        className={cn(
          invalid ? "border-short" : "border-border",
          rightSlot && "pr-16",
          className,
        )}
        {...props}
      />
      {rightSlot && (
        <div className="absolute right-1.5 flex items-center gap-1">
          {rightSlot}
        </div>
      )}
    </div>
  );
}
