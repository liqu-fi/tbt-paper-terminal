import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Дверь, которой вошли: расширение браузера или Turnkey. */
export type IdentityDoor = "turnkey" | "injected";

/**
 * Запомненная дверь входа.
 *
 * @remarks
 * Зачем она вообще запоминается: `reconnect()` в wagmi перебирает ВСЕ
 * коннекторы, отсортированные по свежести, и подключает первый авторизованный.
 * После входа через Turnkey подписью внешнего кошелька расширение уже выдало
 * разрешение этому origin, а коннектор Turnkey на перезагрузке ещё пуст —
 * значит первым авторизованным окажется injected, и терминал поднимется под
 * адресом EOA вместо встроенного кошелька. Пользователю предложат создать
 * аккаунт, которого у этого адреса нет. Отсюда вся конструкция: восстанавливаем
 * не «что найдётся», а ровно ту дверь, которой входили.
 *
 * Хранение — на `persist`, том же, что держит раскладку терминала. Приватное
 * окно и заблокированные site data бросают на самом обращении к
 * `localStorage`; middleware это переживает само, и три ручных `try/catch`
 * вокруг `getItem`/`setItem`/`removeItem` больше не нужны. Забытая дверь — это
 * потерянный автоконнект, а не сломанный вход.
 *
 * Значение, не похожее ни на одну из двух дверей, читается как «двери нет»:
 * ключ переживает смены сборок, и мусор в нём не должен доходить до
 * `reconnectPlan`.
 */
export const useDoorStore = create<{
  door: IdentityDoor | null;
  setDoor: (door: IdentityDoor) => void;
  forgetDoor: () => void;
}>()(
  persist(
    (set) => ({
      door: null,
      setDoor: (door) => set({ door }),
      forgetDoor: () => set({ door: null }),
    }),
    {
      name: "liq-terminal-door",
      merge: (persisted, current) => {
        const door = (persisted as { door?: unknown } | undefined)?.door;
        return {
          ...current,
          door: door === "turnkey" || door === "injected" ? door : null,
        };
      },
    },
  ),
);
