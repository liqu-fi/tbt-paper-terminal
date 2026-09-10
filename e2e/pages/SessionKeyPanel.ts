/** Page Object for the session-key (1-click trading) header pill and modal. */
import { type Locator, type Page } from "@playwright/test";

type SessionDuration = 1 | 7 | 30;

export class SessionKeyPanel {
  readonly button: Locator;
  readonly overlay: Locator;
  readonly closeButton: Locator;
  readonly revokeButton: Locator;
  /**
   * The pill's status dot: `bg-long` when a session is active, `bg-muted`
   * otherwise.
   *
   * @remarks
   * Assert on it with a retrying matcher (`toHaveClass(/bg-long/)`), never a
   * one-shot read: the pill re-renders only after the manager has reloaded the
   * session from storage, which lands a tick or two after the action that
   * caused it — a plain read races that refresh and flakes.
   */
  readonly statusDot: Locator;

  constructor(private readonly page: Page) {
    this.button = page.getByTestId("session-key-button");
    this.overlay = page.getByTestId("session-key-modal-overlay");
    this.closeButton = page.getByTestId("session-key-modal-close");
    this.revokeButton = page.getByTestId("session-key-revoke-button");
    this.statusDot = this.button.locator("span").first();
  }

  createButton(days: SessionDuration): Locator {
    return this.page.getByTestId(`session-key-create-${days}`);
  }

  open(): Promise<void> {
    return this.button.click();
  }

  /** Open the modal and grant a session of `days` — the wallet signs once. */
  async enable(days: SessionDuration): Promise<void> {
    await this.open();
    await this.createButton(days).click();
    // The modal closes only after createSession resolves (grant registered),
    // so its disappearance is the completion signal — no arbitrary wait.
    await this.overlay.waitFor({ state: "detached" });
  }

  async revoke(): Promise<void> {
    await this.open();
    await this.revokeButton.click();
    await this.overlay.waitFor({ state: "detached" });
  }

  /** Pill label, e.g. "1-click: 7d 0h" or "Enable 1-click trading". */
  label(): Promise<string> {
    return this.button.innerText();
  }
}
