import { useMarketChannel, useTradesRestQuery } from "@liq/react";
import type { ListTradesQuery, TradeEventData, TradeRow } from "@liq/sdk";
import { parseWadLoose } from "@liq/core";
import { useState } from "react";


/** Сколько строк держит лента — и REST-страница, и живой буфер. */
export const TAPE_LIMIT = 50;

/**
 * One row of the public trade tape — a settled fill or a live tick,
 * normalized to a single shape.
 *
 * @remarks `key` is the REST row's `id` for a fill; a live tick has none
 * ({@link TradeEventData} reports no id), so its key comes from the live
 * buffer's own counter. It must NOT be derived from the payload: the matcher
 * writes every fill of one match in a single loop under a shared `timestamp`,
 * and a fill's price is the maker's limit price — a taker sweeping two makers
 * at the SAME level emits two events identical in both fields. A key built
 * from them would collide, and React would silently drop one of the two rows
 * on the next re-render: the tape would undercount a real trade. `txHash` is
 * `null` for every live row for a related reason: the event never carries one,
 * and printing an explorer link anyway would assert a fact the event never
 * reported. Maker/taker role is absent from this shape entirely — the tape is
 * the public feed, and role only exists relative to one account's own history
 * (see `HistoryTable`).
 */
export interface TapeRow {
  key: string;
  timestamp: number;
  price: bigint;
  size: bigint;
  side: "BUY" | "SELL";
  txHash: string | null;
}

function fromRestRow(row: TradeRow): TapeRow {
  return {
    key: row.id,
    timestamp: row.timestamp,
    price: row.price,
    size: row.size,
    side: row.side,
    txHash: row.txHash,
  };
}

/**
 * A live tick as a tape row — or `null` when its side isn't one of the two
 * literals the tape can colour.
 *
 * @remarks {@link TradeEventData} types `side` as a bare `string`, so a value
 * outside the pair is a shape the wire can actually deliver. The old
 * `side === "SELL" ? "SELL" : "BUY"` painted every such event green — a
 * statement about the market that nothing reported. Dropping the event instead
 * costs only latency: the same fill comes back on the next REST page, already
 * typed. Same trade-off as the strict `>` boundary in {@link freshLiveRows} —
 * the truth late beats a lie now.
 *
 * @param seq - The buffer's monotonic counter; the row's key, see
 * {@link TapeRow}.
 */
export function fromLiveEvent(
  data: TradeEventData,
  seq: number,
): TapeRow | null {
  const side =
    data.side === "SELL" ? "SELL" : data.side === "BUY" ? "BUY" : null;
  if (side === null) return null;
  return {
    key: `live-${seq}`,
    timestamp: data.timestamp,
    price: parseWadLoose(data.price),
    size: parseWadLoose(data.size),
    side,
    txHash: null,
  };
}

/**
 * Live rows still worth showing: only events strictly newer than the freshest
 * REST row.
 *
 * @remarks There is no id to dedupe by — a live tick simply doesn't carry one
 * (see {@link TapeRow}) — so the boundary is a timestamp, not an equality
 * check: no row is ever compared against another. A live tick that a later
 * REST page also carries stays visible until that page replaces it; it is not
 * shown twice, because the live copy sits above the page rather than beside
 * it. Nothing in the terminal makes that page arrive on a schedule:
 * `useTradesRestQuery` has no `refetchInterval` and this hook can't give it
 * one, so a refetch happens only on window focus or a remount (a market switch
 * or a tab switch back to Trades). An empty REST page (still loading, or a
 * market with no history yet) sets no boundary at all — every live row passes
 * rather than none.
 *
 * The boundary is `Math.max` over the whole page, not `restRows[0]`: the
 * gateway sorts newest-first, but nothing here enforces that, and reading only
 * the head would silently take a stale boundary from a page sorted the other
 * way. Over a correctly sorted page the two agree.
 *
 * Strict `>`, not `>=`, is deliberate: fills from one match are written in a
 * single transaction and can share the freshest REST row's `timestamp` down to
 * the millisecond (see `ListTradesQuery.cursor`'s TSDoc in the SDK) — a live
 * tick at that exact boundary may be a *different* trade from the same match,
 * not a duplicate. `>` holds it back one REST page rather than risk showing it
 * twice; a trade appearing a page late is honest, a trade shown twice is a lie
 * about what happened on the market.
 */
export function freshLiveRows(
  live: readonly TapeRow[],
  restRows: readonly TapeRow[],
): TapeRow[] {
  const boundary = restRows.reduce(
    (newest, row) => Math.max(newest, row.timestamp),
    -Infinity,
  );
  return live.filter((row) => row.timestamp > boundary);
}

interface UseTradesTapeResult {
  rows: TapeRow[];
  isLoading: boolean;
}

/**
 * Живые тики и счётчик их ключей — одно состояние.
 *
 * @remarks Счётчик не выводится из длины `rows`: буфер обрезан по
 * `TAPE_LIMIT`, и после переполнения длина перестала бы расти, а ключи —
 * различаться.
 */
interface LiveBuffer {
  rows: TapeRow[];
  seq: number;
}

/** Начальное состояние буфера: тиков нет, счётчик на нуле. */
export const EMPTY_LIVE_BUFFER: LiveBuffer = { rows: [], seq: 0 };

/**
 * Кладёт живой тик в буфер, возвращая новое состояние.
 *
 * @remarks Вынесено из апдейтера `setLive` не ради красоты: инкремент
 * счётчика — единственное место, где ключ живой строки становится
 * уникальным, и внутри `setState` его нечем проверить. Счётчик инкрементится
 * сам и НЕ выводится из `rows.length`: буфер обрезан по {@link TAPE_LIMIT},
 * после насыщения длина перестаёт расти, и ключи начали бы повторяться —
 * ровно та коллизия, от которой ключ и уводили (см. {@link TapeRow}).
 *
 * Событие с нераспознанной стороной буфер не меняет и счётчика не тратит:
 * возвращается та же ссылка `prev`, чтобы React не считал это изменением
 * состояния и не платил лишним рендером.
 */
export function pushLive(prev: LiveBuffer, data: TradeEventData): LiveBuffer {
  const row = fromLiveEvent(data, prev.seq);
  if (row === null) return prev;
  return {
    rows: [row, ...prev.rows].slice(0, TAPE_LIMIT),
    seq: prev.seq + 1,
  };
}

/**
 * Market trade tape: the REST page from `useTradesRestQuery` plus a buffer
 * of live `trades:{marketId}` ticks layered on top, newest first.
 *
 * @remarks The live buffer is appended to by comparing `event` against the
 * previous render's value *during render*, not inside a `useEffect` — the
 * "adjusting state when a prop changes" pattern from the React docs (same
 * one `useBookTick` uses for its own reset). `react-hooks/set-state-in-effect`
 * forbids a synchronous `setState` inside an effect body precisely because it
 * costs an extra commit with stale state visible in between; doing the
 * comparison in the render body lets React fold the adjustment into the same
 * render instead. A market switch is handled by the caller mounting this hook
 * under `key={marketId}` — the freshest way to blank per-market state is to
 * let the whole component (and its `useState`) remount, not to chase the
 * change with more render-time comparisons.
 */
export function useTradesTape(
  marketId: bigint | null | undefined,
): UseTradesTapeResult {
  const filter: ListTradesQuery =
    marketId != null ? { marketId, limit: TAPE_LIMIT } : { limit: TAPE_LIMIT };
  const { data, isLoading } = useTradesRestQuery(filter);
  /**
   * Страница REST — только когда есть рынок, чью ленту мы показываем.
   *
   * @remarks Без рынка фильтр теряет `marketId`, и гейтвей отвечает
   * МЕЖРЫНОЧНЫМ потоком: вкладка Trades нарисовала бы чужие сделки рядом с
   * «рынок не выбран». Запрос при этом всё равно уходит — `useTradesRestQuery`
   * не принимает `enabled` и выключить себя не даёт; лишний `GET /trades` при
   * пустом рынке остаётся за SDK, здесь отсекается только показ.
   */
  const restRows =
    marketId != null ? (data?.rows ?? []).map(fromRestRow) : [];

  const event = useMarketChannel(marketId, "trades");
  const [lastEvent, setLastEvent] = useState(event);
  const [live, setLive] = useState<LiveBuffer>(EMPTY_LIVE_BUFFER);

  if (event !== lastEvent) {
    setLastEvent(event);
    if (event) setLive((prev) => pushLive(prev, event.data));
  }

  const rows = [...freshLiveRows(live.rows, restRows), ...restRows].slice(
    0,
    TAPE_LIMIT,
  );

  // Ожидание страницы — тоже только при рынке: без него ждать нечего, а
  // «Loading trades…» навсегда читалось бы как «сейчас приедет».
  return { rows, isLoading: marketId != null && isLoading };
}
