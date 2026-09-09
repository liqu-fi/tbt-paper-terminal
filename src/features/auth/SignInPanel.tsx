import { env, turnkeyLoginEnabled } from "../../config/env";
import { ConnectButton } from "../wallet/ConnectButton";
import { TurnkeyLoginButton } from "./TurnkeyLoginButton";

/**
 * Экран входа: единственная дверь — Turnkey.
 *
 * @remarks
 * Turnkey даёт встроенный кошелёк в TEE и не требует расширения; подпись внешним
 * кошельком — один из способов доказать личность внутри его модалки, а не
 * отдельная дверь. `ConnectButton` здесь рисует что-то только под
 * `VITE_E2E_WALLET` — кошелёк Playwright для hermetic e2e.
 */
export function SignInPanel() {
  return (
    <div className="flex flex-col items-center gap-3">
      {turnkeyLoginEnabled ? <TurnkeyLoginButton /> : null}

      {env.turnkeyConfigError ? (
        <p className="text-sm text-short" role="alert" data-testid="auth-config-error">
          {env.turnkeyConfigError}
        </p>
      ) : null}

      <ConnectButton />
    </div>
  );
}
