"use client";
import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { CloudRain, Database, ExternalLink, ShieldCheck } from "lucide-react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  BETTING_WINDOW_SECONDS,
  betIx,
  claimIx,
  createMarketIx,
  hasUnfinishedMarket,
  MARKET_DURATION_SECONDS,
  Market,
  marketPhase,
  parseMarket,
  Position,
  PROGRAM_ID,
  readConfig,
  readPosition,
  settleIx,
  withdrawFeesIx,
} from "@/lib/program";
import { CITIES, cityLabel } from "@/lib/cities";
const sol = (v: bigint) => (Number(v) / LAMPORTS_PER_SOL).toFixed(3);
export default function Home() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [positions, setPositions] = useState<Record<string, Position | null>>(
    {},
  );
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeSignature, setNoticeSignature] = useState("");
  const [oracle, setOracle] = useState<PublicKey>();
  const [authority, setAuthority] = useState<PublicKey>();
  const [fees, setFees] = useState(0n);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [cityId, setCityId] = useState(CITIES[0].id);
  const selectedCity = CITIES.find((city) => city.id === cityId) ?? CITIES[0];
  const refresh = useCallback(async () => {
    const [rows, configured, rent] = await Promise.all([
      connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: 200 }],
      }),
      readConfig(connection),
      connection.getMinimumBalanceForRentExemption(72),
    ]);
    const next = rows
      .map((r) => parseMarket(r.pubkey, Buffer.from(r.account.data)))
      .sort((a, b) => b.resolveTs - a.resolveTs);
    setMarkets(next);
    setOracle(configured.oracle);
    setAuthority(configured.authority);
    setFees(BigInt(Math.max(0, configured.lamports - rent)));
    if (wallet.publicKey) {
      const values = await Promise.all(
        next.map((m) => readPosition(connection, m.address, wallet.publicKey!)),
      );
      setPositions(
        Object.fromEntries(
          next.map((m, i) => [m.address.toBase58(), values[i]]),
        ),
      );
    } else setPositions({});
  }, [connection, wallet.publicKey]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  async function send(ix: TransactionInstruction, label: string) {
    if (!wallet.publicKey || !wallet.sendTransaction) return;
    try {
      setBusy(label);
      setNoticeSignature("");
      const sig = await wallet.sendTransaction(
        new Transaction().add(ix),
        connection,
      );
      await connection.confirmTransaction(sig, "confirmed");
      setNotice("交易成功");
      setNoticeSignature(sig);
      await refresh();
    } catch (e) {
      setNoticeSignature("");
      setNotice(e instanceof Error ? e.message : "交易失败");
    } finally {
      setBusy("");
    }
  }
  async function create() {
    if (!wallet.publicKey) return;
    const createdAt = Math.floor(Date.now() / 1000);
    if (hasUnfinishedMarket(markets, createdAt)) {
      setNotice("当前已有未结束的 30 分钟市场，结束后才能创建下一场。");
      return;
    }
    const { ix } = createMarketIx(
      wallet.publicKey,
      BigInt(Date.now()),
      BigInt(createdAt + BETTING_WINDOW_SECONDS),
      BigInt(createdAt + MARKET_DURATION_SECONDS),
      selectedCity.latitude,
      selectedCity.longitude,
    );
    await send(ix, "create");
  }
  async function settle(m: Market) {
    if (!wallet.publicKey || !oracle || !wallet.publicKey.equals(oracle))
      return;
    try {
      setBusy(`settle-${m.address}`);
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${m.lat}&longitude=${m.lon}&current=precipitation&timezone=Asia%2FShanghai`,
      );
      if (!response.ok) throw new Error(`天气 API 返回 ${response.status}`);
      const body = (await response.json()) as {
        current?: { precipitation?: number };
      };
      const mm = body.current?.precipitation;
      if (typeof mm !== "number") throw new Error("天气 API 未返回降水量");
      await send(
        settleIx(wallet.publicKey, m.address, mm),
        `settle-${m.address}`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "结算失败");
      setBusy("");
    }
  }
  const isOperator =
    !!wallet.publicKey && !!oracle && wallet.publicKey.equals(oracle);
  const isAdmin =
    !!wallet.publicKey && !!authority && wallet.publicKey.equals(authority);
  const creationBlocked = hasUnfinishedMarket(markets, now);
  return (
    <main>
      <nav>
        <div className="brand">
          <span className="logo">
            <CloudRain size={22} />
          </span>
          <span>RainCast</span>
          <small>DEVNET</small>
        </div>
        <WalletMultiButton />
      </nav>
      <section className="hero">
        <div>
          <p className="eyebrow">天气 × 链上市场</p>
          <h1>
            未来 30 分钟，
            <br />
            {selectedCity.name}会下雨吗？
          </h1>
          <p className="lead">
            选择城市，发起基于 Open‑Meteo 实时降水数据的 Solana Devnet
            预测市场。每次仅开放一个 30 分钟市场；测试 SOL，仅用于技术演示。
          </p>
          <div className="city-picker">
            <label htmlFor="city">预测城市</label>
            <select
              id="city"
              value={cityId}
              onChange={(event) => setCityId(event.target.value)}
              disabled={!!busy || creationBlocked}
            >
              {CITIES.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} · {city.district}
                </option>
              ))}
            </select>
          </div>
          <div className="actions">
            <button
              className="primary"
              onClick={create}
              disabled={!wallet.publicKey || !!busy || creationBlocked}
            >
              {creationBlocked
                ? "当前 30 分钟市场进行中"
                : `创建${selectedCity.name}预测市场`}
            </button>
            <a
              href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
            >
              查看合约 <ExternalLink size={16} />
            </a>
          </div>
        </div>
        <div className="weather-card">
          <span>
            {selectedCity.name} · {selectedCity.district}
          </span>
          <CloudRain size={64} />
          <strong>未来 30 分钟</strong>
          <p>降水量 ≥ 0.1 mm 即判定为“下雨”</p>
        </div>
      </section>
      <section className="trust">
        <span>
          <Database /> Open‑Meteo 数据
        </span>
        <span>
          <ShieldCheck /> Oracle 签名
        </span>
        <span>
          <CloudRain /> 0.1 mm 阈值
        </span>
      </section>
      {isAdmin && (
        <section className="markets">
          <div className="section-title">
            <div>
              <p className="eyebrow">后台管理</p>
              <h2>平台收益 {sol(fees)} SOL</h2>
            </div>
            <button
              className="primary"
              disabled={fees === 0n || !!busy}
              onClick={() =>
                wallet.publicKey &&
                send(withdrawFeesIx(wallet.publicKey), "fees")
              }
            >
              领取全部收益
            </button>
          </div>
        </section>
      )}
      <section className="markets">
        <div className="section-title">
          <div>
            <p className="eyebrow">活跃市场</p>
            <h2>选择你的判断</h2>
            <p className={`operator ${isOperator ? "verified" : ""}`}>
              <ShieldCheck size={16} />
              {isOperator
                ? "已验证：运营方钱包"
                : `结算方：${oracle?.toBase58().slice(0, 8) || "读取中"}…`}
            </p>
          </div>
          <button className="ghost" onClick={refresh}>
            刷新链上数据
          </button>
        </div>
        {notice && (
          <div className="notice" role="status">
            {notice}
            {noticeSignature && (
              <>
                ：
                <a
                  href={`https://explorer.solana.com/tx/${noticeSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看交易详情 <ExternalLink size={15} />
                </a>
              </>
            )}
          </div>
        )}
        <div className="grid">
          {markets.length === 0 ? (
            <div className="empty">
              暂无市场。连接钱包后创建第一个 30 分钟市场。
            </div>
          ) : (
            markets.map((m) => {
              const total = m.yes + m.no;
              const yesPct = total ? Number((m.yes * 100n) / total) : 50;
              const phase = marketPhase(m, now);
              const canBet = phase === "open";
              const due = phase === "awaiting-settlement";
              const p = positions[m.address.toBase58()];
              const statusLabel = {
                open: "接受预测",
                closed: "截止",
                "awaiting-settlement": "等待结算",
                settled: "已结算",
              }[phase];
              return (
                <article key={m.address.toBase58()}>
                  <div className="card-head">
                    <span className={`status ${phase}`}>{statusLabel}</span>
                    <a
                      aria-label="在浏览器查看市场"
                      href={`https://explorer.solana.com/address/${m.address}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={18} />
                    </a>
                  </div>
                <p className="market-city">{cityLabel(m.lat, m.lon)}</p>
                <h3>
                  {new Date(m.resolveTs * 1000).toLocaleString("zh-CN")} 前 30
                  分钟内，降水量是否达到 {m.threshold} mm？
                  </h3>
                  <div className="bar">
                    <i style={{ width: `${yesPct}%` }} />
                  </div>
                  <div className="odds">
                    <span>
                      会下雨 <b>{yesPct}%</b>
                    </span>
                    <span>
                      不会 <b>{100 - yesPct}%</b>
                    </span>
                  </div>
                  <div className="pool">
                    奖池 <strong>{sol(total)} SOL</strong>
                  </div>
                  {wallet.publicKey && (
                    <p className="result">
                      我的份额：YES {sol(p?.yes ?? 0n)} / NO {sol(p?.no ?? 0n)}{" "}
                      SOL{p?.claimed ? ` · 已领取 ${sol(p.payout)} SOL` : ""}
                    </p>
                  )}
                  {!m.outcome ? (
                    <>
                      {canBet && (
                        <div className="bet-actions">
                          <button
                            onClick={() =>
                              wallet.publicKey &&
                              send(
                                betIx(
                                  wallet.publicKey,
                                  m.address,
                                  1,
                                  10_000_000n,
                                ),
                                m.address + "yes",
                              )
                            }
                            disabled={!wallet.publicKey || !!busy}
                          >
                            YES · 0.01 SOL
                          </button>
                          <button
                            onClick={() =>
                              wallet.publicKey &&
                              send(
                                betIx(
                                  wallet.publicKey,
                                  m.address,
                                  0,
                                  10_000_000n,
                                ),
                                m.address + "no",
                              )
                            }
                            disabled={!wallet.publicKey || !!busy}
                          >
                            NO · 0.01 SOL
                          </button>
                        </div>
                      )}
                      {phase === "closed" && (
                        <p className="result muted">
                          预测已截止，将在市场到期后结算
                        </p>
                      )}
                      {due && isOperator && (
                        <button
                          className="claim oracle-button"
                          onClick={() => settle(m)}
                          disabled={!!busy}
                        >
                          <CloudRain size={18} />
                          获取天气并签名结算
                        </button>
                      )}
                      {due && !isOperator && (
                        <p className="result">等待运营方钱包签名结算</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="result">
                        结果：{m.outcome === 1 ? "下雨" : "未下雨"} ·{" "}
                        {m.precipitation} mm
                      </p>
                      <button
                        className="claim"
                        onClick={() =>
                          wallet.publicKey &&
                          send(claimIx(wallet.publicKey, m.address), "claim")
                        }
                        disabled={
                          !wallet.publicKey || !!busy || !p || p.claimed
                        }
                      >
                        领取收益
                      </button>
                    </>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
      <footer>
        RainCast 是 Devnet
        技术演示，不构成博彩或投资服务。天气结算依赖授权数据发布者。
      </footer>
    </main>
  );
}
