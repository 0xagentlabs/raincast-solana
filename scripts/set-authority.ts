import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import fs from "node:fs";
import { CONFIG, readConfig, setAuthorityIx } from "../app/lib/program.ts";

const address = process.argv.find((value, index) => index > 1 && value !== "--") || "";
const newAuthority = new PublicKey(address);
const payer = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(
        process.env.SOLANA_KEYPAIR || "/root/.config/solana/id.json",
        "utf8",
      ),
    ),
  ),
);
const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  "confirmed",
);
const before = await readConfig(connection);
if (!before.authority.equals(payer.publicKey)) {
  throw new Error(`签名钱包不是当前 Config authority：${before.authority.toBase58()}`);
}
const signature = await sendAndConfirmTransaction(
  connection,
  new Transaction().add(setAuthorityIx(payer.publicKey, newAuthority)),
  [payer],
);
const after = await readConfig(connection);
if (!after.authority.equals(newAuthority)) {
  throw new Error("链上 Config authority 回读不一致");
}
console.log(
  JSON.stringify({
    signature,
    config: CONFIG.toBase58(),
    previousAuthority: before.authority.toBase58(),
    authority: after.authority.toBase58(),
  }),
);
