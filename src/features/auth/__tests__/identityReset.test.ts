import { describe, expect, it } from "vitest";

import { identityResetReason } from "../identityReset";

const NONE = { tokenAddress: null, wagmiAddress: null };

describe("identityResetReason", () => {
  it("первое появление личности — не смена", () => {
    expect(identityResetReason({ prev: null, next: "sub-1", ...NONE })).toBeNull();
  });

  it("смена личности роняет сессию", () => {
    expect(identityResetReason({ prev: "sub-1", next: "sub-2", ...NONE })).toBe(
      "identity-changed",
    );
  });

  it("выход — тоже смена личности", () => {
    expect(identityResetReason({ prev: "sub-1", next: null, ...NONE })).toBe(
      "identity-changed",
    );
  });

  it("та же личность без токена — сбрасывать нечего", () => {
    expect(identityResetReason({ prev: "sub-1", next: "sub-1", ...NONE })).toBeNull();
  });

  it("токен от другого кошелька роняет сессию", () => {
    expect(
      identityResetReason({
        prev: "sub-1",
        next: "sub-1",
        tokenAddress: "0xaaa",
        wagmiAddress: "0xbbb",
      }),
    ).toBe("token-address-mismatch");
  });

  it("регистр адреса не создаёт рассинхрона", () => {
    expect(
      identityResetReason({
        prev: "sub-1",
        next: "sub-1",
        tokenAddress: "0xAbC",
        wagmiAddress: "0xabc",
      }),
    ).toBeNull();
  });

  it("токен при ещё не подключённом wagmi — не рассинхрон", () => {
    expect(
      identityResetReason({
        prev: "sub-1",
        next: "sub-1",
        tokenAddress: "0xaaa",
        wagmiAddress: null,
      }),
    ).toBeNull();
  });

  it("смена личности старше проверки адреса", () => {
    expect(
      identityResetReason({
        prev: "sub-1",
        next: "sub-2",
        tokenAddress: "0xaaa",
        wagmiAddress: "0xaaa",
      }),
    ).toBe("identity-changed");
  });
});
