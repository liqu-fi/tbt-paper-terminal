import path from "node:path";

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const e = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    // The SDK reads process.env.DEPLOY_ENV to pick staging vs production
    // (both are chainId 6343). Bake the build-time value in.
    define: {
      "process.env.DEPLOY_ENV": JSON.stringify(e.VITE_DEPLOY_ENV ?? "staging"),
    },
  };
});
