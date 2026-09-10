import { Price } from "@liq/sdk";
import { describe, expect, it } from "vitest";

import {
  fmtLeverage,
  fmtPrice,
  fmtSignedPct,
  fmtSignedUsd,
  parseOrZero,
} from "@/lib/format";

const WAD = 10n ** 18n;

describe("обёртки над форматтерами SDK", () => {
  it("fmtPrice: без `$`, без обязательных копеек, с разрядами", () => {
    expect(fmtPrice(69_900n * WAD)).toBe("69,900");
    expect(fmtPrice((12_345n * WAD) / 10n)).toBe("1,234.5");
  });

  it("fmtSignedUsd: плюс дописан, минус от SDK", () => {
    expect(fmtSignedUsd(100n * WAD)).toBe("+$100.00");
    expect(fmtSignedUsd(-1234n * WAD)).toBe("-$1,234.00");
  });

  it("fmtSignedPct: WAD-доля со знаком", () => {
    expect(fmtSignedPct((123n * WAD) / 10_000n)).toBe("+1.23%");
    expect(fmtSignedPct((-5n * WAD) / 100n)).toBe("-5.00%");
  });

  it("fmtLeverage: целое без дроби, дробное до десятых", () => {
    expect(fmtLeverage(10n * WAD)).toBe("10x");
    expect(fmtLeverage((35n * WAD) / 10n)).toBe("3.5x");
  });

  it("parseOrZero: пусто и мусор — ноль, число — число", () => {
    expect(parseOrZero(Price.parse, "")).toBe(0n);
    expect(parseOrZero(Price.parse, "abc")).toBe(0n);
    expect(parseOrZero(Price.parse, "1.5")).toBe((15n * WAD) / 10n);
  });
});
