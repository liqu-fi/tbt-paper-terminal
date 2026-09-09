import { humanizeError } from "@liq/core";
import { AuthState, useTurnkey } from "@liq/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useTurnkeyIdentity } from "./TurnkeyIdentityProvider";

/**
 * Дверь Turnkey: одна кнопка, за которой модалка выбирает способ входа.
 *
 * @remarks
 * Отдельный компонент, а не ветка внутри `SignInPanel`, ровно потому, что зовёт
 * `useTurnkey()` — тот бросает вне своего провайдера. Условие монтирования у
 * вызывающего — константа времени сборки, значит эта ветка не меняется за время
 * монтирования и правило хуков соблюдено.
 */
export function TurnkeyLoginButton() {
  const { handleLogin, authState } = useTurnkey();
  const { embedded, retryResolve } = useTurnkeyIdentity();
  const [loginError, setLoginError] = useState<unknown>(null);
  const [stalled, setStalled] = useState(false);

  // Вошли в Turnkey, а подписанта всё нет: сдвинуть сессию нечему, и вместо
  // молчащей кнопки нужно сказать об этом вслух. Ждать имеет смысл только
  // разрешения встроенного кошелька — он единственный подписант обеих дверей.
  const awaiting =
    authState === AuthState.Authenticated &&
    (embedded.kind === "resolving" || embedded.kind === "idle");

  useEffect(() => {
    if (!awaiting) return;
    const timer = window.setTimeout(() => setStalled(true), 10_000);
    // Сброс — в cleanup, а не синхронно в теле эффекта: последнее запрещено
    // `react-hooks/set-state-in-effect` (React Compiler ловит это статически,
    // независимо от ветвления). Семантика та же: как только ждать перестали
    // (awaiting сменился или компонент размонтировался), флаг гаснет вместе с
    // таймером, который его мог бы выставить.
    return () => {
      window.clearTimeout(timer);
      setStalled(false);
    };
  }, [awaiting]);

  return (
    <>
      <Button
        type="button"
        disabled={awaiting}
        onClick={() => {
          setLoginError(null);
          handleLogin().catch((error: unknown) => setLoginError(error));
        }}
        data-testid="turnkey-login-button"
      >
        {awaiting ? "Opening wallet…" : "Continue with email"}
      </Button>

      {loginError ? (
        <p className="text-sm text-short" role="alert" data-testid="auth-login-error">
          {humanizeError(loginError)}
        </p>
      ) : null}

      {embedded.kind === "failed" ? (
        <p className="text-sm text-short" role="alert" data-testid="auth-embedded-failed">
          We could not open your wallet.{" "}
          <button type="button" className="underline" onClick={retryResolve}>
            Try again
          </button>
        </p>
      ) : null}

      {stalled ? (
        <p className="text-sm text-short" role="alert" data-testid="auth-provider-stalled">
          Your wallet is not responding. Reload the page and connect again.
        </p>
      ) : null}
    </>
  );
}
