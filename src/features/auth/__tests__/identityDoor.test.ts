import { TURNKEY_CONNECTOR_ID } from "@liq/turnkey";
import { describe, expect, it } from "vitest";

import { INJECTED_CONNECTOR_ID, reconnectPlan } from "../identityDoor";

const BOTH = [INJECTED_CONNECTOR_ID, TURNKEY_CONNECTOR_ID];

describe("reconnectPlan", () => {
  it("без запомненной двери не восстанавливает ничего", () => {
    expect(reconnectPlan(null, BOTH)).toBeNull();
  });

  it("восстанавливает ровно ту дверь, которой входили", () => {
    expect(reconnectPlan("injected", BOTH)).toBe(INJECTED_CONNECTOR_ID);
    expect(reconnectPlan("turnkey", BOTH)).toBe(TURNKEY_CONNECTOR_ID);
  });

  it("молчит, когда коннектора двери нет в сборке", () => {
    expect(reconnectPlan("turnkey", [INJECTED_CONNECTOR_ID])).toBeNull();
  });
});
