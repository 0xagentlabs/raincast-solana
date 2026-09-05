import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import fs from "node:fs";
const root = new URL("../", import.meta.url);
const load = (name: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(new URL(name, root), "utf8"))));
const payer = load(process.env.SOLANA_KEYPAIR || "/root/.config/solana/id.json");
const oracle = load("oracle-keypair.json");
const programId = new PublicKey("BbkDnkPC7HD8TeNHp3iCDwjLxF3WDmg2Yrh9gVZrwohH");
const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
if (await connection.getAccountInfo(config)) { console.log(JSON.stringify({ initialized: true, config: config.toBase58(), oracle: oracle.publicKey.toBase58() })); process.exit(0); }
const ix = new TransactionInstruction({ programId, keys: [
  { pubkey: payer.publicKey, isSigner: true, isWritable: true }, { pubkey: config, isSigner: false, isWritable: true },
  { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
], data: Buffer.concat([Buffer.from([0]), oracle.publicKey.toBuffer()]) });
const signature = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [payer]);
console.log(JSON.stringify({ initialized: true, signature, config: config.toBase58(), oracle: oracle.publicKey.toBase58() }));

