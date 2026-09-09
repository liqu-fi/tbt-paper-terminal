import {
  useAccountQuery,
  useCreateAccountMutation,
  useGatewayAuthMutation,
  useSessionStage,
} from "@liq/react";
import { INSUFFICIENT_GAS_MESSAGE, isInsufficientGas } from "@liq/core";
import { type ReactNode, useEffect } from "react";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";

import { env, turnkeyLoginEnabled } from "../../config/env";
import { Button } from "@/components/ui/button";
import { useSessionBooting } from "./IdentityDoorProvider";
import { useDoorStore } from "./useDoorStore";
import { SignInPanel } from "./SignInPanel";
import { useTurnkeyIdentity } from "./TurnkeyIdentityProvider";

/** Renders children only when the session is `ready`; otherwise shows the next CTA. */
export function SessionGate({ children }: { children: ReactNode }) {
  // Ветка стоит на константе времени сборки, а не на условии: `useTurnkeyIdentity()`
  // внутри `TurnkeyBootGate` бросает вне своего провайдера, и правило хуков требует,
  // чтобы выбор компонента, который его зовёт, не менялся за время монтирования
  // (тот же приём в `SignInPanel`, `ConnectButton`).
  const inner = <SessionGateInner>{children}</SessionGateInner>;
  return turnkeyLoginEnabled ? <TurnkeyBootGate>{inner}</TurnkeyBootGate> : inner;
}

/**
 * Перехватывает гейт на то время, пока сессия Turnkey восстановлена, а
 * встроенный кошелёк ещё не разрешён.
 *
 * @remarks
 * `booting` в `IdentityDoorProvider` гаснет, как только `isAuthorized()`
 * коннектора Turnkey ответит — а он отвечает `false` немедленно, потому что
 * зовёт `getProvider()` по пустому в этот тик реестру провайдеров: лестнице
 * ещё только предстоит начать круг к auth-proxy и `resolve-signer`. Без этой
 * ступени `SessionGateInner` в этом окне рисует `session-disconnected` с
 * обеими живыми кнопками, и клик по Connect Wallet сажает пользователя под
 * EOA, пока в реестре ещё висит TEE-провайдер прошлой попытки — спека §2
 * обещает, что именно это окно закрывает `booting`, и для двери Turnkey оно
 * оставалось открытым.
 */
function TurnkeyBootGate({ children }: { children: ReactNode }) {
  const door = useDoorStore((s) => s.door);
  const { subOrgId, embedded } = useTurnkeyIdentity();
  const stillResolving = embedded.kind === "idle" || embedded.kind === "resolving";
  if (door === "turnkey" && subOrgId !== null && stillResolving) {
    return (
      <Centered testid="session-loading">
        <p className="text-muted">Loading account…</p>
      </Centered>
    );
  }
  return <>{children}</>;
}

function SessionGateInner({ children }: { children: ReactNode }) {
  const booting = useSessionBooting();
  // Саму ступень вычисляет useSessionStage(); здесь accountId остаётся
  // отдельно — он нужен кнопкам ниже (createAccount/signIn), а не гейту.
  const { data: accountIds } = useAccountQuery();
  const accountId = accountIds?.[0];

  // Detect a wallet on the wrong network via the CONNECTOR's chain
  // (`useAccount().chainId`), NOT `useChainId()`: the latter returns the wagmi
  // config's chain (6343) even while the wallet sits on an unconfigured chain,
  // so it can't see the mismatch. On a mismatched chain wagmi builds no
  // walletClient, so every on-chain write (createAccount) and the SIWE sign-in
  // fail with "walletClient is required" / "Wallet not connected".
  const account = useAccount();
  const wrongChain = account.isConnected && account.chainId !== env.chainId;
  const switchChain = useSwitchChain();

  const createAccount = useCreateAccountMutation();
  const auth = useGatewayAuthMutation();

  // After a wrong-chain → correct-chain transition, wagmi's walletClient query
  // may hold a cached ConnectorChainMismatchError from when the wallet was on
  // the wrong chain. staleTime: Infinity prevents an automatic re-fetch, so we
  // force one here whenever the query is in error state and we're on the right
  // chain. This ensures the sign-in button is not silently broken post-switch.
  // Destructure so the effect depends on these fields, not the whole query
  // object (whose identity changes every render) — keeps exhaustive-deps happy
  // and the effect from re-running needlessly.
  const {
    data: walletClientData,
    isError: walletClientErrored,
    refetch: refetchWalletClient,
  } = useWalletClient();
  useEffect(() => {
    if (!wrongChain && walletClientErrored) {
      void refetchWalletClient();
    }
  }, [wrongChain, walletClientErrored, refetchWalletClient]);

  const stage = useSessionStage();

  // Пока идёт восстановление, wagmi отвечает `disconnected`, и без этой ветки
  // гейт показывал бы экран входа кадром на каждой перезагрузке. Раньше ту же
  // роль играл `isReconnecting` внутри штатного восстановления wagmi.
  if (booting) {
    return (
      <Centered testid="session-loading">
        <p className="text-muted">Loading account…</p>
      </Centered>
    );
  }

  if (stage === "disconnected") {
    return (
      <Centered testid="session-disconnected">
        <SignInPanel />
      </Centered>
    );
  }
  if (stage === "wrong-chain") {
    return (
      <Centered testid="session-wrong-chain">
        <p className="text-muted">
          Wrong network. Switch your wallet to MegaETH (chainId {env.chainId}).
        </p>
        <Button
          disabled={switchChain.isPending}
          onClick={() => switchChain.switchChain({ chainId: env.chainId })}
          data-testid="switch-chain-button"
        >
          {switchChain.isPending ? "Switching…" : "Switch to MegaETH"}
        </Button>
        <ErrorLine error={switchChain.error} testid="switch-chain-error" />
      </Centered>
    );
  }
  if (stage === "loading") {
    return (
      <Centered testid="session-loading">
        <p className="text-muted">Loading account…</p>
      </Centered>
    );
  }
  if (stage === "no-account") {
    return (
      <Centered testid="session-no-account">
        <p className="text-muted">No SNX account yet.</p>
        <Button
          disabled={createAccount.isPending}
          onClick={() => createAccount.mutate(undefined)}
          data-testid="create-account-button"
        >
          {createAccount.isPending ? "Creating…" : "Create Account"}
        </Button>
        <ErrorLine
          error={createAccount.error}
          testid="create-account-error"
          formatMessage={(error) => createAccountErrorMessage(error, account.address)}
        />
      </Centered>
    );
  }
  if (stage === "needs-signin") {
    return (
      <Centered testid="session-needs-signin">
        <p className="text-muted">Sign in to the gateway (SIWE).</p>
        <Button
          disabled={
            auth.isPending || accountId === undefined || !walletClientData
          }
          onClick={() => accountId !== undefined && auth.mutate({ accountId })}
          data-testid="signin-button"
        >
          {auth.isPending ? "Signing…" : "Sign In"}
        </Button>
        <ErrorLine error={auth.error} testid="signin-error" />
      </Centered>
    );
  }
  // Authenticated/ready: render the app. Пилюля 1-click живёт в шапке
  // приложения (`SessionToolbar`) — своя строка над терминалом стоила 36px
  // высоты ради одной кнопки; гейт по аутентификации переехал туда вместе с ней.
  return <>{children}</>;
}

function Centered({
  children,
  testid,
}: {
  children: ReactNode;
  testid?: string;
}) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3"
      data-testid={testid}
    >
      {children}
    </div>
  );
}

/**
 * Что показать вместо сырого `error.message` при отказе создания аккаунта.
 *
 * @remarks
 * Спека §5 и таблица краевых случаев называют это единственным местом, ради
 * которого вообще делался долив газа: на деплое без его ручек (задокументи-
 * рованный 404) кошелёк без ETH иначе объясняется сырым текстом реверта
 * viem — пользователь смотрит на "execution reverted" и не понимает, что ему
 * нужно прислать ETH. Остальные отказы (не про газ) показываются как есть —
 * `isInsufficientGas` целится только в нехватку средств на комиссию.
 */
function createAccountErrorMessage(error: Error, address: string | undefined): string {
  if (!isInsufficientGas(error)) return error.message;
  return `${INSUFFICIENT_GAS_MESSAGE} Send ETH to ${address ?? "your wallet"} and try again.`;
}

/** Surfaces a mutation error inline so a failed CTA isn't a silent dead-end. */
function ErrorLine({
  error,
  testid,
  formatMessage,
}: {
  error: Error | null;
  testid: string;
  /** Переопределяет `error.message` — например, чтобы humanize'ить конкретную причину. */
  formatMessage?: (error: Error) => string;
}) {
  if (!error) return null;
  return (
    <p className="text-sm text-short" role="alert" data-testid={testid}>
      {formatMessage ? formatMessage(error) : error.message}
    </p>
  );
}
