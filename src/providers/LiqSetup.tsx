import {
  LiqProvider,
  TurnkeyProviderWrapper,
  useGatewayStore,
} from "@liq/react";
import { LiqClient, LiqOnchain } from "@liq/sdk";
import { type ReactNode, useEffect, useMemo } from "react";
import { createPublicClient, http } from "viem";
import { useChainId, useWalletClient } from "wagmi";

// Единственный прямой импорт `@turnkey/*` в приложении, и только ради таблицы стилей:
// без неё модалка входа рендерится голой — в dev кит подменяет её экраном «стили не
// найдены», в prod она просто выглядит сломанной. Пакет объявлен в package.json тем же
// диапазоном, что и в `@liq/turnkey`, чтобы обе ссылки указывали на одну версию.
//
// Импортировать отсюда ЧТО-ЛИБО КРОМЕ стилей нельзя: таблица стилей не инстанцирует
// ничего, а второй экземпляр JS-кита поделит с первым ключи `@turnkey/session/v3` в
// localStorage, и две копии испортят сессии друг другу.
import "@turnkey/react-wallet-kit/styles.css";

import { megaethTestnet } from "../config/chain";
import { env, turnkeyLoginEnabled } from "../config/env";
import { TurnkeyIdentityProvider } from "../features/auth/TurnkeyIdentityProvider";
import { turnkeyAuthMethods } from "../features/auth/turnkeyAuthMethods";

/**
 * Builds the two SDK singletons and mounts <LiqProvider>.
 *
 * @remarks
 * - baseUrl points DIRECTLY at the gateway (no Next proxy); the same URL is
 *   reused for SSE, so the gateway must allow CORS from this origin.
 * - LiqClient does NOT subscribe to the gateway store — the token useEffect
 *   below is the load-bearing wiring that keeps the JWT on the client.
 * - LiqOnchain is rebuilt when the wallet changes so writes pick up the signer.
 */
export function LiqSetup({ children }: { children: ReactNode }) {
  const chainId = useChainId();
  const token = useGatewayStore((s) => s.token);
  const { data: walletClient } = useWalletClient();

  const liqClient = useMemo(
    () =>
      new LiqClient({
        baseUrl: env.gatewayUrl,
        chainId: chainId ?? megaethTestnet.id,
      }),
    [chainId],
  );

  const liqOnchain = useMemo(() => {
    const publicClient = createPublicClient({
      chain: megaethTestnet,
      transport: http(megaethTestnet.rpcUrls.default.http[0]),
    });
    return new LiqOnchain({
      chainId: megaethTestnet.id,
      publicClient,
      walletClient: walletClient ?? undefined,
    });
  }, [walletClient]);

  useEffect(() => {
    liqClient.setToken(token);
  }, [liqClient, token]);

  // `sessionKey` передаётся ВСЕГДА, а не под флагом Turnkey: флаг выбирает
  // ИСТОЧНИК ключа (бэкенд Turnkey против ключа в localStorage), а не наличие
  // сессии. Погасив пропс вместе с флагом, мы отняли бы одноклик у всех, кто
  // держит ключ локально, — и подпись молча ушла бы в кошелёк.
  //
  // Обёртка Turnkey — снаружи: `LiqProvider` с этим пропсом зовёт
  // `useSessionKeyManager`, которому нужен её контекст сверху.
  const { enabled, orgId, authProxyUrl, authProxyConfigId } = env.turnkey;
  const { methods, methodOrder } = turnkeyAuthMethods();
  // Обёртка нужна и сессионным ключам, и двери входа — поднимаем её, если хоть
  // одно из двух включено и конфиг на месте. Прежнее условие смотрело только на
  // флаг сессионных ключей, то есть вход без них был бы невозможен.
  const mounted = Boolean(orgId) && (enabled || turnkeyLoginEnabled);

  const inner = mounted ? (
    <TurnkeyIdentityProvider>{children}</TurnkeyIdentityProvider>
  ) : (
    children
  );

  const provider = (
    <LiqProvider client={liqClient} onchain={liqOnchain} sessionKey={env.turnkey}>
      {inner}
    </LiqProvider>
  );

  if (!mounted) return provider;

  return (
    <TurnkeyProviderWrapper
      orgId={orgId}
      authProxyUrl={authProxyUrl}
      authProxyConfigId={authProxyConfigId}
      walletConnectProjectId={env.walletConnectId || undefined}
      chainIds={[String(env.chainId)]}
      authMethods={methods}
      methodOrder={methodOrder}
      provisionEmbeddedWallet
      appName="Liq"
      // Обязан быть ORIGIN'ом ЭТОЙ сборки, а не постоянным доменом: он
      // становится `appMetadata.url` у WalletConnect, и кошелёк показывает его
      // в листе подтверждения. Прибитый домен заставлял каждый preview-деплой
      // называться продакшеном — WalletConnect предупреждает о расхождении, а
      // пользователю это читается как фишинг.
      appUrl={window.location.origin}
    >
      {provider}
    </TurnkeyProviderWrapper>
  );
}
