import { AppPage } from "../pages/AppPage";
import { enterTerminal } from "../pages/flows";
import { OrderBookPanel } from "../pages/TerminalPanels";
import { expect, seed, test } from "../support/fixtures";
import { WAD } from "../support/constants";
import {
  armHold,
  readyWorld,
  releaseHold,
  sseOrderbookFrame,
} from "../support/world";

test.describe("order book panel", () => {
  test("панель видна и по умолчанию открыта на книге", async ({
    page,
    world,
  }) => {
    const { book } = await enterTerminal(page, world);
    await expect(book.root).toBeVisible();
    await expect(book.tab("book")).toHaveAttribute("data-state", "active");
  });

  test("503 показывается как «книгу никто не ведёт», а не как пустая книга", async ({
    page,
    world,
  }) => {
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ faults: { orderbookStatus: 503 } }),
    );
    await expect(book.unavailable).toBeVisible();
    await expect(book.empty).toHaveCount(0);
  });

  // Ветка `book-error` не была задействована ни одной спекой — потому
  // перепутанный порядок веток панели и дожил до ревью. 503 — это состояние
  // рынка («движка нет»), любой другой отказ — поломка, и показывать их
  // одинаково нельзя.
  test("500 на затравке — это отказ загрузки, а не отсутствие движка", async ({
    page,
    world,
  }) => {
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ faults: { orderbookStatus: 500 } }),
    );
    await expect(book.error).toBeVisible();
    await expect(book.unavailable).toHaveCount(0);
    await expect(book.empty).toHaveCount(0);
  });

  test("живой кадр после отказа затравки показывает книгу, а не отказ", async ({
    page,
    world,
  }) => {
    // Затравка ходит один раз: `retry: false, staleTime: Infinity` и никакого
    // `refetchInterval` — её ошибка сама не гаснет. Движок, поднявшийся уже
    // после отказа, гасит `unavailable` (появился источник), но `error`
    // остаётся навсегда: сообщение об отказе имеет право показываться только
    // когда показывать нечего, то есть при `asOf === null`.
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ faults: { orderbookStatus: 503 } }),
    );
    await expect(book.unavailable).toBeVisible();

    world.sseFrames = [
      sseOrderbookFrame("200", {
        bids: [{ price: (70_100n * WAD).toString(), size: WAD.toString() }],
        asks: [{ price: (70_200n * WAD).toString(), size: WAD.toString() }],
        asOf: Date.now(),
      }),
    ];

    await expect(book.bidRow(0)).toContainText("70,100", { timeout: 15_000 });
    await expect(book.unavailable).toHaveCount(0);
    await expect(book.error).toHaveCount(0);
  });

  test("без выбранного рынка книга не выдаёт себя за пустую", async ({
    page,
    world,
  }) => {
    // `/markets` лежит ⇒ `useSelectedMarket().marketId` так и остаётся
    // `undefined`, книга выключена и снимка не будет никогда. «Book is empty»
    // здесь было бы утверждением о рынке, которого на экране нет.
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ faults: { marketsStatus: 500 } }),
    );
    await expect(book.noMarket).toBeVisible();
    await expect(book.empty).toHaveCount(0);
    await expect(book.error).toHaveCount(0);
    await expect(book.unavailable).toHaveCount(0);
  });

  test("пока список рынков в полёте, книга ждёт, а не отрицает рынок", async ({
    page,
    world,
  }) => {
    // Соседняя спека держит `/markets` упавшим и ловит только вечный случай.
    // Транзиент бьёт на КАЖДОМ холодном входе: `marketId` равен `undefined`
    // всё время запроса списка, `useOrderbook` при этом выключен и его
    // `isLoading` ложен — панель успевала сказать «рынок не выбран» ровно в
    // тот момент, когда рынок выбирается. `enterTerminal` здесь не годится:
    // `seed` перезаписывает `world` целиком, а барьер нужен ещё до `goto`.
    seed(world, readyWorld());
    armHold(world, "marketsRead");

    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();

    const book = new OrderBookPanel(page);
    await expect(book.loading).toBeVisible();
    await expect(book.noMarket).toHaveCount(0);
    await expect(book.empty).toHaveCount(0);

    releaseHold(world, "marketsRead");
    await expect(book.bidRow(0)).toContainText("69,990");
    await expect(book.loading).toHaveCount(0);
  });

  test("пустая живая книга — не отказ: торгует пул", async ({
    page,
    world,
  }) => {
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ orderbook: { bids: [], asks: [], asOf: Date.now() } }),
    );
    await expect(book.empty).toBeVisible();
    await expect(book.unavailable).toHaveCount(0);
  });

  test("книга рисует обе стороны, лучший аск — вплотную к спреду", async ({
    page,
    world,
  }) => {
    const { book } = await enterTerminal(page, world);
    // Числа строк тут нет намеренно: с Ф7 книга считает слоты от высоты панели
    // (`useBookSlots`), и прибитая к макету десятка проверяла бы размер окна
    // Playwright, а не книгу. Инвариант — стороны симметричны и непусты.
    // `count()` — мгновенный снимок без автоожидания: сперва дождаться, что
    // книга вообще нарисовалась, иначе счёт снимется с пустого DOM.
    await expect(book.asks.first()).toBeVisible();
    const asks = await book.asks.count();
    expect(asks).toBeGreaterThan(0);
    await expect(book.bids).toHaveCount(asks);
    // мир отдаёт 20 уровней на сторону шагом $10 вокруг $70 000; шаг группировки
    // по умолчанию — тоже 10, поэтому уровни видны как есть
    await expect(book.bidRow(0)).toContainText("69,990");
    // Аски идут сверху вниз к спреду: лучший — последний в списке.
    await expect(book.askRow(asks - 1)).toContainText("70,010");
  });

  test("строка спреда показывает величину и долю", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world);
    // лучший бид 69 990, лучший аск 70 010 — спред ровно 20, а не ширина группы
    await expect(book.spread).toContainText("20");
    await expect(book.spread).toContainText("%");

    // При шаге 10 (умолчание) группа совпадает с сырым уровнем один в один,
    // поэтому «asks[0].price − bids[0].price» дал бы то же самое число и не
    // отличил бы правильный расчёт от неправильного. Шаг 100 разводит их:
    // группа даёт 200 (69,900 и 70,100), а настоящий спред остаётся 20.
    await book.selectTick(1);
    await expect(book.spread).toContainText("20");
    await expect(book.spread).not.toContainText("200");
  });

  test("режим «только биды» убирает аски и удваивает число строк", async ({
    page,
    world,
  }) => {
    const { book } = await enterTerminal(page, world);
    await expect(book.bids.first()).toBeVisible();
    const both = await book.bids.count();
    await book.setView("bids");
    await expect(book.asks).toHaveCount(0);
    // Место, которое делили две стороны, целиком достаётся одной. Не «ровно
    // вдвое»: слоты считаются от высоты панели делением НАЦЕЛО, и остаток,
    // которого не хватало на пару строк, в одностороннем режиме даёт ещё одну
    // (4 и 4 против 9, а не 8).
    await expect
      .poll(() => book.bids.count())
      .toBeGreaterThanOrEqual(both * 2);
    expect(await book.bids.count()).toBeLessThanOrEqual(both * 2 + 1);
  });

  test("смена шага перегруппировывает книгу", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world);
    await expect(book.bidRow(0)).toContainText("69,990");
    await book.selectTick(1); // шаг 100: три верхних бида схлопываются в 69,900
    await expect(book.bidRow(0)).toContainText("69,900");
  });

  test("живой снимок книги вытесняет затравку", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world);
    await expect(book.bidRow(0)).toContainText("69,990");

    // Тот же рынок, книга сдвинута на $100 вверх. Событие обязано победить
    // затравку по времени: `useOrderbook` берёт не последнего пришедшего, а
    // того, чья отметка свежее.
    world.sseFrames = [
      sseOrderbookFrame("200", {
        bids: [{ price: (70_100n * WAD).toString(), size: WAD.toString() }],
        asks: [{ price: (70_200n * WAD).toString(), size: WAD.toString() }],
        asOf: Date.now() + 1000,
      }),
    ];

    await expect(book.bidRow(0)).toContainText("70,100", { timeout: 15_000 });
  });

  test("полоса дисбаланса показывает перевес сторон", async ({
    page,
    world,
  }) => {
    const { book } = await enterTerminal(page, world);
    await expect(book.imbalance).toBeVisible();
    await expect(book.imbalance).toContainText("%");
  });

  test("полоса дисбаланса читает всю книгу, а не только показанный срез", async ({
    page,
    world,
  }) => {
    // Видимых (режим «обе стороны», depth=10) бидов — 10, по 1 каждый: срез
    // суммируется в 10. Но за экраном ещё 5 уровней по 100 — полный бид-объём
    // 510. Асков — 15 по 1, итого 15 на всю книгу (10 видно). Если бы полоса
    // считалась по показанному срезу (10 против 10), она бы легла 50/50; по
    // всей книге (510 против 15) перевес почти весь у бидов — 97%.
    const level = (price: bigint, size: bigint) => ({
      price: price.toString(),
      size: size.toString(),
    });
    const bids = [
      ...Array.from({ length: 10 }, (_, i) =>
        level(70_000n * WAD - BigInt(i + 1) * 10n * WAD, WAD),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        level(69_890n * WAD - BigInt(i) * 10n * WAD, 100n * WAD),
      ),
    ];
    const asks = Array.from({ length: 15 }, (_, i) =>
      level(70_000n * WAD + BigInt(i + 1) * 10n * WAD, WAD),
    );

    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ orderbook: { bids, asks, asOf: Date.now() } }),
    );

    await expect(
      book.imbalance.getByTestId("book-imbalance-bid"),
    ).toContainText("97");
    await expect(
      book.imbalance.getByTestId("book-imbalance-ask"),
    ).toContainText("3");
  });

  test("клик по биду переносит цену в тикет", async ({ page, world }) => {
    // `enterTerminal` уже возвращает `trade` (пейдж-обжект `TradePanel`) и `book`.
    // Слаг вкладки в пейдж-обжекте строчный (`TradeTab` в `TerminalPanels.ts`),
    // локальное состояние формы — с заглавной (`Tab` = "Market" | "Limit" | …).
    const { book, trade } = await enterTerminal(page, world);
    // Лучший бид фикстуры — 69 990; книга печатает его с разделителем групп,
    // поле — без. Читать текст строки нельзя: три ячейки — grid-элементы, и
    // `innerText` режет их построчно по-разному в разных раскладках.
    await expect(book.bidRow(0)).toContainText("69,990");
    await book.bidRow(0).click();
    await expect(trade.tab("limit")).toHaveAttribute("data-state", "active");
    await expect(trade.limitPriceInput).toHaveValue("69990");
  });

  test("повторный клик после ручной правки возвращает цену уровня", async ({
    page,
    world,
  }) => {
    const { book, trade } = await enterTerminal(page, world);
    await book.bidRow(0).click();
    await trade.limitPriceInput.fill("1");
    await book.bidRow(0).click();
    await expect(trade.limitPriceInput).not.toHaveValue("1");
  });

  test("пустой слот книги не становится кнопкой", async ({ page, world }) => {
    const level = (price: bigint) => ({
      price: price.toString(),
      size: WAD.toString(),
    });
    // Режим «только биды» просит 20 строк (`SLOTS_ONE_SIDE`); книга даёт
    // только 2 уровня — 18 слотов остаются пустыми. Ни один текущий сценарий
    // фикстуры не бьёт по этой ветке (затравка полна на всю глубину), так что
    // без этой проверки кликабельный пустой слот прошёл бы гейт незамеченным.
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({
        orderbook: {
          bids: [level(69_990n * WAD), level(69_980n * WAD)],
          asks: [level(70_010n * WAD), level(70_020n * WAD)],
          asOf: Date.now(),
        },
      }),
    );
    await book.setView("bids");
    const emptySlot = book.root.getByTestId("book-slot-empty").first();
    await expect(emptySlot).toBeVisible();
    expect(await emptySlot.evaluate((el) => el.tagName)).toBe("DIV");
  });
});
