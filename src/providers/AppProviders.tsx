import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { getConfig } from "../config/chain";
import { LiqSetup } from "./LiqSetup";

const queryClient = new QueryClient();
const wagmiConfig = getConfig();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <LiqSetup>{children}</LiqSetup>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
