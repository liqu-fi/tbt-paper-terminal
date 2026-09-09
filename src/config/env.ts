/**
 * Resolves the gateway base URL, failing loud when it is missing.
 *
 * A blank `VITE_GATEWAY_URL` used to silently become `baseUrl: ""`, which makes
 * every gateway call (the SIWE `/auth/nonce` that opens sign-in, `/markets`, SSE)
 * hit a relative URL and fail with no visible cause — the "dead Sign In button".
 * Refusing to boot without it surfaces the real problem at startup instead.
 */
function requireGatewayUrl(): string {
  const url = (import.meta.env.VITE_GATEWAY_URL ?? "").replace(/\/$/, "");
  if (!url) {
    throw new Error(
      "VITE_GATEWAY_URL is not set. Without it the terminal cannot reach the " +
        "order-gateway, so sign-in (SIWE) and every gateway request fail " +
        "silently. Copy .env.example to .env and set VITE_GATEWAY_URL " +
        "(e.g. https://staging.hype.cheap/v1 — include the /v1 version prefix).",
    );
  }
  return url;
}

/**
 * Конфигурация Turnkey. Два независимых флага на один конфиг:
 *
 * - `enabled` (`VITE_TURNKEY_SESSION`) — бэкенд **сессионных ключей**: он
 *   выбирает ИСТОЧНИК ключа (анклав против ключа в localStorage), а не наличие
 *   сессии. Выключен — SDK возвращает кошельковый менеджер, 1-click работает
 *   без анклава.
 * - `login` (`VITE_TURNKEY_LOGIN`) — **дверь входа**: модалка Turnkey и
 *   встроенный кошелёк в TEE как подписант.
 *
 * Разведены, потому что это разные решения: вход через Turnkey полезен и без
 * сессионных ключей, а сессионные ключи работали до появления входа. Один флаг
 * на двоих означал бы, что включить одно нельзя, не включив другое.
 */
const turnkey = {
  enabled: import.meta.env.VITE_TURNKEY_SESSION === "true",
  login: import.meta.env.VITE_TURNKEY_LOGIN === "true",
  orgId: import.meta.env.VITE_TURNKEY_ORG_ID ?? "",
  authProxyUrl:
    import.meta.env.VITE_TURNKEY_AUTH_PROXY_URL ??
    "https://authproxy.turnkey.com",
  authProxyConfigId: import.meta.env.VITE_TURNKEY_AUTH_PROXY_CONFIG_ID ?? "",
};

/**
 * Чего не хватает включённой двери входа — или `null`, если всё на месте.
 *
 * @remarks Константа времени сборки, и это несущее свойство, а не деталь:
 * `useTurnkey()` бросает вне своего провайдера, поэтому компонент, который его
 * зовёт, обязан выйти ДО первого хука. Ветка, стоящая на константе, не меняется
 * за время монтирования — правило хуков соблюдено в обеих ветках.
 */
function readTurnkeyConfigError(): string | null {
  if (!turnkey.login) return null;
  const missing = [
    turnkey.orgId ? null : "VITE_TURNKEY_ORG_ID",
    turnkey.authProxyConfigId ? null : "VITE_TURNKEY_AUTH_PROXY_CONFIG_ID",
  ].filter((name): name is string => name !== null);
  if (missing.length === 0) return null;
  return `VITE_TURNKEY_LOGIN=true, но не задано: ${missing.join(", ")}. Вход через Turnkey выключен.`;
}

export const env = {
  deployEnv: (import.meta.env.VITE_DEPLOY_ENV ?? "staging") as
    | "staging"
    | "production",
  chainId: Number(import.meta.env.VITE_CHAIN_ID ?? 6343),
  gatewayUrl: requireGatewayUrl(),
  rpcUrl: import.meta.env.VITE_RPC_URL ?? "https://carrot.megaeth.com/rpc",
  walletConnectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "",
  turnkey,
  turnkeyConfigError: readTurnkeyConfigError(),
};

/**
 * Показывать ли дверь Turnkey. Одно имя вместо повторения условия в четырёх
 * местах: разъехавшиеся копии этого условия — это экран, на котором кнопка
 * входа есть, а провайдера под ней нет.
 */
export const turnkeyLoginEnabled = env.turnkey.login && !env.turnkeyConfigError;
