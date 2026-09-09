import { useLiqSignOut, useTurnkey } from "@liq/react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";
import { e2eWallet, turnkeyLoginEnabled } from "../../config/env";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Разметка кнопки адреса. Что делает клик — решают две обёртки ниже. */
function AddressButton({
  address,
  onSignOut,
}: {
  address: string;
  onSignOut: () => void;
}) {
  return (
    <button
      onClick={onSignOut}
      className="rounded-[var(--radius-sm)] border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-text"
      title="Disconnect"
      data-testid="wallet-address-button"
    >
      {short(address)}
    </button>
  );
}

/**
 * Выход из сессии e2e-кошелька.
 *
 * @remarks
 * Просто `disconnect()`: токен шлюза переживает отключение, поэтому
 * переподключение того же кошелька возвращает в терминал без второго SIWE.
 */
function PlainAddressButton({ address }: { address: string }) {
  const { disconnect } = useDisconnect();
  return <AddressButton address={address} onSignOut={() => disconnect()} />;
}

/**
 * Выход за дверью Turnkey. Асимметрия с `PlainAddressButton` намеренная.
 *
 * @remarks
 * Под Turnkey одного `disconnect()` мало: сессия Turnkey остаётся живой, мост
 * видит «аутентифицирован + живой провайдер + отключённый wagmi» и немедленно
 * возвращает пользователя внутрь — кнопка «выйти» не работала бы вовсе.
 * Поэтому полный выход, и порядок внутри `useLiqSignOut` несущий: реестр
 * провайдеров пустеет первым, потому что `logout()` асинхронен и окно между
 * `disconnect()` и его разрешением — это и есть окно для такого возврата.
 */
function TurnkeyAddressButton({ address }: { address: string }) {
  const { logout } = useTurnkey();
  const signOut = useLiqSignOut();
  return (
    <AddressButton address={address} onSignOut={() => signOut({ logout })} />
  );
}

/** Кнопка входа e2e-кошелька: единственный коннектор сборки — `injected()`. */
function E2eConnectButton() {
  const { connect, connectors, isPending } = useConnect();
  const connector = connectors[0];
  return (
    <Button
      disabled={isPending || !connector}
      onClick={() => connector && connect({ connector })}
      data-testid="connect-wallet-button"
    >
      {isPending ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}

/**
 * Адрес с выходом, пока подключены; до подключения — ничего: дверь Turnkey
 * живёт в `SignInPanel`. Только под `VITE_E2E_WALLET` до подключения рисуется
 * кнопка e2e-кошелька — hermetic e2e входит ею и из шапки, и из гейта.
 */
export function ConnectButton() {
  const { address, isConnected } = useAccount();

  if (isConnected && address) {
    // Ветка стоит на константе времени сборки: `useTurnkey()` бросает вне
    // своего провайдера, поэтому выбор, способный поменяться на лету, нарушил бы
    // правило хуков. `turnkeyLoginEnabled` истинно только при полном конфиге, а
    // значит обёртка Turnkey в этой сборке смонтирована.
    return turnkeyLoginEnabled ? (
      <TurnkeyAddressButton address={address} />
    ) : (
      <PlainAddressButton address={address} />
    );
  }
  return e2eWallet ? <E2eConnectButton /> : null;
}
