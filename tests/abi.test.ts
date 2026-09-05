import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, PublicKey } from "@solana/web3.js";
const program = new PublicKey("BbkDnkPC7HD8TeNHp3iCDwjLxF3WDmg2Yrh9gVZrwohH");
const u64 = (v: bigint) => { const b=Buffer.alloc(8); b.writeBigUInt64LE(v); return b; };
test("market PDA is deterministic", () => { const creator=Keypair.generate().publicKey; const a=PublicKey.findProgramAddressSync([Buffer.from("market"),creator.toBuffer(),u64(7n)],program)[0]; const b=PublicKey.findProgramAddressSync([Buffer.from("market"),creator.toBuffer(),u64(7n)],program)[0]; assert.equal(a.toBase58(),b.toBase58()); });
test("bet amount round trips as u64", () => { const d=Buffer.concat([Buffer.from([2,1]),u64(10_000_000n)]); assert.equal(d.length,10); assert.equal(d.readBigUInt64LE(2),10_000_000n); });
test("malformed u64 cannot be decoded", () => { assert.throws(()=>Buffer.alloc(7).readBigUInt64LE(0)); });

