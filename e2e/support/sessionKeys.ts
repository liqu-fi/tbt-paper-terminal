/**
 * Helpers for driving the SDK's persisted session-key state from a spec.
 *
 * The non-Turnkey `SessionKeyManager` keeps its grant in localStorage under
 * `liq.sess.v1` and drops it on load once `expiresAt` has passed. Seeding that
 * slot directly is the only way to reach states the UI cannot produce on
 * demand — chiefly an already-expired grant.
 */
import type { Page } from "@playwright/test";

import { TEST_ADDRESS } from "./constants";

/** Must match `STORAGE_KEY` in @liqpro/liq-onchain. */
const SESSION_STORAGE_KEY = "liq.sess.v1";

/** The shape `SessionKeyManager.persist()` writes (bigints as strings). */
interface PersistedSession {
  id: string;
  sessionPriv: string;
  sessionPub: string;
  grant: {
    user: string;
    sessionKey: string;
    scope: string;
    validUntil: string;
    nonce: string;
  };
  grantSig: string;
  /** milliseconds */
  expiresAt: number;
  eoa: string;
}

// A syntactically valid secp256k1 key. Only ever used for grants that are
// already expired, so it is never handed to privateKeyToAccount for signing.
const DUMMY_PRIV = ("0x" + "22".repeat(32)) as string;
const DUMMY_PUB = "0x000000000000000000000000000000000000dEaD";

/**
 * A grant that expired an hour ago. `loadSession()` must discard it, so the
 * pill falls back to "Enable 1-click trading" and orders route to the wallet.
 */
export function expiredSessionFixture(
  overrides: Partial<PersistedSession> = {},
): PersistedSession {
  const expiredAtSec = Math.floor(Date.now() / 1000) - 3600;
  return {
    id: "sess-expired",
    sessionPriv: DUMMY_PRIV,
    sessionPub: DUMMY_PUB,
    grant: {
      user: TEST_ADDRESS,
      sessionKey: DUMMY_PUB,
      scope: "0x" + "00".repeat(32),
      validUntil: String(expiredAtSec),
      nonce: "1",
    },
    grantSig: ("0x" + "11".repeat(65)) as string,
    expiresAt: expiredAtSec * 1000,
    eoa: TEST_ADDRESS,
    ...overrides,
  };
}

/**
 * Write a session into localStorage before the app boots.
 *
 * @remarks
 * Installed as an init script, so it re-applies on every navigation in the
 * page — including `reload()`. Do not combine with a test that asserts the app
 * *cleared* the slot across a reload; assert within a single load instead.
 */
export async function seedStoredSession(
  page: Page,
  session: PersistedSession,
): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: SESSION_STORAGE_KEY, value: JSON.stringify(session) },
  );
}

/** Read the live persisted session, or null when the slot is empty/invalid. */
export async function readStoredSession(
  page: Page,
): Promise<PersistedSession | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PersistedSession;
    } catch {
      return null;
    }
  }, SESSION_STORAGE_KEY);
}
