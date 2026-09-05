import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction, TransactionInstruction } from "@solana/web3.js";
import fs from "node:fs";
const programId = new PublicKey("BbkDnkPC7HD8TeNHp3iCDwjLxF3WDmg2Yrh9gVZrwohH");
const market = new PublicKey(process.argv[2] || "");
const oraclePath = process.env.ORACLE_KEYPAIR;
if (!oraclePath) throw new Error("Set ORACLE_KEYPAIR to the configured operator keypair path");
const oracle = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(oraclePath, "utf8"))));
const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
const info = await connection.getAccountInfo(market); if (!info || info.data.length !== 200) throw new Error("Market account not found");
const lat = info.data.readInt32LE(64) / 10_000; const lon = info.data.readInt32LE(68) / 10_000;
const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=precipitation&timezone=Asia%2FShanghai`);
if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
const weather = await response.json() as { current?: { precipitation?: number; time?: string } };
const mm = weather.current?.precipitation; if (typeof mm !== "number" || !Number.isFinite(mm) || mm < 0 || mm > 6_553.5) throw new Error("Invalid precipitation response");
const observedAt = BigInt(Math.floor(Date.now()/1000)); const payload = Buffer.alloc(11); payload[0] = 3; payload.writeUInt16LE(Math.round(mm*10), 1); payload.writeBigInt64LE(observedAt, 3);
const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
const ix = new TransactionInstruction({ programId, keys: [
  { pubkey: oracle.publicKey, isSigner: true, isWritable: false }, { pubkey: config, isSigner: false, isWritable: false }, { pubkey: market, isSigner: false, isWritable: true }
], data: payload });
const signature = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [oracle]);
console.log(JSON.stringify({ source: "Open-Meteo", latitude: lat, longitude: lon, precipitation_mm: mm, observed_at: Number(observedAt), signature }));
