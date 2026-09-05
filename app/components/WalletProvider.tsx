"use client";
import { useMemo } from "react";
import { ConnectionProvider, WalletProvider as AdapterProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return <ConnectionProvider endpoint={endpoint}><AdapterProvider wallets={wallets} autoConnect><WalletModalProvider>{children}</WalletModalProvider></AdapterProvider></ConnectionProvider>;
}
