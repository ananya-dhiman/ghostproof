"use client";

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { useEffect, useState } from "react";
import { short } from "@/lib/format";

export function ConnectButton({ className = "btn small" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!mounted) return <button className={className} disabled>Connect wallet</button>;

  if (!isConnected) {
    const injected = connectors[0];
    return (
      <button
        className={className}
        disabled={!injected || isPending}
        onClick={() => injected && connect({ connector: injected })}
        title={!injected ? "Install a browser wallet like MetaMask" : undefined}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  if (chainId !== sepolia.id) {
    return (
      <button className={className} onClick={() => switchChain({ chainId: sepolia.id })}>
        Switch to Sepolia
      </button>
    );
  }

  return (
    <button className={className} onClick={() => disconnect()} title="Disconnect">
      <span className="mono">{short(address)}</span>
    </button>
  );
}
