import { useLiqSignOut, useTurnkey } from "@liq/react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";
import { turnkeyLoginEnabled } from "../../config/env";
import { INJECTED_CONNECTOR_ID } from "../auth/identityDoor";
import { useDoorStore } from "../auth/useDoorStore";

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
 * Выход из сессии, открытой расширением.
 *
 * @remarks
 * Просто `disconnect()`: токен шлюза переживает отключение, поэтому
 * переподключение того же кошелька возвращает в терминал без второго SIWE.
 */
function PlainAddressButton({ address }: { address: string }) {
  const { disconnect } = useDisconnect();
  const forgetDoor = useDoorStore((s) => s.forgetDoor);
  return (
    <AddressButton
      address={address}
      onSignOut={() => {
        forgetDoor();
        disconnect();
      }}
    />
  );
}

/**
 * Выход в сборке, где есть дверь Turnkey. Асимметрия с `PlainAddressButton`
 * намеренная.
 *
 * @remarks
 * Под Turnkey одного `disconnect()` мало: сессия Turnkey остаётся живой, мост
 * видит «аутентифицирован + живой провайдер + отключённый wagmi» и немедленно
 * возвращает пользователя внутрь — кнопка «выйти» не работала бы вовсе.
 * Поэтому там полный выход, и порядок внутри `useLiqSignOut` несущий: реестр
 * провайдеров пустеет первым, потому что `logout()` асинхронен и окно между
 * `disconnect()` и его разрешением — это и есть окно для такого возврата.
 */
function TurnkeyAwareAddressButton({ address }: { address: string }) {
  const { logout } = useTurnkey();
  const signOut = useLiqSignOut();
  const { disconnect } = useDisconnect();
  const door = useDoorStore((s) => s.door);
  const forgetDoor = useDoorStore((s) => s.forgetDoor);
  return (
    <AddressButton
      address={address}
      onSignOut={() => {
        forgetDoor();
        if (door === "turnkey") signOut({ logout });
        else disconnect();
      }}
    />
  );
}

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const setDoor = useDoorStore((s) => s.setDoor);

  if (isConnected && address) {
    // Ветка стоит на константе времени сборки: `useTurnkey()` бросает вне
    // своего провайдера, поэтому выбор, способный поменяться на лету, нарушил бы
    // правило хуков. `turnkeyLoginEnabled` истинно только вместе с непустым
    // orgId, а значит обёртка Turnkey в этой сборке смонтирована.
    return turnkeyLoginEnabled ? (
      <TurnkeyAwareAddressButton address={address} />
    ) : (
      <PlainAddressButton address={address} />
    );
  }

  // По id, а не по индексу: с появлением двери Turnkey в конфиге два
  // коннектора, и `connectors[0]` подключал бы то, что раньше стоит в списке.
  const connector = connectors.find((c) => c.id === INJECTED_CONNECTOR_ID);
  return (
    <Button
      disabled={isPending || !connector}
      onClick={() => {
        if (!connector) return;
        // Промисом, а не колбэком `onSuccess`: экземпляр этой кнопки в гейте
        // размонтируется ровно в момент успеха — `stage` уходит с `disconnected`, —
        // а поштучные колбэки react-query вызываются только при живых
        // подписчиках, и наблюдатель, снятый при размонтировании, обратно к
        // летящей мутации не прикрепляется. Дверь тогда не запишется, и
        // следующая загрузка не восстановит сессию.
        void connectAsync({ connector })
          .then(() => setDoor("injected"))
          .catch(() => {
            // Отменённый в расширении коннект — обычное дело, не ошибка
            // приложения; дверь в этом случае просто не пишется.
          });
      }}
      data-testid="connect-wallet-button"
    >
      {isPending ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
