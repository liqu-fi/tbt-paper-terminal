import { enterTerminal } from "../pages/flows";
import { AccountPanelPage } from "../pages/TerminalPanels";
import { WAD } from "../support/constants";
import { expect, test } from "../support/fixtures";
import { longPositionFixture, readyWorld } from "../support/world";

test.describe("панель Account", () => {
  test("шесть строк макета на месте", async ({ page, world }) => {
    await enterTerminal(page, world);
    const account = new AccountPanelPage(page);

    await expect(account.root).toBeVisible();
    for (const name of [
      "unrealized-pnl",
      "value",
      "equity",
      "borrowed",
      "exposure",
      "leverage",
    ]) {
      await expect(account.row(name)).toBeVisible();
    }
  });

  test("equity меньше стоимости счёта ровно на офчейн-лок", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world, () =>
      readyWorld({
        accountMargin: {
          available: (5_000n * WAD).toString(),
          locked: (40n * WAD).toString(),
          free: (4_960n * WAD).toString(),
        },
      }),
    );
    const account = new AccountPanelPage(page);

    // Equity — ончейн getAvailableMargin (5 000 в readyWorld) минус лок,
    // который приходит со шлюза; сама стоимость счёта на карточке не стоит —
    // то же число уже показано в шапке рынка как `margin`.
    await expect(account.row("equity")).toHaveText("$4,960.00");
  });

  test("экспозиция и нереализованный PnL считаются по открытым позициям", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.accounts[0].positions = [longPositionFixture()];
      return w;
    });
    const account = new AccountPanelPage(page);

    // +$100 из фикстуры позиции; экспозиция = 1 BTC × mark 70 000.
    await expect(account.row("unrealized-pnl")).toHaveText("+$100.00");
    await expect(account.row("exposure")).toHaveText("$70,000.00");
  });

  test("кнопка Deposit панели открывает тот же диалог", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    const account = new AccountPanelPage(page);

    await account.depositButton.click();
    await expect(page.getByTestId("deposit-dialog")).toBeVisible();
  });
});
