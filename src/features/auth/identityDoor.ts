import { TURNKEY_CONNECTOR_ID } from "@liq/turnkey";

import type { IdentityDoor } from "./useDoorStore";

/**
 * Захардкожен, а не импортирован: `@wagmi/core` экспортирует саму фабрику
 * `injected()`, но не константу её `id` — в публичном экспорте
 * (`@wagmi/core/dist/esm/exports/index.js`) её нет. Значение проверено там,
 * где оно единственный раз объявлено — `@wagmi/core/dist/esm/connectors/
 * injected.js` (`id: 'injected'`).
 */
export const INJECTED_CONNECTOR_ID = "injected";

/**
 * Какой коннектор восстанавливать на старте.
 *
 * @returns id коннектора либо `null` — «не восстанавливать ничего».
 * `null` при отсутствующем коннекторе, а не падение: дверь могла быть записана
 * сборкой с включённым флагом входа, а открыта сборкой с выключенным.
 */
export function reconnectPlan(
  door: IdentityDoor | null,
  connectorIds: readonly string[],
): string | null {
  if (!door) return null;
  const wanted =
    door === "turnkey" ? TURNKEY_CONNECTOR_ID : INJECTED_CONNECTOR_ID;
  return connectorIds.includes(wanted) ? wanted : null;
}
