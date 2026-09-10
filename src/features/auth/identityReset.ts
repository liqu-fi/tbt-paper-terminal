/**
 * Почему сессию надо обнулить — или `null`, если не надо.
 *
 * @remarks
 * Токен шлюза принадлежит одному кошельку, поэтому смена личности, выход и
 * восстановленный токен с чужим адресом одинаково роняют токен, приватные
 * кэши и реестр провайдеров. Решение вынесено из React отдельной функцией:
 * это единственная часть входа через Turnkey, которую можно проверить без
 * браузера, кошелька и живого анклава.
 */
type IdentityResetReason = "identity-changed" | "token-address-mismatch";

export function identityResetReason(input: {
  /** subOrgId на прошлом кадре. */
  prev: string | null;
  /** subOrgId сейчас. `null` — вышли. */
  next: string | null;
  /** Адрес внутри сохранённого токена шлюза, в нижнем регистре, либо null. */
  tokenAddress: string | null;
  /** Подключённый адрес wagmi, в нижнем регистре, либо null. */
  wagmiAddress: string | null;
}): IdentityResetReason | null {
  // Самый первый вход — не смена личности, а её появление: ронять нечего, а
  // сброс здесь стоил бы пользователю только что полученного токена.
  if (input.prev !== null && input.prev !== input.next) return "identity-changed";
  // Проверка на ПОДКЛЮЧЁННЫЙ адрес несущая: восстановленный токен при ещё не
  // подключённом wagmi — обычное дело, а не рассинхрон, и без неё живая сессия
  // сбрасывалась бы на каждом холодном старте.
  const token = input.tokenAddress?.toLowerCase() ?? null;
  const wagmi = input.wagmiAddress?.toLowerCase() ?? null;
  if (token && wagmi && token !== wagmi) return "token-address-mismatch";
  return null;
}
