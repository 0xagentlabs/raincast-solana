import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import { createMarketIx, hasUnfinishedMarket, marketPhase, MIN_BET_LAMPORTS, schedulePda, setAuthorityIx, solToLamports } from "../app/lib/program.ts";
import { CITIES, cityForCoordinates, cityLabel } from "../app/lib/cities.ts";
const program = new PublicKey("BbkDnkPC7HD8TeNHp3iCDwjLxF3WDmg2Yrh9gVZrwohH");
const u64 = (v: bigint) => { const b=Buffer.alloc(8); b.writeBigUInt64LE(v); return b; };
test("market PDA is deterministic", () => { const creator=Keypair.generate().publicKey; const a=PublicKey.findProgramAddressSync([Buffer.from("market"),creator.toBuffer(),u64(7n)],program)[0]; const b=PublicKey.findProgramAddressSync([Buffer.from("market"),creator.toBuffer(),u64(7n)],program)[0]; assert.equal(a.toBase58(),b.toBase58()); });
test("bet amount round trips as u64", () => { const d=Buffer.concat([Buffer.from([2,1]),u64(10_000_000n)]); assert.equal(d.length,10); assert.equal(d.readBigUInt64LE(2),10_000_000n); });
test("custom SOL amounts encode exactly and enforce the 0.01 minimum", () => {
  assert.equal(MIN_BET_LAMPORTS, 10_000_000n);
  assert.equal(solToLamports("0.01"), 10_000_000n);
  assert.equal(solToLamports("1.234567891"), 1_234_567_891n);
  assert.throws(() => solToLamports("0.009999999"), /最低购买金额/);
  assert.throws(() => solToLamports("0.0100000001"), /最多 9 位小数/);
});
test("malformed u64 cannot be decoded", () => { assert.throws(()=>Buffer.alloc(7).readBigUInt64LE(0)); });
test("platform fee is exactly one percent rounded down", () => { const pool=123_456_789n; assert.equal(pool/100n,1_234_567n); assert.equal(pool-pool/100n,122_222_222n); });
test("withdraw fees instruction has stable tag", () => { assert.deepEqual(Buffer.from([6]),Buffer.from([6])); });
test("set authority instruction encodes tag, authority and config accounts", () => {
  const current = Keypair.generate().publicKey;
  const next = Keypair.generate().publicKey;
  const ix = setAuthorityIx(current, next);
  assert.equal(ix.data[0], 7);
  assert.equal(new PublicKey(ix.data.subarray(1)).toBase58(), next.toBase58());
  assert.equal(ix.keys.length, 2);
  assert.equal(ix.keys[0].pubkey.toBase58(), current.toBase58());
  assert.equal(ix.keys[0].isSigner, true);
  assert.equal(ix.keys[1].isWritable, true);
});
test("market status follows close and resolve timestamps", () => {
  const market = { closeTs: 200, resolveTs: 300, outcome: 0 };
  assert.equal(marketPhase(market, 199), "open");
  assert.equal(marketPhase(market, 200), "closed");
  assert.equal(marketPhase(market, 300), "awaiting-settlement");
  assert.equal(marketPhase({ ...market, outcome: 1 }, 100), "settled");
});
test("new market is blocked only by an unfinished interval in the same city", () => {
  const shanghai = { resolveTs: 300, outcome: 0, lat: 31.13, lon: 121.47 };
  assert.equal(hasUnfinishedMarket([shanghai], 299, 31.13, 121.47), true);
  assert.equal(hasUnfinishedMarket([shanghai], 299, 39.9, 116.4), false);
  assert.equal(hasUnfinishedMarket([shanghai], 300, 31.13, 121.47), false);
  assert.equal(hasUnfinishedMarket([{ ...shanghai, outcome: 1 }], 200, 31.13, 121.47), false);
});
test("each city has an independent schedule PDA", () => {
  assert.notEqual(schedulePda(31.13, 121.47).toBase58(), schedulePda(39.9, 116.4).toBase58());
  assert.equal(schedulePda(31.13, 121.47).toBase58(), schedulePda(31.13, 121.47).toBase58());
});
test("all supported domestic and overseas cities have unique ids and coordinates", () => {
  assert.equal(CITIES.length, 24);
  assert.deepEqual(new Set(CITIES.map((city) => city.region)), new Set(["国内", "海外"]));
  assert.equal(new Set(CITIES.map((city) => city.id)).size, CITIES.length);
  assert.equal(new Set(CITIES.map((city) => `${city.latitude},${city.longitude}`)).size, CITIES.length);
});
test("create market encodes the selected city coordinates", () => {
  const creator = Keypair.generate().publicKey;
  const city = CITIES[4];
  const { ix } = createMarketIx(creator, 9n, 100n, 200n, city.latitude, city.longitude);
  assert.equal(ix.data.readInt32LE(25), Math.round(city.latitude * 10_000));
  assert.equal(ix.data.readInt32LE(29), Math.round(city.longitude * 10_000));
  assert.equal(cityForCoordinates(city.latitude, city.longitude)?.id, city.id);
  assert.equal(cityLabel(city.latitude, city.longitude), "成都 · 锦江");
});
test("create market rejects out-of-range coordinates", () => {
  assert.throws(() => createMarketIx(Keypair.generate().publicKey, 1n, 100n, 200n, 91, 0), /城市坐标无效/);
});
