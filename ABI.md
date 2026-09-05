# RainCast ABI

All integers are little-endian. The program ID is `BbkDnkPC7HD8TeNHp3iCDwjLxF3WDmg2Yrh9gVZrwohH`.

| Tag | Instruction | Data after tag | Accounts in order |
|---:|---|---|---|
| 0 | Initialize | oracle `pubkey[32]` | authority signer+writable; config writable; System Program |
| 1 | CreateMarket | market_id `u64`; close_ts `i64`; resolve_ts `i64`; latitude_e4 `i32`; longitude_e4 `i32`; rain_threshold_tenth_mm `u16` | creator signer+writable; market writable; config; System Program |
| 2 | PlaceBet | side `u8` (`0=NO`, `1=YES`); lamports `u64` | bettor signer+writable; market writable; position writable; System Program |
| 3 | Settle | precipitation_tenth_mm `u16`; observed_at `i64` | configured oracle signer; config; market writable |
| 4 | Claim | none | bettor signer+writable; market writable; position writable |

PDA seeds: config `["config"]`; market `["market", creator, market_id_le]`; position `["position", market, bettor]`.

Market data (200 bytes): discriminator 0; bump 1; outcome 2 (`0=open,1=YES,2=NO`); creator 8..40; id 40..48; close 48..56; resolve 56..64; latitude 64..68; longitude 68..72; threshold 72..74; YES pool 80..88; NO pool 88..96; observed precipitation 96..98; observed timestamp 104..112.

Errors are custom codes 1–12 in enum order: invalid accounts, PDA, state, authority, time, amount, side, overflow, already initialized, already claimed, no winnings, stale observation.

If the winning side has zero stake, every participant may reclaim their own stake; this prevents an empty winning pool from locking funds.
