import { describe, expect, it } from "vitest";

import { faucetRow, fmtRemaining } from "../faucetRow";

const ready = {
  enabled: true,
  registered: true,
  claimAmount: 400n,
  faucetBalance: 10_000n,
  nextClaimAt: 0n,
};

describe("faucetRow", () => {
  it("можно, когда токен включён, фаусет не пуст и кулдаун прошёл", () => {
    expect(faucetRow(ready, 1_000)).toEqual({ block: null, remainingSec: 0 });
  });

  it("кулдаун считается от nextClaimAt", () => {
    expect(faucetRow({ ...ready, nextClaimAt: 1_600n }, 1_000)).toEqual({
      block: "cooldown",
      remainingSec: 600,
    });
  });

  it("пустой фаусет и выключенный токен блокируют раньше кулдауна", () => {
    expect(faucetRow({ ...ready, faucetBalance: 399n, nextClaimAt: 9_999n }, 1_000).block).toBe("empty");
    expect(faucetRow({ ...ready, enabled: false, faucetBalance: 0n }, 1_000).block).toBe("disabled");
  });
});

describe("fmtRemaining", () => {
  it("минуты округляются вверх, часы отделяются", () => {
    expect(fmtRemaining(61)).toBe("2m");
    expect(fmtRemaining(3_900)).toBe("1h 05m");
  });
});
