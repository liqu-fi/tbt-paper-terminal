import { mnemonicToAccount } from "viem/accounts";

import { AppPage } from "../pages/AppPage";
import { TradePanel } from "../pages/TerminalPanels";
import { liveConfigured, liveEnv } from "./env";
import { fundGas } from "./funding";
import { expect, test } from "./liveFixtures";

// A per-run derivation index far outside the pooled accounts (0…accountCount):
// every run onboards a genuinely fresh wallet. Module-load time is fine — the
// file is collected once per run. The ~2.5h window makes index reuse (which
// would hit an already-onboarded wallet and break the no-account gate) unlikely
// even for back-to-back scheduled runs.
const FRESH_INDEX = 100_000 + (Date.now() % 9_000_000);

test.use({ liveWalletIndex: FRESH_INDEX });

test.describe("live: cold onboarding", () => {
  // Budget for fundGas (capped 60s receipt wait) PLUS the four sequential
  // fill-timeout gates of the onboarding flow, so a slow chain aborts on a
  // meaningful assertion rather than the describe ceiling.
  test.describe.configure({ timeout: liveEnv.fillTimeoutMs * 3 + 180_000 });

  test.beforeEach(() => {
    const gate = liveConfigured();
    test.skip(!gate.ok, gate.reason);
    test.skip(
      !liveEnv.onboarding,
      "E2E_LIVE_ONBOARDING is not set (this spec mints an account NFT per run)",
    );
  });

  test("a fresh wallet onboards: create account → SIWE → empty terminal", async ({
    page,
  }) => {
    const fresh = mnemonicToAccount(liveEnv.mnemonic, {
      addressIndex: FRESH_INDEX,
    });
    await fundGas(fresh.address, "0.002"); // createAccount gas, from index 0

    const app = new AppPage(page);
    await app.goto();
    await app.connect();

    // A fresh derivation truly owns no account — the create CTA must show
    // (this is the dead-button onboarding path, live).
    await expect(app.noAccountGate).toBeVisible({
      timeout: liveEnv.fillTimeoutMs,
    });
    await app.createAccountButton.click();
    await expect(app.needsSigninGate).toBeVisible({
      timeout: liveEnv.fillTimeoutMs,
    });
    await app.signinButton.click();
    await expect(app.tradeReady).toBeVisible({ timeout: liveEnv.fillTimeoutMs });

    // Lands trade-blocked: zero margin, deposit hint up.
    await expect(new TradePanel(page).insufficientMargin).toBeVisible({
      timeout: liveEnv.fillTimeoutMs,
    });
  });
});
