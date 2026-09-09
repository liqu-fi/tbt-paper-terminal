import { TURNKEY_CONNECTOR_ID } from "@liq/turnkey";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function connectorIds(): Promise<string[]> {
  const { getConfig } = await import("../chain");
  return getConfig().connectors.map((c) => c.id);
}

describe("коннекторы wagmi", () => {
  it("в продукте — только Turnkey", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1");
    vi.resetModules();
    expect(await connectorIds()).toEqual([TURNKEY_CONNECTOR_ID]);
  });

  it("под e2e-кошельком — только injected", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1");
    vi.stubEnv("VITE_E2E_WALLET", "true");
    vi.resetModules();
    expect(await connectorIds()).toEqual(["injected"]);
  });
});
