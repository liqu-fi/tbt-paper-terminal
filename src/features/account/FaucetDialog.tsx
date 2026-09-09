import {
  INSUFFICIENT_GAS_MESSAGE,
  isInsufficientGas,
  USDC_DECIMALS,
} from "@liq/core";
import {
  useClaimFaucetMutation,
  useFaucetState,
  useNetworkId,
  useWallet,
} from "@liq/react";
import { getChainConfig } from "@liq/sdk";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits } from "viem";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { faucetRow, fmtRemaining } from "./faucetRow";

/** Тестовый ETH на газ раздаёт сама сеть; наш фаусет — только USDC. */
const MEGAETH_FAUCET_URL = "https://testnet.megaeth.com/";

export function FaucetDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        data-testid="faucet-dialog"
        overlayTestId="dialog-overlay"
        className="w-[min(320px,calc(100vw-2rem))]"
      >
        <DialogHeader className="mb-3">
          <DialogTitle className="text-sm font-semibold">
            Testnet faucet
          </DialogTitle>
        </DialogHeader>
        {/* Тело монтируется только открытым: `useFaucetState` опрашивает
            цепь каждые 15с, и закрытый диалог не должен этого делать. */}
        {open && <FaucetBody />}
        {/* Снаружи тела: ссылка нужна и когда фаусет USDC недоступен —
            без ETH на газ не пройдёт даже Claim. */}
        <p className="mt-3 text-[11px] text-muted">
          Test ETH for gas:{" "}
          <a
            href={MEGAETH_FAUCET_URL}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
            data-testid="faucet-eth-link"
          >
            MegaETH testnet faucet ↗
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}

function FaucetBody() {
  const networkId = useNetworkId();
  const wallet = useWallet();
  const queryClient = useQueryClient();
  // Токен фаусета — маржинальный USDC контура (на staging это fUSDC): тот же
  // адрес, который тратит депозит. Адрес самого фаусета SDK берёт из своей
  // таблицы по chainId, здесь он не нужен.
  const token = {
    symbol: "USDC",
    label: "Test USDC",
    description: "Margin asset for testnet perps trading",
    decimals: USDC_DECIMALS,
    address: getChainConfig(networkId).contracts.USDC,
  };
  const state = useFaucetState([token]);
  const claim = useClaimFaucetMutation();

  if (state.isError) {
    return (
      <p className="text-[11px] text-short" data-testid="faucet-error">
        {state.error.message}
      </p>
    );
  }
  if (!state.data) {
    return <p className="text-[11px] text-muted">Loading…</p>;
  }
  if (!state.data.deployed || state.data.tokens.length === 0) {
    return (
      <p className="text-[11px] text-muted" data-testid="faucet-unavailable">
        No faucet on this deployment.
      </p>
    );
  }

  // Время снимка, а не `Date.now()` в рендере: рендер обязан быть чистым, а
  // обратный отсчёт всё равно освежается каждым опросом (15с).
  const nowSec = Math.floor(state.dataUpdatedAt / 1000);
  return (
    <div className="flex flex-col gap-2">
      {state.data.tokens.map((t) => {
        const row = faucetRow(t, nowSec);
        const amount = `${formatUnits(t.claimAmount, t.token.decimals)} ${t.token.symbol}`;
        return (
          <div
            key={t.token.address}
            className="flex items-center justify-between gap-2 text-[11px]"
            data-testid={`faucet-row-${t.token.symbol}`}
          >
            <span className="flex flex-col">
              <span className="text-text">{amount}</span>
              <span className="text-muted">
                {row.block === "cooldown"
                  ? `Next claim in ${fmtRemaining(row.remainingSec)}`
                  : row.block === "empty"
                    ? "Faucet is empty"
                    : row.block === "disabled"
                      ? "Not available"
                      : `${formatUnits(t.faucetBalance, t.token.decimals)} left`}
              </span>
            </span>
            <Button
              disabled={row.block !== null || claim.isPending || !wallet}
              onClick={() =>
                claim.mutate(
                  { token: t.token.address },
                  {
                    // Баланс кошелька для диалога депозита живёт в своём
                    // запросе, не в срезе SDK, — сбрасывается руками.
                    onSuccess: () =>
                      void queryClient.invalidateQueries({
                        queryKey: ["usdc-balance-wad"],
                      }),
                    onError: () => {},
                  },
                )
              }
              data-testid={`faucet-claim-${t.token.symbol}`}
            >
              {claim.isPending ? "Claiming…" : "Claim"}
            </Button>
          </div>
        );
      })}
      {claim.error && (
        <p className="text-[11px] text-short" data-testid="faucet-claim-error">
          {isInsufficientGas(claim.error)
            ? `${INSUFFICIENT_GAS_MESSAGE} Send ETH to ${wallet ?? "your wallet"} and try again.`
            : claim.error.message}
        </p>
      )}
    </div>
  );
}
