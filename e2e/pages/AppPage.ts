/**
 * App-shell + session-gate Page Object, plus the onboarding flow helpers
 * (connect → create account → sign-in) that land a test in the live terminal.
 */
import { expect, type Locator, type Page } from "@playwright/test";

// The two onboarding gates wait on the heaviest async chains in the suite:
// create-account → needs-signin, and (enable-book on-chain tx + SIWE) → terminal.
// `globalSetup` warms Vite's dep-optimize so these don't pay that one-time cost,
// but the opening wave still boots several heavy wagmi/viem apps in parallel, so
// the cold-onboarding path runs ~2x its warm/isolation time. This budget sits
// safely under the 30s per-test timeout (which still backstops a genuine hang).
const ONBOARD_GATE_TIMEOUT = 25_000;

export class AppPage {
  readonly brand: Locator;
  readonly connectButton: Locator;
  readonly walletAddressButton: Locator;
  readonly disconnectedGate: Locator;
  readonly loadingGate: Locator;
  readonly noAccountGate: Locator;
  readonly createAccountButton: Locator;
  readonly createAccountError: Locator;
  readonly needsSigninGate: Locator;
  readonly signinButton: Locator;
  readonly signinError: Locator;
  readonly terminal: Locator;
  readonly wrongChainGate: Locator;
  readonly switchChainButton: Locator;
  readonly switchChainError: Locator;

  constructor(private readonly page: Page) {
    this.brand = page.getByTestId("app-brand");
    this.connectButton = page.getByTestId("connect-wallet-button");
    this.walletAddressButton = page.getByTestId("wallet-address-button");
    this.disconnectedGate = page.getByTestId("session-disconnected");
    this.loadingGate = page.getByTestId("session-loading");
    this.noAccountGate = page.getByTestId("session-no-account");
    this.createAccountButton = page.getByTestId("create-account-button");
    this.createAccountError = page.getByTestId("create-account-error");
    this.needsSigninGate = page.getByTestId("session-needs-signin");
    this.signinButton = page.getByTestId("signin-button");
    this.signinError = page.getByTestId("signin-error");
    this.terminal = page.getByTestId("terminal-root");
    this.wrongChainGate = page.getByTestId("session-wrong-chain");
    this.switchChainButton = page.getByTestId("switch-chain-button");
    this.switchChainError = page.getByTestId("switch-chain-error");
  }

  goto(): Promise<unknown> {
    return this.page.goto("/");
  }

  /** Click Connect (header + gate share the testid; either connects wagmi). */
  async connect(): Promise<void> {
    await this.connectButton.first().click();
    await expect(this.walletAddressButton).toBeVisible();
  }

  async createAccount(): Promise<void> {
    await this.createAccountButton.click();
    await expect(this.needsSigninGate).toBeVisible({
      timeout: ONBOARD_GATE_TIMEOUT,
    });
  }

  async signIn(): Promise<void> {
    await this.signinButton.click();
    await expect(this.terminal).toBeVisible({ timeout: ONBOARD_GATE_TIMEOUT });
  }

  /** From a connected wallet that already owns a perps account → terminal. */
  async signInToTerminal(): Promise<void> {
    await this.connect();
    await this.signIn();
  }

  /** Full cold onboarding: connect → mint account → enable book + sign-in. */
  async onboard(): Promise<void> {
    await this.connect();
    await this.createAccount();
    await this.signIn();
  }
}
