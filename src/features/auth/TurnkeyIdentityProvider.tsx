import {
  AUTHED_QUERY_PREFIXES,
  AuthState,
  useGatewayStore,
  useSessionStage,
  useTurnkey,
} from "@liq/react";
import {
  createEmbeddedProvider,
  setTurnkeyProvider,
  TURNKEY_CONNECTOR_ID,
} from "@liq/turnkey";
import { tokenAddress } from "@liq/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LocalAccount } from "viem";
import { useAccount, useConnect, useReconnect } from "wagmi";

import { megaethTestnet } from "../../config/chain";
import { env } from "../../config/env";
import { useIdentityDoor } from "./IdentityDoorProvider";
import {
  embeddedWalletView,
  heldAccountIsCurrent,
  holdAccount,
  initialLadderState,
  ladderNext,
  ladderRetry,
  ladderSettle,
  type EmbeddedWalletState,
  type LadderCtx,
  type LadderEffect,
  type LadderOutcome,
  type LadderState,
} from "./turnkeyLadder";

export type TurnkeyIdentityValue = {
  state: LadderState;
  effect: LadderEffect;
  account: LocalAccount | undefined;
  embedded: EmbeddedWalletState;
  /** subOrgId текущей личности — его требует тело запроса на газ. */
  subOrgId: string | null;
  claim: (effect: LadderEffect) => boolean;
  settle: (outcome: LadderOutcome) => void;
  settleResolve: (
    seq: number,
    result:
      | { ok: true; address: `0x${string}`; account: LocalAccount }
      | { ok: false; error: unknown },
  ) => void;
  retryResolve: () => void;
  silentSigner: boolean;
};

const TurnkeyIdentityContext = createContext<TurnkeyIdentityValue | null>(null);

/** Читает личность Turnkey. Бросает вне `<TurnkeyIdentityProvider>`. */
export function useTurnkeyIdentity(): TurnkeyIdentityValue {
  const value = useContext(TurnkeyIdentityContext);
  if (!value) {
    throw new Error("useTurnkeyIdentity: только внутри <TurnkeyIdentityProvider>");
  }
  return value;
}

type Machine = { state: LadderState; effect: LadderEffect };
type Action =
  | { type: "observe"; ctx: LadderCtx }
  | { type: "settle"; outcome: LadderOutcome }
  | { type: "retry" };

const NONE: LadderEffect = { kind: "none" };

function machineReduce(machine: Machine, action: Action): Machine {
  switch (action.type) {
    case "observe": {
      const next = ladderNext(machine.state, action.ctx);
      // Сравнение по идентичности, не по глубокому равенству: `ladderNext`
      // возвращает тот же объект состояния, когда ничего не сдвинулось, а React
      // на том же значении редьюсера не перерисовывает — это и не даёт эффекту
      // наблюдения кормить самого себя.
      if (next.state === machine.state && next.effect.kind === "none") return machine;
      return next;
    }
    // Оба ниже переносят `machine.effect` нетронутым. Обнулить его значило бы
    // потерять эффект, который испущен, но ещё не заявлен: клик «повторить»,
    // попавший между коммитом и сбросом эффектов, оставил бы лестницу с
    // отметкой «летит» и без того, кто её гоняет. `claim()` — единственный
    // арбитр начатого, поэтому пронести отработанный эффект ничего не стоит:
    // раннер, увидевший его снова, получит отказ по seq.
    case "settle":
      return { state: ladderSettle(machine.state, action.outcome), effect: machine.effect };
    case "retry":
      return { state: ladderRetry(machine.state, "resolve"), effect: machine.effect };
  }
}

/**
 * Владелец лестницы личности и мост между Turnkey и wagmi.
 *
 * @remarks
 * Монтируется внутри `<TurnkeyProviderWrapper>` (нужен `useTurnkey`) и внутри
 * `<LiqProvider>` / `<WagmiProvider>` (нужны ступень сессии и `useConnect`), а
 * значит и внутри `<IdentityDoorProvider>` — он стоит выше `LiqSetup`
 * безусловно (см. `AppProviders.tsx`), так что `useIdentityDoor()` здесь
 * никогда не бросает. Дверь нужна правилам 6 и 7 лестницы: сессионные ключи
 * могут разрешить встроенный кошелёк и тому, кто вошёл расширением, и без
 * двери лестница молча подключила бы его к TEE-кошельку и попросила бы газ
 * на адрес, которым он не пользуется.
 *
 * `ranSeq` — ref, а не состояние: это высшая отметка реально начатых
 * эффектов для `claim()`, и ей ничего не стоит быть на один тик позади —
 * StrictMode в React 19 прогоняет setup эффекта дважды до того, как
 * коммитится диспатч первого прогона, и оба прогона видят один эффект.
 *
 * `heldAccount`, наоборот, — обычное состояние, не ref: `LocalAccount`
 * держится вне пуре-редьюсера лестницы (объекту с методами не место в
 * состоянии, которым управляет чистая функция), но читается он и во время
 * рендера (`silentSigner`, отдаваемый `account`) — правило `react-hooks/refs`
 * запрещает читать `.current` там, и это не блажь линтера: React волен звать
 * тело компонента, не коммитя его, и ref, прочитанный в такой момент, отдал
 * бы значение, которого рендер как бы не видел. `settleResolve` пишет через
 * функциональную форму `setHeldAccount`, поэтому не ловит замыкание на
 * устаревшем значении, хотя сам объявлен с пустыми deps.
 */
export function TurnkeyIdentityProvider({ children }: { children: ReactNode }) {
  const { authState, session } = useTurnkey();
  const stage = useSessionStage();
  const { door } = useIdentityDoor();
  const wagmiAccount = useAccount();
  const token = useGatewayStore((s) => s.token);
  const queryClient = useQueryClient();
  const { connect, connectors } = useConnect();
  const { reconnect } = useReconnect();

  const [machine, dispatch] = useReducer(machineReduce, {
    state: initialLadderState,
    effect: NONE,
  });

  const [heldAccount, setHeldAccount] = useState<
    { seq: number; account: LocalAccount } | undefined
  >(undefined);
  const ranSeq = useRef(0);

  const subOrgId =
    authState === AuthState.Authenticated ? (session?.organizationId ?? null) : null;

  const silentSigner = Boolean(
    machine.state.address && heldAccountIsCurrent(machine.state, heldAccount?.seq),
  );

  const wagmiAddress = wagmiAccount.address?.toLowerCase() ?? null;

  const ctx = useMemo<LadderCtx>(
    () => ({
      key: subOrgId,
      stage,
      wagmi: {
        isConnected: wagmiAccount.isConnected,
        isConnecting: wagmiAccount.isConnecting,
        isReconnecting: wagmiAccount.isReconnecting,
        address: wagmiAddress,
      },
      tokenAddress: tokenAddress(token),
      silentSigner,
      door,
    }),
    [
      subOrgId,
      stage,
      wagmiAccount.isConnected,
      wagmiAccount.isConnecting,
      wagmiAccount.isReconnecting,
      wagmiAddress,
      token,
      silentSigner,
      door,
    ],
  );

  useEffect(() => {
    dispatch({ type: "observe", ctx });
  }, [ctx, machine.state]);

  const claim = useCallback((effect: LadderEffect) => {
    if (effect.kind === "none" || effect.seq <= ranSeq.current) return false;
    ranSeq.current = effect.seq;
    return true;
  }, []);

  // Гигиена сессии на сбросе: токен шлюза принадлежит одному кошельку, поэтому
  // смена личности, выход или восстановленный токен с чужим адресом одинаково
  // роняют токен, приватные кэши и реестр провайдеров. `removeQueries`, а не
  // инвалидация: перезапрос со старым токеном воспроизвёл бы ровно то, что
  // убирали.
  //
  // `heldAccount` здесь намеренно не трогается: `setState` синхронно внутри
  // тела эффекта запрещает `react-hooks/set-state-in-effect` (тот же приём, что
  // и `booting` в IdentityDoorProvider), а очищать нечего — `identityChanged`
  // обнуляет `attempts.resolve`, `heldAccountIsCurrent` тут же перестаёт
  // признавать оставшийся объект текущим, а `seq` монотонен и никогда не
  // переиспользуется, так что следующий resolve замещает его в `holdAccount`
  // независимо от того, был ли он явно обнулён.
  useEffect(() => {
    if (machine.effect.kind !== "reset") return;
    if (!claim(machine.effect)) return;
    useGatewayStore.getState().clearToken();
    setTurnkeyProvider(undefined);
    for (const prefix of AUTHED_QUERY_PREFIXES) {
      queryClient.removeQueries({ queryKey: prefix });
    }
  }, [machine.effect, claim, queryClient]);

  // Разрешённый подписант становится EIP-1193-провайдером и уходит в реестр:
  // ключ в TEE не расширение браузера, в списке `walletProviders` у Turnkey его
  // не бывает, поэтому провайдер синтезируется.
  useEffect(() => {
    if (authState !== AuthState.Authenticated || !silentSigner) {
      setTurnkeyProvider(undefined);
      return;
    }
    const account = heldAccount?.account;
    if (!account) return;
    setTurnkeyProvider(
      createEmbeddedProvider({ account, chain: megaethTestnet, rpcUrl: env.rpcUrl }),
    );
  }, [authState, silentSigner, heldAccount]);

  useEffect(() => {
    if (machine.effect.kind !== "connect") return;
    const connector = connectors.find((c) => c.id === TURNKEY_CONNECTOR_ID);
    if (!connector) return;
    if (!claim(machine.effect)) return;
    // Оба вызова уходят не дожидаясь друг друга — это гонка, а не
    // последовательность. `reconnect()` перенимает соединение, которое провайдер
    // уже держит; `connect()` заводит новое и бросает
    // ConnectorAlreadyConnectedError, когда живое уже есть. Бросок безвреден:
    // `connect` — это `mutate()`, а не `mutateAsync()`, отказ проглатывается
    // внутри react-query. Вдвоём они покрывают и первое подключение, и всё ещё
    // живой провайдер, ничего не дожидаясь.
    reconnect({ connectors: [connector] });
    connect({ connector });
  }, [machine.effect, claim, connectors, connect, reconnect]);

  const settle = useCallback(
    (outcome: LadderOutcome) => dispatch({ type: "settle", outcome }),
    [],
  );

  const settleResolve = useCallback<TurnkeyIdentityValue["settleResolve"]>(
    (seq, result) => {
      if (result.ok) {
        // Функциональная форма `setHeldAccount`, а не чтение снаружи через
        // замыкание: колбэк объявлен с пустыми deps (стабилен для эффектов
        // раннеров), обычное замыкание держало бы `heldAccount` времён
        // создания колбэка. `prev` внутри апдейтера — всегда самое свежее
        // состояние на момент применения. `holdAccount` — монотонность по
        // `seq`: позднее приземление отменённой попытки не должно затереть
        // живое; React батчит этот вызов с диспатчем ниже в один рендер, так
        // что оба всегда видны вместе.
        setHeldAccount((prev) => holdAccount(prev, seq, result.account));
        dispatch({
          type: "settle",
          outcome: { step: "resolve", ok: true, seq, address: result.address },
        });
        return;
      }
      dispatch({
        type: "settle",
        outcome: { step: "resolve", ok: false, seq, error: result.error },
      });
    },
    [],
  );

  const retryResolve = useCallback(() => dispatch({ type: "retry" }), []);

  const value = useMemo<TurnkeyIdentityValue>(
    () => ({
      state: machine.state,
      effect: machine.effect,
      // Выводится через `heldAccountIsCurrent`, а не отдаётся `heldAccount`
      // сырьём: его `seq` может отстать от того, что лестница считает
      // актуальной попыткой `resolve` ПРЯМО СЕЙЧАС (новый resolve уже начат,
      // а прошлый аккаунт ещё не заменён) — тогда он принадлежит уже не той
      // попытке, и отдавать его как текущего подписанта нельзя.
      account: heldAccountIsCurrent(machine.state, heldAccount?.seq)
        ? heldAccount?.account
        : undefined,
      embedded: embeddedWalletView(machine.state),
      subOrgId,
      claim,
      settle,
      settleResolve,
      retryResolve,
      silentSigner,
    }),
    [
      machine.state,
      machine.effect,
      subOrgId,
      claim,
      settle,
      settleResolve,
      retryResolve,
      silentSigner,
      heldAccount,
    ],
  );

  return (
    <TurnkeyIdentityContext.Provider value={value}>
      {children}
    </TurnkeyIdentityContext.Provider>
  );
}
