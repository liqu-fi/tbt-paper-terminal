import { enterTerminal } from "../pages/flows";
import { MARKET, MARKET_ETH } from "../support/constants";
import { expect, test } from "../support/fixtures";
import { readyWorld } from "../support/world";

const twoMarkets = () => readyWorld({ markets: [MARKET, MARKET_ETH] });

test.describe("market search", () => {
  test("пилюля открывает поиск со всеми рынками", async ({ page, world }) => {
    const { market } = await enterTerminal(page, world, twoMarkets);

    await market.openSearch();
    await expect(market.searchRows).toHaveCount(2);
    await expect(market.marketRow(MARKET.id)).toContainText("BTC");
    await expect(market.marketRow(MARKET_ETH.id)).toContainText("ETH");
  });

  test("ввод сужает список", async ({ page, world }) => {
    const { market } = await enterTerminal(page, world, twoMarkets);

    await market.openSearch();
    await market.searchInput.fill("ETH");
    await expect(market.marketRow(MARKET_ETH.id)).toBeVisible();
    await expect(market.marketRow(MARKET.id)).toHaveCount(0);
  });

  test("выбор строки меняет рынок экрана", async ({ page, world }) => {
    const { market } = await enterTerminal(page, world, twoMarkets);
    await expect(market.pill).toContainText("BTC");

    await market.pickMarket(MARKET_ETH.id);
    await expect(market.pill).toContainText("ETH");
    // Поиск закрывается тем же выбором — иначе следующий клик попадёт в него.
    await expect(market.search).toHaveCount(0);
  });

  test("звезда избранного переживает перезагрузку", async ({ page, world }) => {
    const { app, market } = await enterTerminal(page, world, twoMarkets);

    await market.openSearch();
    await market.favoriteStar(MARKET_ETH.id).click();
    await page.keyboard.press("Escape");

    await page.reload();
    // Терминал возвращается не мгновенно (JWT из localStorage, переподключение
    // кошелька) — сперва дождаться экрана, иначе поиск некуда открывать.
    await expect(app.terminal).toBeVisible({ timeout: 25_000 });
    await market.openSearch();
    // Область поиска — состояние сессии, не настройка: после перезагрузки она
    // снова "All", и переключить её надо руками.
    await page.getByTestId("market-search-scope-favorites").click();
    await expect(market.searchRows).toHaveCount(1);
    await expect(market.marketRow(MARKET_ETH.id)).toBeVisible();
  });

  test("Market Cap — прочерк, а не выдуманное число", async ({
    page,
    world,
  }) => {
    const { market } = await enterTerminal(page, world, twoMarkets);

    // Ни у шлюза, ни в SDK нет circulating supply — ячейка обязана молчать,
    // а не показывать подставленный ноль.
    await market.openSearch();
    const cells = market.marketRow(MARKET.id).locator("> span");
    await expect(cells.nth(4)).toHaveText("—");
  });
});
