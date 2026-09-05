import type { Metadata } from "next";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./styles.css";
import { WalletProvider } from "@/components/WalletProvider";

export const metadata: Metadata = { title: "RainCast", description: "Solana Devnet weather prediction market" };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><WalletProvider>{children}</WalletProvider></body></html>;
}

