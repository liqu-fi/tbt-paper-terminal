import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env gateway-url guard", () => {
  it("throws at load when VITE_GATEWAY_URL is blank", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "");
    vi.resetModules();
    await expect(import("../env")).rejects.toThrow(/VITE_GATEWAY_URL is not set/);
  });

  it("strips a trailing slash from the gateway URL", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1/");
    vi.resetModules();
    const { env } = await import("../env");
    expect(env.gatewayUrl).toBe("https://gw.example.com/v1");
  });
});

describe("дверь Turnkey", () => {
  const full = () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1");
    vi.stubEnv("VITE_TURNKEY_ORG_ID", "org-1");
    vi.stubEnv("VITE_TURNKEY_AUTH_PROXY_CONFIG_ID", "cfg-1");
  };

  it("смонтирована при полном конфиге", async () => {
    full();
    vi.resetModules();
    const { env, turnkeyLoginEnabled } = await import("../env");
    expect(env.turnkeyConfigError).toBeNull();
    expect(turnkeyLoginEnabled).toBe(true);
  });

  it("объясняет, чего не хватает, — вход единственный, флага нет", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1");
    vi.stubEnv("VITE_TURNKEY_AUTH_PROXY_CONFIG_ID", "cfg-1");
    vi.resetModules();
    const { env, turnkeyLoginEnabled } = await import("../env");
    expect(env.turnkeyConfigError).toMatch(/VITE_TURNKEY_ORG_ID/);
    expect(turnkeyLoginEnabled).toBe(false);
  });

  it("под e2e-кошельком выключена и на пустой конфиг не жалуется", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1");
    vi.stubEnv("VITE_E2E_WALLET", "true");
    vi.resetModules();
    const { e2eWallet, env, turnkeyLoginEnabled } = await import("../env");
    expect(e2eWallet).toBe(true);
    expect(env.turnkeyConfigError).toBeNull();
    expect(turnkeyLoginEnabled).toBe(false);
  });

  it("не трогает флаг сессионных ключей", async () => {
    full();
    vi.resetModules();
    const { env } = await import("../env");
    expect(env.turnkey.enabled).toBe(false);
  });
});
