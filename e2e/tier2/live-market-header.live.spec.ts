import { AppPage } from "../pages/AppPage";
import { ChartFramePage, MarketHeaderPanel } from "../pages/TerminalPanels";
import { liveConfigured } from "./env";
import { expect, test } from "./liveFixtures";

test.describe("live: шапка рынка и рамка чарта", () => {
  test.beforeEach(() => {
    const gate = liveConfigured();
    test.skip(!gate.ok, gate.reason);
  });

  test("поиск открывается на живом списке рынков и меняет рынок", async ({
    page,
  }) => {
    // Мок отдаёт ровно те рынки, которые ему положили. Живой ярус проверяет
    // другое: список приходит из шлюза и не пуст, а выбор из него доезжает до
    // экрана — то есть форма ответа `/markets/full` совпала с ожидаемой.
    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();

    const market = new MarketHeaderPanel(page);
    await market.openSearch();
    await expect(market.searchRows.first()).toBeVisible({ timeout: 20_000 });
    const count = await market.searchRows.count();
    expect(count).toBeGreaterThan(0);

    const first = market.searchRows.first();
    // Символ — первая жирная подпись строки; после выбора он же стоит в пилюле.
    const symbol = await first.locator("span.font-semibold").first().innerText();
    await first.click();
    await expect(market.search).toHaveCount(0);
    await expect(market.pill).toContainText(symbol);
  });

  test("оракульный ряд отвечает на каждом интервале рамки", async ({
    page,
  }) => {
    const failures: string[] = [];
    page.on("response", (r) => {
      if (/oracle-candles|\/candles/.test(r.url()) && r.status() >= 400) {
        failures.push(`${r.status()} ${r.url()}`);
      }
    });

    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();

    const chart = new ChartFramePage(page);
    await expect(chart.root).toBeVisible({ timeout: 20_000 });
    // Окно диапазона поднимает интервал, когда баров выходит больше предела
    // шлюза — здесь проверяется, что ни одна пара «диапазон × интервал» не
    // просит у шлюза больше, чем тот отдаёт.
    for (const iv of ["1m", "15m", "1h", "1d"]) {
      await chart.interval(iv).click();
      await expect(page.locator("canvas").first()).toBeVisible();
    }
    for (const range of ["1D", "1M", "1Y"]) {
      await chart.range(range).click();
      await expect(page.locator("canvas").first()).toBeVisible();
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("статистика шапки отвечает или молчит прочерком", async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();

    const market = new MarketHeaderPanel(page);
    // Числа staging никто не обещает; проверяется, что каждая ячейка что-то
    // говорит — значение или честный прочерк, но не пустоту и не «NaN».
    for (const name of [
      "mark-price",
      "funding",
      "open-interest",
      "volume-24h",
    ]) {
      const cell = market.stat(name);
      await expect(cell).toBeVisible({ timeout: 20_000 });
      await expect(cell).not.toContainText("NaN");
      await expect(cell).not.toHaveText("");
    }
  });
});
