import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("диалоги", () => {
  test("закрываются по Esc и объявляют себя модальными", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    await page.getByTestId("open-deposit-button").click();

    const dialog = page.getByTestId("deposit-dialog");
    await expect(dialog).toBeVisible();
    // Прежний оверлей был обычным div: скринридер не знал, что открыт модал.
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
