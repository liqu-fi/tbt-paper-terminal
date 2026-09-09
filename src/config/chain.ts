import { turnkeyConnector } from "@liq/turnkey";
import { defineChain } from "viem";
import { createConfig, http, type Config } from "wagmi";
import { injected } from "wagmi/connectors";

import { e2eWallet, env } from "./env";

export const megaethTestnet = defineChain({
  id: 6343,
  name: "MegaETH Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [env.rpcUrl] } },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://megaeth-testnet-v2.blockscout.com",
    },
  },
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
  testnet: true,
});

/**
 * @remarks
 * Ровно один коннектор на сборку: Turnkey в продукте, `injected()` только под
 * `VITE_E2E_WALLET` (hermetic e2e ставит `window.ethereum` сам). Один коннектор
 * — значит штатный `reconnectOnMount` wagmi восстанавливает ровно его, и
 * помнить «какой дверью входили» незачем.
 *
 * `multiInjectedProviderDiscovery: false` — не оптимизация. По умолчанию wagmi
 * добавляет коннектор на КАЖДЫЙ кошелёк, объявившийся по EIP-6963 (MetaMask,
 * Rabby, Phantom, TronLink…), и «первый авторизованный» в `reconnect()`
 * становится лотереей, в которой встроенный кошелёк Turnkey заведомо
 * проигрывает — его провайдер на старте ещё пуст. Выключенным флагом wagmi
 * заодно перестаёт опрашивать `eth_accounts` у каждого расширения на загрузке.
 *
 * Коннектора `walletConnect()` здесь по-прежнему нет: стек WalletConnect
 * принадлежит `TurnkeyProviderWrapper` на том же project id, а две Core на
 * странице делят clientId через localStorage и дерутся за единственное
 * разрешённое каждой соединение с релеем. Коннектор wagmi к тому же определяет
 * `setup()`, который жадно поднимает `EthereumProvider.init()` во время
 * `createConfig()` — сокет к релею открывался на каждой загрузке страницы даже
 * тем, кто кошелька не касался.
 */
export function getConfig(): Config {
  return createConfig({
    chains: [megaethTestnet],
    connectors: e2eWallet ? [injected()] : [turnkeyConnector()],
    multiInjectedProviderDiscovery: false,
    transports: { [megaethTestnet.id]: http(env.rpcUrl) },
  });
}
