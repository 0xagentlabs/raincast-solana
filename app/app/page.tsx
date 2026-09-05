"use client";
import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { CloudRain, Database, ExternalLink, ShieldCheck } from "lucide-react";
import { LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import { betIx, claimIx, createMarketIx, Market, parseMarket, PROGRAM_ID } from "@/lib/program";

const sol = (v: bigint) => (Number(v) / LAMPORTS_PER_SOL).toFixed(3);
export default function Home() {
  const { connection } = useConnection(); const wallet = useWallet();
  const [markets, setMarkets] = useState<Market[]>([]); const [busy, setBusy] = useState(""); const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => { const rows = await connection.getProgramAccounts(PROGRAM_ID, { filters: [{ dataSize: 200 }] }); setMarkets(rows.map(r => parseMarket(r.pubkey, Buffer.from(r.account.data))).sort((a,b)=>b.resolveTs-a.resolveTs)); }, [connection]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function send(ix: ReturnType<typeof betIx>, label: string) { if (!wallet.publicKey || !wallet.sendTransaction) return; try { setBusy(label); const sig = await wallet.sendTransaction(new Transaction().add(ix), connection); await connection.confirmTransaction(sig, "confirmed"); setNotice(`交易成功：${sig.slice(0, 12)}…`); await refresh(); } catch(e) { setNotice(e instanceof Error ? e.message : "交易失败"); } finally { setBusy(""); } }
  async function create() { if (!wallet.publicKey) return; const now = Math.floor(Date.now()/1000); const id = BigInt(Date.now()); const { ix } = createMarketIx(wallet.publicKey, id, BigInt(now+3600), BigInt(now+7200)); await send(ix, "create"); }
  return <main>
    <nav><div className="brand"><span className="logo"><CloudRain size={22}/></span><span>RainCast</span><small>DEVNET</small></div><WalletMultiButton /></nav>
    <section className="hero"><div><p className="eyebrow">天气 × 链上市场</p><h1>上海下一场雨，<br/>由数据给出答案。</h1><p className="lead">基于 Open‑Meteo 实际降水观测，由授权预言机签名并写入 Solana Devnet。测试 SOL，仅用于技术演示。</p><div className="actions"><button className="primary" onClick={create} disabled={!wallet.publicKey || !!busy}>创建 2 小时演示市场</button><a href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`} target="_blank">查看合约 <ExternalLink size={16}/></a></div></div><div className="weather-card"><span>上海 · 浦东</span><CloudRain size={64}/><strong>≥ 0.1 mm</strong><p>即判定为“下雨”</p></div></section>
    <section className="trust"><span><Database/> Open‑Meteo 数据</span><span><ShieldCheck/> Oracle 签名</span><span><CloudRain/> 0.1 mm 阈值</span></section>
    <section className="markets"><div className="section-title"><div><p className="eyebrow">活跃市场</p><h2>选择你的判断</h2></div><button className="ghost" onClick={refresh}>刷新链上数据</button></div>
      {notice && <div className="notice" role="status">{notice}</div>}
      <div className="grid">{markets.length === 0 ? <div className="empty">暂无市场。连接钱包后创建第一个演示市场。</div> : markets.map(m => { const total=m.yes+m.no; const yesPct=total?Number(m.yes*100n/total):50; return <article key={m.address.toBase58()}><div className="card-head"><span className={`status ${m.outcome ? "settled":"open"}`}>{m.outcome ? "已结算":"接受预测"}</span><a aria-label="在浏览器查看市场" href={`https://explorer.solana.com/address/${m.address}?cluster=devnet`} target="_blank"><ExternalLink size={18}/></a></div><h3>{new Date(m.resolveTs*1000).toLocaleDateString("zh-CN")} 上海降水量是否达到 {m.threshold} mm？</h3><div className="bar"><i style={{width:`${yesPct}%`}}/></div><div className="odds"><span>会下雨 <b>{yesPct}%</b></span><span>不会 <b>{100-yesPct}%</b></span></div><div className="pool">奖池 <strong>{sol(total)} SOL</strong></div>{!m.outcome ? <div className="bet-actions"><button onClick={()=>wallet.publicKey && send(betIx(wallet.publicKey,m.address,1,10_000_000n),m.address+"yes")} disabled={!wallet.publicKey||!!busy}>YES · 0.01 SOL</button><button onClick={()=>wallet.publicKey && send(betIx(wallet.publicKey,m.address,0,10_000_000n),m.address+"no")} disabled={!wallet.publicKey||!!busy}>NO · 0.01 SOL</button></div> : <><p className="result">结果：{m.outcome===1?"下雨":"未下雨"} · {m.precipitation} mm</p><button className="claim" onClick={()=>wallet.publicKey&&send(claimIx(wallet.publicKey,m.address),"claim")} disabled={!wallet.publicKey||!!busy}>领取收益</button></>}</article>; })}</div>
    </section><footer>RainCast 是 Devnet 技术演示，不构成博彩或投资服务。天气结算依赖授权数据发布者。</footer>
  </main>;
}

