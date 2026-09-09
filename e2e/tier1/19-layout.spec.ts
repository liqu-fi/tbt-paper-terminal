import { type Locator } from "@playwright/test";

import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

/** `boundingBox()` returns `null` for a detached/hidden element; assert it
 * exists before reading `width` so a layout regression fails loudly here
 * instead of surfacing as a confusing `undefined` comparison below. */
async function widthOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box, "element must have a layout box").not.toBeNull();
  return box!.width;
}

async function heightOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box, "element must have a layout box").not.toBeNull();
  return box!.height;
}

test.describe("раскладка терминала", () => {
  test("чарт сворачивается и разворачивается", async ({ page, world }) => {
    const { layout, book, trade } = await enterTerminal(page, world);
    await expect(layout.chartPanel).toBeVisible();
    const expandedWidth = await widthOf(book.root);
    const tradeWidth = await widthOf(trade.root);

    await layout.toggleChart();
    await expect(layout.chartPanel).toBeHidden();
    // Свёрнутый чарт обязан отдавать освободившуюся ширину стакану, а не
    // просто прятать свою карточку внутри неизменной колонки — иначе
    // "свёртка" — это обман, а не раскладка. Правая колонка — постоянная
    // рейка на всю высоту, её ширина от чарта не зависит.
    const collapsedWidth = await widthOf(book.root);
    expect(collapsedWidth).toBeGreaterThan(expandedWidth + 100);
    expect(await widthOf(trade.root)).toBe(tradeWidth);

    await layout.toggleChart();
    await expect(layout.chartPanel).toBeVisible();
  });

  test("свёртка переживает перезагрузку", async ({ page, world }) => {
    const { app, layout } = await enterTerminal(page, world);
    await layout.toggleChart();
    await expect(layout.chartPanel).toBeHidden();

    await page.reload();
    // Раскладка — настройка рабочего места: она в persist-сторе, не в памяти.
    // Но терминал не возвращается мгновенно — JWT поднимается из localStorage,
    // wagmi переподключает кошелёк — так что сперва дождаться терминала на
    // экране, иначе "chart-panel скрыт" будет истиной ещё до отрисовки
    // раскладки и ничего не докажет (см. 15-session-persistence.spec.ts).
    await expect(app.terminal).toBeVisible({ timeout: 25_000 });
    await expect(layout.chartCollapseToggle).toBeVisible();
    await expect(layout.chartPanel).toBeHidden();
  });

  test("нижняя панель разворачивается на весь экран и обратно", async ({
    page,
    world,
  }) => {
    const { layout, trade, market } = await enterTerminal(page, world);
    const collapsedHeight = await heightOf(layout.bottomPanel);

    await layout.toggleBottomFullscreen();
    await expect(layout.bottomPanel).toBeVisible();
    await expect(trade.root).toBeHidden();
    // bottom-panel is rendered in both states, so visibility alone is
    // tautological — assert the geometry actually changed, the way the
    // chart-collapse test above does for width.
    const fullscreenHeight = await heightOf(layout.bottomPanel);
    expect(fullscreenHeight).toBeGreaterThan(collapsedHeight + 100);

    // Обратный путь — тот случай, где раскладка рискует не восстановиться:
    // bottom-row был единственной панелью группы, а верхняя строка (чарт +
    // форма) и шапка рынка монтируются заново.
    await layout.toggleBottomFullscreen();
    await expect(trade.root).toBeVisible();
    await expect(layout.chartPanel).toBeVisible();
    await expect(market.root).toBeVisible();
  });
});
