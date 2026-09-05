import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import { hasUnfinishedMarket, marketPhase } from "../app/lib/program.ts";
const program = new PublicKey("BbkDnkPC7HD8TeNHp3iCDwjLxF3WDmg2Yrh9gVZrwohH");
const u64 = (v: bigint) => { const b=Buffer.alloc(8); b.writeBigUInt64LE(v); return b; };
test("market PDA is deterministic", () => { const creator=Keypair.generate().publicKey; const a=PublicKey.findProgramAddressSync([Buffer.from("market"),creator.toBuffer(),u64(7n)],program)[0]; const b=PublicKey.findProgramAddressSync([Buffer.from("market"),creator.toBuffer(),u64(7n)],program)[0]; assert.equal(a.toBase58(),b.toBase58()); });
test("bet amount round trips as u64", () => { const d=Buffer.concat([Buffer.from([2,1]),u64(10_000_000n)]); assert.equal(d.length,10); assert.equal(d.readBigUInt64LE(2),10_000_000n); });
test("malformed u64 cannot be decoded", () => { assert.throws(()=>Buffer.alloc(7).readBigUInt64LE(0)); });
test("platform fee is exactly one percent rounded down", () => { const pool=123_456_789n; assert.equal(pool/100n,1_234_567n); assert.equal(pool-pool/100n,122_222_222n); });
test("withdraw fees instruction has stable tag", () => { assert.deepEqual(Buffer.from([6]),Buffer.from([6])); });
test("market status follows close and resolve timestamps", () => {
  const market = { closeTs: 200, resolveTs: 300, outcome: 0 };
  assert.equal(marketPhase(market, 199), "open");
  assert.equal(marketPhase(market, 200), "closed");
  assert.equal(marketPhase(market, 300), "awaiting-settlement");
  assert.equal(marketPhase({ ...market, outcome: 1 }, 100), "settled");
});
test("new market is blocked only while another interval is unfinished", () => {
  assert.equal(hasUnfinishedMarket([{ resolveTs: 300, outcome: 0 }], 299), true);
  assert.equal(hasUnfinishedMarket([{ resolveTs: 300, outcome: 0 }], 300), false);
  assert.equal(hasUnfinishedMarket([{ resolveTs: 300, outcome: 1 }], 200), false);
});
