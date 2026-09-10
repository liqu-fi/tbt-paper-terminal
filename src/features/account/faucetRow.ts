/** Почему сейчас нельзя нажать Claim — или `null`, если можно. */
type FaucetBlock = "disabled" | "empty" | "cooldown";

/**
 * Состояние одной строки фаусета из ончейн-снимка.
 *
 * @param nowSec - текущее время в секундах; параметром, а не `Date.now()`
 *   внутри, чтобы проверка не зависела от часов.
 * @returns `remainingSec` осмысленно только при `block === "cooldown"`.
 */
export function faucetRow(
  state: {
    enabled: boolean;
    registered: boolean;
    claimAmount: bigint;
    faucetBalance: bigint;
    nextClaimAt: bigint;
  },
  nowSec: number,
): { block: FaucetBlock | null; remainingSec: number } {
  if (!state.enabled || !state.registered) return { block: "disabled", remainingSec: 0 };
  if (state.faucetBalance < state.claimAmount) return { block: "empty", remainingSec: 0 };
  const remainingSec = Number(state.nextClaimAt) - nowSec;
  if (remainingSec > 0) return { block: "cooldown", remainingSec };
  return { block: null, remainingSec: 0 };
}

/** «2h 05m» / «14m» — сколько ждать следующего Claim. */
export function fmtRemaining(sec: number): string {
  const m = Math.ceil(sec / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}
