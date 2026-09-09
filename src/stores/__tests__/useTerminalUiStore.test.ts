// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTerminalUiStore } from "../useTerminalUiStore";

describe("стор состояния экрана", () => {
  beforeEach(() => {
    useTerminalUiStore.getState().reset();
    localStorage.clear();
  });

  it("начинается с развёрнутого чарта и без фуллскрина", () => {
    expect(useTerminalUiStore.getState().chartCollapsed).toBe(false);
    expect(useTerminalUiStore.getState().bottomFullscreen).toBe(false);
  });

  it("переключает свёртку чарта", () => {
    useTerminalUiStore.getState().toggleChart();
    expect(useTerminalUiStore.getState().chartCollapsed).toBe(true);
    useTerminalUiStore.getState().toggleChart();
    expect(useTerminalUiStore.getState().chartCollapsed).toBe(false);
  });

  it("переключает фуллскрин нижней панели независимо от чарта", () => {
    useTerminalUiStore.getState().toggleBottomFullscreen();
    expect(useTerminalUiStore.getState().bottomFullscreen).toBe(true);
    expect(useTerminalUiStore.getState().chartCollapsed).toBe(false);
  });

  it("персистит свёртку чарта в localStorage под ключом terminal-ui", async () => {
    useTerminalUiStore.getState().toggleChart();

    await vi.waitFor(() => {
      const raw = localStorage.getItem("terminal-ui");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw as string) as {
        state: { chartCollapsed: boolean };
      };
      expect(parsed.state.chartCollapsed).toBe(true);
    });
  });

  it("избранное переключается и не задваивается", () => {
    const { toggleFavorite } = useTerminalUiStore.getState();
    toggleFavorite("200");
    toggleFavorite("201");
    toggleFavorite("200");
    expect(useTerminalUiStore.getState().favoriteMarkets).toEqual(["201"]);
  });

  it("режимы шкалы взаимно исключают друг друга", () => {
    const { setChartScaleMode } = useTerminalUiStore.getState();
    setChartScaleMode("percent");
    expect(useTerminalUiStore.getState().chartScaleMode).toBe("percent");
    setChartScaleMode("log");
    expect(useTerminalUiStore.getState().chartScaleMode).toBe("log");
    setChartScaleMode("log");
    expect(useTerminalUiStore.getState().chartScaleMode).toBe("normal");
  });
});
