import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || "BbkDnkPC7HD8TeNHp3iCDwjLxF3WDmg2Yrh9gVZrwohH");
export const CONFIG = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID)[0];
const i64 = (n: bigint) => { const b = Buffer.alloc(8); b.writeBigInt64LE(n); return b; };
const u64 = (n: bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(n); return b; };

export const marketPda = (creator: PublicKey, id: bigint) => PublicKey.findProgramAddressSync([Buffer.from("market"), creator.toBuffer(), u64(id)], PROGRAM_ID)[0];
export const positionPda = (market: PublicKey, bettor: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from("position"), market.toBuffer(), bettor.toBuffer()], PROGRAM_ID)[0];

export function createMarketIx(creator: PublicKey, id: bigint, closeTs: bigint, resolveTs: bigint) {
  const market = marketPda(creator, id); const data = Buffer.alloc(35); data[0] = 1;
  u64(id).copy(data, 1); i64(closeTs).copy(data, 9); i64(resolveTs).copy(data, 17);
  data.writeInt32LE(311_300, 25); data.writeInt32LE(1_214_700, 29); data.writeUInt16LE(1, 33);
  return { market, ix: new TransactionInstruction({ programId: PROGRAM_ID, keys: [
    { pubkey: creator, isSigner: true, isWritable: true }, { pubkey: market, isSigner: false, isWritable: true },
    { pubkey: CONFIG, isSigner: false, isWritable: false }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
  ], data }) };
}
export function betIx(bettor: PublicKey, market: PublicKey, side: 0 | 1, lamports: bigint) {
  const position = positionPda(market, bettor); const data = Buffer.concat([Buffer.from([2, side]), u64(lamports)]);
  return new TransactionInstruction({ programId: PROGRAM_ID, keys: [
    { pubkey: bettor, isSigner: true, isWritable: true }, { pubkey: market, isSigner: false, isWritable: true },
    { pubkey: position, isSigner: false, isWritable: true }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
  ], data });
}
export function claimIx(bettor: PublicKey, market: PublicKey) { return new TransactionInstruction({ programId: PROGRAM_ID, keys: [
  { pubkey: bettor, isSigner: true, isWritable: true }, { pubkey: market, isSigner: false, isWritable: true },
  { pubkey: positionPda(market, bettor), isSigner: false, isWritable: true }
], data: Buffer.from([4]) }); }
export function settleIx(oracle: PublicKey, market: PublicKey, precipitationMm: number) {
  const value = Math.round(precipitationMm * 10); if (!Number.isFinite(value) || value < 0 || value > 65535) throw new Error("天气数据无效");
  const data = Buffer.alloc(11); data[0] = 3; data.writeUInt16LE(value, 1); data.writeBigInt64LE(BigInt(Math.floor(Date.now()/1000)), 3);
  return new TransactionInstruction({ programId: PROGRAM_ID, keys: [
    { pubkey: oracle, isSigner: true, isWritable: false }, { pubkey: CONFIG, isSigner: false, isWritable: true },
    { pubkey: market, isSigner: false, isWritable: true }
  ], data });
}
export function withdrawFeesIx(authority: PublicKey) { return new TransactionInstruction({ programId: PROGRAM_ID, keys: [
  { pubkey: authority, isSigner: true, isWritable: true }, { pubkey: CONFIG, isSigner: false, isWritable: true }
], data: Buffer.from([6]) }); }
export async function readConfig(connection: import("@solana/web3.js").Connection) { const info = await connection.getAccountInfo(CONFIG); if (!info || info.data.length !== 72) throw new Error("Config 未初始化"); return { authority: new PublicKey(info.data.subarray(8,40)), oracle: new PublicKey(info.data.subarray(40,72)), lamports: info.lamports }; }
export async function readOracle(connection: import("@solana/web3.js").Connection) { const info = await connection.getAccountInfo(CONFIG); if (!info || info.data.length !== 72) throw new Error("Config 未初始化"); return new PublicKey(info.data.subarray(40,72)); }

export type Market = { address: PublicKey; creator: PublicKey; id: bigint; closeTs: number; resolveTs: number; lat: number; lon: number; threshold: number; yes: bigint; no: bigint; outcome: number; precipitation: number };
export function parseMarket(address: PublicKey, d: Buffer): Market { return { address, outcome: d[2], creator: new PublicKey(d.subarray(8, 40)), id: d.readBigUInt64LE(40), closeTs: Number(d.readBigInt64LE(48)), resolveTs: Number(d.readBigInt64LE(56)), lat: d.readInt32LE(64)/10000, lon: d.readInt32LE(68)/10000, threshold: d.readUInt16LE(72)/10, yes: d.readBigUInt64LE(80), no: d.readBigUInt64LE(88), precipitation: d.readUInt16LE(96)/10 }; }
export type Position = { yes: bigint; no: bigint; claimed: boolean; payout: bigint };
export async function readPosition(connection: import("@solana/web3.js").Connection, market: PublicKey, bettor: PublicKey): Promise<Position | null> { const info = await connection.getAccountInfo(positionPda(market, bettor)); if (!info || info.data.length !== 96 || info.data[0] !== 3) return null; const d=Buffer.from(info.data); return { claimed:d[2]!==0, yes:d.readBigUInt64LE(72), no:d.readBigUInt64LE(80), payout:d.readBigUInt64LE(88) }; }
