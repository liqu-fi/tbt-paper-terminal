/**
 * Live Turnkey session keys — the enclave-backed 1-click path against real
 * infrastructure (authproxy.turnkey.com + api.turnkey.com + the staging
 * gateway). This is the only tier that can catch enclave-side failures; Tier 1
 * deliberately runs the wallet-signed `SessionKeyManager` instead.
 *
 * Opt-in twice over: the live tier must be configured, AND the Turnkey org /
 * auth-proxy ids must be present. Otherwise every test here skips green.
 */
import { AppPage } from "../pages/AppPage";
import { SessionKeyPanel } from "../pages/SessionKeyPanel";
import { TradePanel } from "../pages/TerminalPanels";
import { liveEnv, turnkeyConfigured } from "./env";
import { expect, test } from "./liveFixtures";

test.describe("live: turnkey session keys", () => {
  test.beforeEach(() => {
    const gate = turnkeyConfigured();
    test.skip(!gate.ok, gate.reason);
  });

  test("grants an enclave-backed session and trades without wallet prompts", async ({
    page,
  }) => {
    const app = new AppPage(page);
    const sessionKey = new SessionKeyPanel(page);
    const trade = new TradePanel(page);

    await app.goto();
    await app.signInToTerminal();

    // The pill only renders once the SDK could build a manager — its presence
    // already proves the Turnkey config reached the browser.
    await expect(sessionKey.button).toBeVisible();
    await expect(sessionKey.statusDot).toHaveClass(/bg-muted/);

    // Creating the session runs the full enclave handshake: wallet-auth against
    // the auth proxy, sub-org lookup, embedded-wallet creation, grant
    // registration. Slow — and the step that currently fails in production.
    await sessionKey.open();
    await sessionKey.createButton(1).click();
    await sessionKey.overlay.waitFor({
      state: "detached",
      timeout: liveEnv.fillTimeoutMs,
    });
    await expect(sessionKey.statusDot).toHaveClass(/bg-long/);

    // Reload before trading: consumers read the grant at mount, so this is the
    // state a returning user is actually in (and it sidesteps the same-document
    // propagation gap Tier 1 pins down).
    await page.reload();
    await expect(app.tradeReady).toBeVisible({ timeout: 60_000 });
    await expect(sessionKey.statusDot).toHaveClass(/bg-long/);

    // A real order signed inside the enclave — this is the assertion that would
    // have caught `sign_raw_payload → 404`.
    await trade.selectTab("limit");
    await trade.setSize("0.001");
    // Far from the mark so the order rests instead of filling; this spec is
    // about who signed it, not about settlement.
    await trade.setLimitPrice("1000");
    await trade.submit();

    // Poll both outcomes at once. Asserting `tradeError` hidden right after the
    // click passes vacuously — the mutation has not settled yet — and the run
    // then dies 30s later on "expected '' received '0.001'", which says nothing
    // about the cause. Folding the rejection text into the polled value puts it
    // in the failure message instead: this is how the enclave's
    // `sign_raw_payload → 404` should announce itself.
    await expect
      .poll(
        async () =>
          (await trade.tradeError.isVisible())
            ? `order rejected: ${await trade.tradeError.innerText()}`
            : await trade.sizeInput.inputValue(),
        { timeout: 30_000 },
      )
      .toBe("");
  });

  test("revokes the session", async ({ page }) => {
    const app = new AppPage(page);
    const sessionKey = new SessionKeyPanel(page);

    await app.goto();
    await app.signInToTerminal();
    await expect(sessionKey.button).toBeVisible();

    // Grant here rather than leaning on the spec above: every test gets a fresh
    // browser context, so that grant is not in this page's localStorage. The
    // earlier version skipped on a missing session and therefore never once
    // ran — a permanent skip reads as a pass.
    await sessionKey.open();
    await sessionKey.createButton(1).click();
    await sessionKey.overlay.waitFor({
      state: "detached",
      timeout: liveEnv.fillTimeoutMs,
    });
    await expect(sessionKey.statusDot).toHaveClass(/bg-long/);

    await sessionKey.revoke();
    await expect(sessionKey.statusDot).toHaveClass(/bg-muted/);
  });
});
