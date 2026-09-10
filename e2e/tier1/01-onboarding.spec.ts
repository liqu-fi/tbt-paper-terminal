import { AppPage } from "../pages/AppPage";
import { SET_BOOK_MODE_SELECTOR } from "../support/chain";
import { expect, seed, test } from "../support/fixtures";
import { accountOnchainWorld, armHold, readyWorld, releaseHold } from "../support/world";

test.describe("boot + onboarding", () => {
  test("boots and shows the connect CTA when disconnected", async ({
    page,
  }) => {
    const app = new AppPage(page);
    await app.goto();
    await expect(app.brand).toBeVisible();
    await expect(app.disconnectedGate).toBeVisible();
    await expect(app.connectButton.first()).toBeVisible();
    await expect(app.terminal).toBeHidden();
  });

  test("connecting a wallet with no perps account shows the create CTA", async ({
    page,
  }) => {
    const app = new AppPage(page);
    await app.goto();
    await app.connect();
    // The CTA sits in the ticket footer: the terminal itself is already on
    // screen (book, chart, Faucet), only Buy / Sell are withheld.
    await expect(app.terminal).toBeVisible();
    await expect(app.noAccountGate).toBeVisible();
    await expect(app.createAccountButton).toBeVisible();
    await expect(app.tradeReady).toBeHidden();
  });

  test("connect → sign-in lands in the terminal (existing BOOK account)", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();
    await expect(app.terminal).toBeVisible();
    // 0.26 dropped the enable-book tx: sign-in is a plain SIWE step and never
    // emits an on-chain setBookMode write.
    expect(world.sentTxs.some((t) => t.kind === SET_BOOK_MODE_SELECTOR)).toBe(
      false,
    );
  });

  test("cold onboarding: connect → create account → sign-in", async ({
    page,
    world,
  }) => {
    const app = new AppPage(page);
    await app.goto();
    await app.onboard();
    await expect(app.terminal).toBeVisible();
    expect(world.accounts).toHaveLength(1);
    // the freshly minted account (#1) stays in its creation state (ONCHAIN):
    // 0.26 onboards via SIWE alone and sends no on-chain enable-book tx…
    expect(world.accounts[0].orderMode).toBe("ONCHAIN");
    expect(world.sentTxs.some((t) => t.kind === SET_BOOK_MODE_SELECTOR)).toBe(
      false,
    );
    // …and it is the account registered with the gateway
    expect(world.registeredAccountIds).toContain("1");
    // …and the SIWE payload carries the gateway nonce + the (mock) signature
    expect(world.authVerifyRequests[0].message).toContain("e2e-nonce-1");
    expect(world.authVerifyRequests[0].signature).toBe("0x" + "11".repeat(65));
  });

  test("pre-existing ONCHAIN account: sign-in (no enable-book, no redundant mint)", async ({
    page,
    world,
  }) => {
    seed(world, accountOnchainWorld()); // account #1 already exists, in ONCHAIN mode
    const app = new AppPage(page);
    await app.goto();
    await app.connect();

    // The account exists, so there is no create CTA — straight to sign-in. 0.26
    // dropped the enable-book step, so the CTA is a plain SIWE "Sign In" even for
    // an account that is not (yet) in BOOK mode.
    await expect(app.needsSigninGate).toBeVisible();
    await expect(app.signinButton).toHaveText(/Sign In/);
    await app.signIn();

    await expect(app.terminal).toBeVisible();
    // No second account was minted, and the existing one is NOT flipped on-chain:
    // it stays ONCHAIN (0.26 removed the enable-book tx; BOOK is the gateway default).
    expect(world.accounts).toHaveLength(1);
    expect(world.accounts[0].id).toBe(1n);
    expect(world.accounts[0].orderMode).toBe("ONCHAIN");
    expect(world.registeredAccountIds).toContain("1");
    expect(world.authVerifyRequests).toHaveLength(1);
    // …and no on-chain enable-book write happened during sign-in
    expect(world.sentTxs.some((t) => t.kind === SET_BOOK_MODE_SELECTOR)).toBe(
      false,
    );
  });

  test("a failed SIWE verify keeps the user on the sign-in gate, then recovers", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld()); // funded BOOK account → sign-in is a plain SIWE step
    const app = new AppPage(page);
    await app.goto();
    await app.connect();
    await expect(app.needsSigninGate).toBeVisible();

    // Gateway rejects the SIWE verify: the app must NOT advance into the terminal.
    world.faults.authVerifyStatus = 401;
    await app.signinButton.click();
    await expect(app.tradeReady).toBeHidden();
    await expect(app.needsSigninGate).toBeVisible();
    // Barrier: wait until the rejected verify has actually landed. This proves
    // the first attempt fully failed and leaves NO request in flight. Without it
    // the attempt can still be mid-flight (mock SIWE resolves in ~ms) when we
    // clear the fault below, letting that same request succeed on its own and
    // advance to the terminal — which then races the explicit retry click and
    // flakes as an "element detached from the DOM" timeout.
    await expect.poll(() => world.authVerifyRejections).toBe(1);
    // the 401 short-circuits before the gateway records the verify payload
    expect(world.authVerifyRequests).toHaveLength(0);
    // the failure is surfaced inline, not swallowed — otherwise the click reads
    // as a "dead button" (the original bug this gate guards against).
    await expect(app.signinError).toBeVisible();

    // Clearing the fault and retrying recovers — proving it's a retryable gate,
    // not a silent dead-end or a silent advance.
    delete world.faults.authVerifyStatus;
    await app.signinButton.click();
    await expect(app.tradeReady).toBeVisible();
    expect(world.authVerifyRequests).toHaveLength(1);
  });

  test("a wallet on a foreign chain is gated until it switches to MegaETH", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    world.chainId = 1; // wallet sits on Ethereum mainnet, not MegaETH
    const app = new AppPage(page);
    await app.goto();
    await app.connect();

    // Gated: neither the terminal nor its sign-in CTA is reachable on the wrong chain.
    await expect(app.wrongChainGate).toBeVisible();
    await expect(app.terminal).toBeHidden();
    await expect(app.needsSigninGate).toBeHidden();

    // Switching chains advances to the SIWE step (the account exists), then
    // sign-in lands in the terminal — the full recovery path.
    await app.switchChainButton.click();
    await expect(app.needsSigninGate).toBeVisible();
    expect(world.chainId).toBe(6343); // the wallet actually switched
    await app.signIn();
    await expect(app.terminal).toBeVisible();
  });

  test("a rejected chain switch surfaces the error and stays gated", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    world.chainId = 1;
    world.faults.switchChainRejects = true;
    const app = new AppPage(page);
    await app.goto();
    await app.connect();
    await expect(app.wrongChainGate).toBeVisible();

    await app.switchChainButton.click();
    // The rejection is surfaced inline (no silent dead button) and the gate holds.
    await expect(app.switchChainError).toBeVisible();
    await expect(app.wrongChainGate).toBeVisible();
    expect(world.chainId).toBe(1); // the wallet never moved
  });

  test("a rejected create-account tx surfaces the error and recovers on retry", async ({
    page,
    world,
  }) => {
    // default freshWorld: connected wallet, no perps account
    const app = new AppPage(page);
    await app.goto();
    await app.connect();
    await expect(app.noAccountGate).toBeVisible();

    world.faults.walletSendRejects = true;
    await app.createAccountButton.click();
    // The wallet rejection lands in the ErrorLine — not a silent dead button.
    // (No expect.poll barrier à la the SIWE test: the reject is a synchronous
    // throw in the wallet — the visible ErrorLine itself proves the mutation
    // settled, so nothing is in flight when the fault clears below.)
    await expect(app.createAccountError).toBeVisible();
    await expect(app.noAccountGate).toBeVisible(); // still gated
    expect(world.accounts).toHaveLength(0); // nothing was minted

    delete world.faults.walletSendRejects;
    await app.createAccountButton.click();
    await expect(app.needsSigninGate).toBeVisible({ timeout: 25_000 });
    expect(world.accounts).toHaveLength(1);
  });

  test("the session shows a loading gate while the account lookup is in flight", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    armHold(world, "accountRead"); // hold the tokenOfOwnerByIndex read
    const app = new AppPage(page);
    await app.goto();
    await app.connect();

    await expect(app.loadingGate).toBeVisible();
    releaseHold(world, "accountRead");
    await expect(app.needsSigninGate).toBeVisible();
  });

  test("a rejected connect leaves the app on the connect screen", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    world.faults.connectRejects = true;
    const app = new AppPage(page);
    await app.goto();

    await app.connectButton.first().click(); // not app.connect() — it won't connect
    await expect(app.disconnectedGate).toBeVisible();
    await expect(app.terminal).toBeHidden();
  });
});
