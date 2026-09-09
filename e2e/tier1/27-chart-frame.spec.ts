import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("chart frame", () => {
  test("рамка несёт интервалы", async ({ page, world }) => {
    const { chart } = await enterTerminal(page, world);

    await expect(chart.root).toBeVisible();
    await expect(chart.interval("1h")).toBeVisible();
    await expect(chart.interval("1d")).toBeVisible();
  });

  test("кнопки 1s нет — такого интервала оракул не отдаёт", async ({
    page,
    world,
  }) => {
    const { chart } = await enterTerminal(page, world);

    // Макет рисует 1s, но `ORACLE_INTERVALS` начинается с 1m: кнопка, которая
    // ничего не запрашивает, врёт сильнее, чем её отсутствие.
    await expect(chart.interval("1s")).toHaveCount(0);
  });

  test("выбранный интервал переживает перезагрузку", async ({
    page,
    world,
  }) => {
    const { app, chart } = await enterTerminal(page, world);

    await chart.interval("4h").click();
    await expect(chart.interval("4h")).toHaveAttribute("data-active", "true");

    await page.reload();
    await expect(app.terminal).toBeVisible({ timeout: 25_000 });
    await expect(chart.interval("4h")).toHaveAttribute("data-active", "true");
    await expect(chart.interval("1h")).toHaveAttribute("data-active", "false");
  });

  test("% и log исключают друг друга", async ({ page, world }) => {
    const { chart } = await enterTerminal(page, world);

    await chart.scale("percent").click();
    await expect(chart.scale("percent")).toHaveAttribute("data-active", "true");
    await expect(chart.scale("log")).toHaveAttribute("data-active", "false");

    await chart.scale("log").click();
    await expect(chart.scale("log")).toHaveAttribute("data-active", "true");
    await expect(chart.scale("percent")).toHaveAttribute("data-active", "false");

    // Повторное нажатие на активную — возврат к обычной шкале.
    await chart.scale("log").click();
    await expect(chart.scale("log")).toHaveAttribute("data-active", "false");
  });
});
