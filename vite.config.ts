/// <reference types="vitest/config" />
import path from "node:path";

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  // Не дубль `setDeployEnv` из deploy-env-init.ts, а костыль под SDK:
  // `useSessionKeyManager` в @liq/react передаёт в браузер голый `process.env`,
  // и без этого define страница падает с «process is not defined» ещё до
  // первого рендера (проверено e2e). Убрать, когда SDK перейдёт на
  // `globalThis.process?.env`.
  define: {
    "process.env.DEPLOY_ENV": JSON.stringify(
      loadEnv(mode, process.cwd(), "VITE_").VITE_DEPLOY_ENV ?? "staging",
    ),
  },
  // Vitest поднимает Vite в mode "test". Канал `warn` там приглушён:
  // `@turnkey/react-wallet-kit` везёт sourcemap'ы на несуществующие исходники,
  // и Vite печатает по строке на каждый её модуль — семьдесят строк перед каждым
  // прогоном, стоит тесту потянуть `@liq/react`. Сузить до одного сообщения
  // нельзя: печатает логгер окружения, до которого `customLogger` не доходит.
  // Ошибки видны, неразрешённый импорт роняет файл теста, а не прячется в warn.
  logLevel: mode === "test" ? "error" : undefined,
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // `@liq/react` тянет `@turnkey/react-wallet-kit`, чей файл с нестандартным
    // расширением не переваривает загрузчик Node: инлайн отдаёт его Vite.
    server: { deps: { inline: [/@turnkey\//, /@liqpro\//] } },
  },
}));
