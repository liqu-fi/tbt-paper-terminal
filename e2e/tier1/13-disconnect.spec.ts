import { enterTerminal } from "../pages/flows";
import { TEST_ADDRESS } from "../support/constants";
import { expect, test } from "../support/fixtures";

test.describe("disconnect", () => {
  test("disconnecting the wallet returns to the connect screen", async ({
    page,
    world,
  }) => {
    const { app } = await enterTerminal(page, world);
    await expect(app.terminal).toBeVisible();

    await app.signOut();

    await expect(app.disconnectedGate).toBeVisible();
    await expect(app.terminal).toBeHidden();
  });

  test("reconnecting after a disconnect returns to the terminal", async ({
    page,
    world,
  }) => {
    const { app } = await enterTerminal(page, world);
    await expect(app.terminal).toBeVisible();

    await app.signOut();
    await expect(app.disconnectedGate).toBeVisible();

    // The gateway token persists across a disconnect, so reconnecting the same
    // wallet lands straight back in the terminal (no second SIWE).
    await app.connect();
    await expect(app.tradeReady).toBeVisible();
  });
});

test.describe("wallet menu", () => {
  test("copies the full address, not the truncated pill text", async ({
    page,
    world,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const { app } = await enterTerminal(page, world);

    await app.walletAddressButton.click();
    await app.walletCopyButton.click();
    await expect(app.walletCopyButton).toHaveText(/Copied/);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard.toLowerCase()).toBe(TEST_ADDRESS.toLowerCase());
    // Still connected: copying is not a sign-out.
    await expect(app.terminal).toBeVisible();
  });
});
