import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("session persistence", () => {
  test("a reload with a persisted JWT lands back in the terminal without a second SIWE", async ({
    page,
    world,
  }) => {
    // `app`'s locators are lazy, so the same instance resolves against the
    // post-reload DOM — no need to reconstruct it after page.reload().
    const { app } = await enterTerminal(page, world);
    expect(world.authVerifyRequests).toHaveLength(1);
    const signs = world.signRequests.length;

    await page.reload();

    // wagmi's reconnectOnMount re-attaches the single connector, and the JWT
    // comes back from localStorage('liq-gateway') — so the terminal returns
    // with zero clicks…
    await expect(app.terminal).toBeVisible({ timeout: 25_000 });
    // …and crucially with no re-authentication of any kind:
    expect(world.authVerifyRequests).toHaveLength(1);
    expect(world.authNonceRequests).toBe(1);
    expect(world.signRequests.length).toBe(signs);
  });

  test("the order nonce re-syncs from the gateway after a reload", async ({
    page,
    world,
  }) => {
    const { app } = await enterTerminal(page, world);
    await expect.poll(() => world.orderNonceRequests).toBeGreaterThan(0);
    const before = world.orderNonceRequests;

    await page.reload();
    await expect(app.terminal).toBeVisible({ timeout: 25_000 });
    // The restored token re-arms useGatewayNonceSync — a fresh seed is fetched.
    // `> before` (not `=== before + 1`): tolerant of a reconnect that
    // legitimately re-arms the sync more than once.
    await expect.poll(() => world.orderNonceRequests).toBeGreaterThan(before);
  });
});
