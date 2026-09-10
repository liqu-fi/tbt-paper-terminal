import { SessionKeyPanel } from "../pages/SessionKeyPanel";
import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import { WALLET_DUMMY_SIG } from "../support/injectedWallet";
import type { MockWorld } from "../support/world";

/**
 * 1-click trading: with a session key active every order must be signed locally
 * by that key, so the wallet is never prompted.
 *
 * Two independent signals prove it, and both are needed — either alone is
 * ambiguous:
 *   - `signRequests` gains no `eth_signTypedData_v4` (the wallet was not asked);
 *   - the submitted `signature` is NOT the wallet's canned value (something
 *     else really did sign it, rather than the order going out unsigned).
 */
function typedSignCount(world: MockWorld): number {
  return world.signRequests.filter((m) => m === "eth_signTypedData_v4").length;
}

test.describe("1-click trading", () => {
  test("a market order with an active session never prompts the wallet", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    const sessionKey = new SessionKeyPanel(page);
    await sessionKey.enable(7);
    const signsAfterGrant = typedSignCount(world);

    await trade.selectTab("market");
    await trade.setSize("0.5");
    await trade.submit();

    await expect.poll(() => world.submittedOrders.length).toBe(1);
    expect(typedSignCount(world)).toBe(signsAfterGrant);
    expect(world.submittedOrders[0].signature).not.toBe(WALLET_DUMMY_SIG);
  });

  test("limit orders route through the session key too", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    const sessionKey = new SessionKeyPanel(page);
    await sessionKey.enable(7);
    const signsAfterGrant = typedSignCount(world);

    await trade.selectTab("limit");
    await trade.setSize("1");
    await trade.setLimitPrice("65000");
    await trade.submit();

    await expect.poll(() => world.submittedOrders.length).toBe(1);
    expect(world.submittedOrders[0].orderType).toBe("LIMIT");
    expect(typedSignCount(world)).toBe(signsAfterGrant);
    expect(world.submittedOrders[0].signature).not.toBe(WALLET_DUMMY_SIG);
  });

  test("a session restored on load signs orders without the wallet", async ({
    page,
    world,
  }) => {
    const { app, trade } = await enterTerminal(page, world);
    const sessionKey = new SessionKeyPanel(page);
    await sessionKey.enable(7);

    // Reload so every consumer mounts with the grant already on disk. This
    // isolates "the session key can sign orders" from "consumers notice a
    // session created during this page's lifetime".
    await page.reload();
    await expect(app.terminal).toBeVisible({ timeout: 25_000 });
    const signsAfterReload = typedSignCount(world);

    await trade.setSize("0.5");
    await trade.submit();

    await expect.poll(() => world.submittedOrders.length).toBe(1);
    expect(typedSignCount(world)).toBe(signsAfterReload);
    expect(world.submittedOrders[0].signature).not.toBe(WALLET_DUMMY_SIG);
  });

  // The contrast case. Without it the assertions above could pass simply
  // because the app never asks anyone to sign.
  test("without a session every order costs a wallet signature", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    const before = typedSignCount(world);

    await trade.setSize("0.5");
    await trade.submit();

    await expect.poll(() => world.submittedOrders.length).toBe(1);
    expect(typedSignCount(world)).toBe(before + 1);
    expect(world.submittedOrders[0].signature).toBe(WALLET_DUMMY_SIG);
  });

  test("revoking mid-session hands signing back to the wallet", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    const sessionKey = new SessionKeyPanel(page);

    await sessionKey.enable(7);
    await trade.setSize("0.5");
    await trade.submit();
    await expect.poll(() => world.submittedOrders.length).toBe(1);
    const signsWhileActive = typedSignCount(world);

    await sessionKey.revoke();

    // The signer is chosen per submit, so the very next order must fall back
    // to the wallet rather than reusing the revoked key.
    await trade.setSize("0.25");
    await trade.submit();
    await expect.poll(() => world.submittedOrders.length).toBe(2);
    expect(typedSignCount(world)).toBe(signsWhileActive + 1);
    expect(world.submittedOrders[1].signature).toBe(WALLET_DUMMY_SIG);
  });
});
