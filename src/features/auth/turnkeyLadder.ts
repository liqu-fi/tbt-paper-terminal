// src/features/auth/turnkeyLadder.ts
import type { GasGrantOutcome } from "../wallet/gasGrant";
import type { IdentityDoor } from "./identityDoor";
import type { SessionStage } from "@liq/core";

/**
 * Лестница личности: подписант → wagmi → газ. Один редьюсер, ни строчки React.
 *
 * @remarks
 * Здесь живут ПОПЫТКИ, а не ступень. Где сессия стоит на самом деле, по-прежнему
 * выводит `sessionStage()` из живых запросов; редьюсер, который дублировал бы
 * это, разъехался бы с react-query на первом же перезапросе. Здесь то, чего ни
 * один запрос не знает: что мы для этой личности уже пробовали и чем это
 * кончилось.
 *
 * Шагов три, а не пять, как в `liqu`: создание аккаунта и вход подписью в
 * терминале нажимает пользователь — это и есть то, что эталон показывает
 * интегратору.
 */
export type LadderStep = "resolve" | "connect" | "gas";

/**
 * Одна попытка одного шага.
 *
 * @remarks
 * `seq` — не счётчик повторов, а адрес: он говорит, КАКАЯ попытка приземлилась.
 * Результат попытки, которую уже сменили — вышли и вошли снова, нажали повтор —
 * не находит своего seq и отбрасывается вместо того, чтобы затереть живой ответ.
 */
export type Attempt = { status: "inflight" | "ok" | "failed"; seq: number };

export type LadderState = {
  /** subOrgId. `null`, пока не вошли: выход — это тоже смена личности. */
  key: string | null;
  /** Монотонный, +1 на каждый испущенный эффект. Не откатывается даже сбросом. */
  seq: number;
  attempts: Partial<Record<LadderStep, Attempt>>;
  /** Узнаётся из шага `resolve`; до его приземления отсутствует. */
  address?: `0x${string}`;
  gasOutcome?: GasGrantOutcome;
  error?: Error;
};

/**
 * Наблюдаемый мир. Пересчитывается на каждый рендер, никогда не хранится.
 *
 * @remarks
 * Всё здесь прочитано откуда-то ещё — react-query, wagmi, хранилище шлюза.
 * Держать это вне `LadderState` — то, что не даёт редьюсеру стать второй, более
 * старой копией состояния, у которого уже есть владелец.
 */
export type LadderCtx = {
  key: string | null;
  stage: SessionStage;
  wagmi: {
    isConnected: boolean;
    isConnecting: boolean;
    isReconnecting: boolean;
    /** Приведён к нижнему регистру вызывающим: wagmi отдаёт EIP-55, токен — нет. */
    address: string | null;
  };
  /** Адрес внутри сохранённого токена шлюза, в нижнем регистре, либо null. */
  tokenAddress: string | null;
  silentSigner: boolean;
  /**
   * Дверь, которой вошли в этой вкладке.
   *
   * @remarks
   * Лестница ведёт к встроенному кошельку и газу для него, а это осмысленно
   * только за дверью `turnkey`: `VITE_TURNKEY_SESSION` может поднять сессионные
   * ключи и без двери входа, и тогда пользователь, вошедший расширением,
   * не должен получить ни `connect` на TEE-коннектор, ни запрос газа на
   * адрес, которым никогда не воспользуется.
   */
  door: IdentityDoor | null;
};

export type LadderEffect =
  | { kind: "none" }
  | { kind: "reset"; seq: number }
  | { kind: "resolve-signer"; seq: number }
  | { kind: "connect"; seq: number }
  | { kind: "gas"; seq: number; address: `0x${string}` };

/**
 * Что раннер сообщает о приземлении.
 *
 * @remarks
 * У `connect` варианта нет, и это решение, а не пропуск: `connect` в wagmi —
 * это `mutate()` из react-query, его отказ проглатывается внутри, сообщать
 * нечего. Шаг закрывается наблюдением — `normalise` снимает отметку, когда
 * `wagmi.isConnected` становится истиной. Цена: единственный из трёх шагов, что
 * не умеет заполнить `state.error`; не доехавший connect лечится перезагрузкой.
 */
export type LadderOutcome =
  | { step: "resolve"; ok: true; seq: number; address: `0x${string}` }
  | { step: "resolve"; ok: false; seq: number; error: unknown }
  | { step: "gas"; seq: number; outcome: GasGrantOutcome };

/** Куда дошло разрешение встроенного кошелька — для тех, кто это показывает. */
export type EmbeddedWalletState =
  | { kind: "idle" }
  | { kind: "resolving" }
  | { kind: "ready"; address: `0x${string}` }
  | { kind: "failed"; error: unknown };

export const initialLadderState: LadderState = { key: null, seq: 0, attempts: {} };

const NONE: LadderEffect = { kind: "none" };

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Начинает лестницу заново под новой личностью.
 *
 * @remarks
 * `seq` намеренно переносится, а не обнуляется: запрос, оставшийся в полёте от
 * покидаемой личности, не должен суметь совпасть с попыткой, записанной под
 * новой. Очистка `attempts` — то, что делает каждый шаг доступным снова;
 * сохранение `seq` — то, что делает старые ответы неадресуемыми.
 */
export function identityChanged(state: LadderState, next: string | null): LadderState {
  return { key: next, seq: state.seq, attempts: {} };
}

/** Отмечает попытку как летящую и отдаёт seq, которым она адресуется. */
function begin(state: LadderState, step: LadderStep): { state: LadderState; seq: number } {
  const seq = state.seq + 1;
  return {
    state: { ...state, seq, attempts: { ...state.attempts, [step]: { status: "inflight", seq } } },
    seq,
  };
}

/**
 * Применяет одно приземление.
 *
 * @remarks
 * Отказ в газе закрывается как `'ok'`, а не как `'failed'`: `attempts.gas`
 * значит «мы попросили», а не «нам налили». Записанный провалом, он держал бы
 * пользователя на шаге газа вечно, тогда как `ALREADY_FUNDED` — обычный ответ
 * вернувшемуся. Показывать ли отказ, решается по `gasOutcome`, а не остановкой
 * лестницы.
 */
export function ladderSettle(state: LadderState, outcome: LadderOutcome): LadderState {
  if (state.attempts[outcome.step]?.seq !== outcome.seq) return state;

  const settled = (status: Attempt["status"]) => ({
    ...state.attempts,
    [outcome.step]: { status, seq: outcome.seq },
  });

  if (outcome.step === "gas") {
    return { ...state, attempts: settled("ok"), gasOutcome: outcome.outcome };
  }
  if (!outcome.ok) {
    return { ...state, attempts: settled("failed"), error: toError(outcome.error) };
  }
  return { ...state, attempts: settled("ok"), address: outcome.address };
}

/**
 * Переоткрывает один упавший шаг по команде пользователя.
 *
 * @remarks
 * Единственный выход из провала: одна автоматическая попытка на личность, дальше
 * стоп — в этом весь договор, цикл повторов это не восстановление. Намеренно не
 * внутри `ladderNext`: это команда, а не наблюдение, а `ctx` состоит только из
 * наблюдений.
 */
export function ladderRetry(state: LadderState, step: LadderStep): LadderState {
  if (state.attempts[step]?.status !== "failed") return state;
  const attempts = { ...state.attempts };
  delete attempts[step];
  return { ...state, attempts, error: undefined };
}

/**
 * Приводит состояние в соответствие наблюдаемому миру до разбора правил.
 *
 * @remarks
 * Это НЕ ветка разбора. При «первое совпадение выигрывает» подключённый wagmi
 * возвращался бы отсюда, и лестница никогда не дошла бы до газа — ровно та
 * ошибка, ради которой это вынесено отдельно.
 */
function normalise(state: LadderState, ctx: LadderCtx): LadderState {
  // Локальная переменная, а не переприсваивание параметра: модуль весь
  // построен на неизменяемости, и `state` — не то место, где стоит заводить
  // исключение.
  let next = state;
  // Самый первый вход — не смена личности, а её появление: сбрасывать
  // нечего, attempts и так пуст. Без этой адаптации правило 1 ниже приняло бы
  // `null → ctx.key` за настоящую смену и отдало бы `reset` вместо того,
  // чтобы в этом же тике дойти до `resolve-signer` — то же самое «первое
  // совпадение выигрывает», из-за которого не дожила бы до газа защёлка
  // connect чуть ниже.
  if (next.key === null && ctx.key !== null) {
    next = { ...next, key: ctx.key };
  }
  // Живое подключение снимает защёлку connect. Защищаемся от повтора, пока
  // отключены, а не от подключения после отключения: соединение, которое
  // получилось и потом отвалилось, заслуживает новой попытки, а неудавшееся —
  // нет. Неудачу wagmi не сообщает никак (это `mutate()`), поэтому «не вышло»
  // выражено как «отметка есть, а isConnected ложно».
  if (ctx.wagmi.isConnected && next.attempts.connect) {
    const attempts = { ...next.attempts };
    delete attempts.connect;
    return { ...next, attempts };
  }
  return next;
}

/**
 * Единственный переход: что лестнице делать дальше и каким состоянием это
 * решение записано.
 */
export function ladderNext(
  state: LadderState,
  ctx: LadderCtx,
): { state: LadderState; effect: LadderEffect } {
  const current = normalise(state, ctx);

  // 1. Личность сменилась — в том числе на null, а это и есть выход.
  if (ctx.key !== current.key) {
    const cleared = identityChanged(current, ctx.key);
    const seq = cleared.seq + 1;
    return { state: { ...cleared, seq }, effect: { kind: "reset", seq } };
  }

  // 2. Сохранённый токен называет не тот кошелёк, что подключён. Проверка на
  //    подключённый адрес несущая: восстановленный токен при ещё не
  //    подключённом wagmi — обычное дело, а не рассинхрон, и без неё живая
  //    сессия сбрасывалась бы на каждом холодном старте.
  //    `.toLowerCase()` здесь, а не только на совести вызывающего: договор
  //    «регистр уже приведён» до сих пор жил одним JSDoc на `wagmi.address`, и
  //    второй производитель `LadderCtx`, который его не читает, превратил бы
  //    это сравнение в вечно истинное — вход подписью перестал бы держаться,
  //    гоняя пользователя по кругу вход → сброс → needs-signin без единой
  //    ошибки на экране. Вызов идемпотентен, чистоту редьюсера не нарушает.
  const wagmiAddress = ctx.wagmi.address?.toLowerCase() ?? null;
  const tokenAddr = ctx.tokenAddress?.toLowerCase() ?? null;
  if (wagmiAddress && tokenAddr && tokenAddr !== wagmiAddress) {
    const cleared = identityChanged(current, current.key);
    const seq = cleared.seq + 1;
    return { state: { ...cleared, seq }, effect: { kind: "reset", seq } };
  }

  // 3. Не вошли — лезть некуда.
  if (ctx.key === null) return { state: current, effect: NONE };

  // 4. Подписант. `createEmbeddedWallet` — это fetch-or-create, поэтому второе
  //    одновременное разрешение суб-организации без кошелька создаёт ВТОРОЙ
  //    кошелёк, а `SnxAccount.owner` пишется один раз и не переписывается —
  //    аккаунт проигравшего недостижим навсегда. Эта отметка и есть та
  //    гарантия, которую нельзя доверить модульному промису.
  if (!current.attempts.resolve) {
    const { state: next, seq } = begin(current, "resolve");
    return { state: next, effect: { kind: "resolve-signer", seq } };
  }

  // 5. Разрешение, не приземлившееся в 'ok', останавливает лестницу. Провал,
  //    переоткрывающий себя сам, был бы бесконечным повтором сетевых вызовов:
  //    эффект, который его гоняет, держит это состояние в зависимостях.
  //    Восстановление — `ladderRetry`, по клику.
  //    Половина `!current.address` тоже несущая: она сужает `current.address` до
  //    непустого `0x${string}`, которого требует поле эффекта `gas` в правиле 7.
  if (current.attempts.resolve.status !== "ok" || !current.address) {
    return { state: current, effect: NONE };
  }

  // 6. Отдаём подписанта в wagmi. Только за дверью `turnkey`: сессионные ключи
  //    (`VITE_TURNKEY_SESSION`) могут разрешать встроенный кошелёк и тому, кто
  //    вошёл расширением, и без этой проверки такой пользователь оказался бы
  //    молча переключён под TEE-кошелёк, о существовании которого не знает —
  //    ровно та загрузка под чужой личностью, ради которой писался §2.
  //    Под защёлкой, потому что неудавшийся `connect()` переключает статус
  //    wagmi, статус лежит в зависимостях гоняющего эффекта, и эффект
  //    срабатывает снова — в `liqu` это намеряли как ~200 попыток за несколько
  //    секунд при вкладке на 100% CPU.
  if (
    ctx.door === "turnkey" &&
    !ctx.wagmi.isConnected &&
    !ctx.wagmi.isConnecting &&
    !ctx.wagmi.isReconnecting &&
    !current.attempts.connect
  ) {
    const { state: next, seq } = begin(current, "connect");
    return { state: next, effect: { kind: "connect", seq } };
  }

  // 7. Газ от шлюза. Тоже только за дверью `turnkey` — у внешнего кошелька свой
  //    газ, и просить долив на адрес, которым пользователь никогда не
  //    воспользуется, значит тратить настоящий ETH фаусета и ячейку
  //    рейт-лимита впустую. Идёт до первой ончейн-записи, потому что встроенный
  //    кошелёк создаётся пустым. `address` — разрешённого подписанта, а не
  //    wagmi: сегодня они совпадают, но получить газ должен именно тот, за кого
  //    подписан запрос.
  if (
    ctx.door === "turnkey" &&
    ctx.silentSigner &&
    ctx.stage === "no-account" &&
    !current.attempts.gas
  ) {
    const { state: next, seq } = begin(current, "gas");
    return { state: next, effect: { kind: "gas", seq, address: current.address } };
  }

  return { state: current, effect: NONE };
}

/** Проецирует шаг разрешения на форму, которую читает экран входа. */
export function embeddedWalletView(state: LadderState): EmbeddedWalletState {
  const attempt = state.attempts.resolve;
  if (!attempt) return { kind: "idle" };
  if (attempt.status === "inflight") return { kind: "resolving" };
  if (attempt.status === "failed") return { kind: "failed", error: state.error };
  // 'ok' без адреса через `ladderSettle` недостижимо, но тип это допускает, а
  // 'ready' без адреса был бы ложью.
  return state.address ? { kind: "ready", address: state.address } : { kind: "resolving" };
}

/**
 * Принадлежит ли удержанный по `heldSeq` аккаунт той попытке, которую состояние
 * считает текущей.
 *
 * @remarks
 * Разрешённый `LocalAccount` живёт в ref, вне редьюсера: объекту с методами не
 * место в чистом состоянии. Это же выносит его из-под seq-проверки
 * `ladderSettle` — приземление отменённой личности отбрасывается из состояния и
 * всё равно перезаписывает ref. Адресация тем же `seq` это закрывает: старая
 * запись не совпадёт с живой попыткой и станет инертной вместо ядовитой. Без
 * этого выход во время летящего разрешения с последующим входом другого
 * пользователя отдал бы новой сессии подписанта предыдущей.
 */
export function heldAccountIsCurrent(state: LadderState, heldSeq: number | undefined): boolean {
  const attempt = state.attempts.resolve;
  return attempt?.status === "ok" && attempt.seq === heldSeq;
}

/**
 * Какой аккаунт держать после приземления: более новый из удержанного и
 * пришедшего.
 *
 * @remarks
 * Монотонно по `seq`, ровно как высшая отметка в `claim()`. Адресация не даёт
 * старое приземление ПОКАЗАТЬ; она не мешает его ЗАПИСАТЬ, а запись поверх
 * живого оставила бы текущую сессию с удержанным seq, который уже никогда не
 * совпадёт, — то есть без подписанта до конца жизни. `seq` не откатывается,
 * поэтому «старее» — это обычное сравнение. Обобщено по аккаунту, чтобы файл
 * оставался без viem на поверхности.
 */
export function holdAccount<T>(
  held: { seq: number; account: T } | undefined,
  seq: number,
  account: T,
): { seq: number; account: T } {
  return held && held.seq > seq ? held : { seq, account };
}
