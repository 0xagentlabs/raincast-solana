# RainCast ABI

All integers are little-endian. The program ID is `BbkDnkPC7HD8TeNHp3iCDwjLxF3WDmg2Yrh9gVZrwohH`.

| Tag | Instruction | Data after tag | Accounts in order |
|---:|---|---|---|
| 0 | Initialize | oracle `pubkey[32]` | authority signer+writable; config writable; System Program |
| 1 | CreateMarket | market_id `u64`; close_ts `i64`; resolve_ts `i64`; latitude_e4 `i32`; longitude_e4 `i32`; rain_threshold_tenth_mm `u16` | creator signer+writable; market writable; config; schedule writable; System Program |
| 2 | PlaceBet | side `u8` (`0=NO`, `1=YES`); lamports `u64` | bettor signer+writable; market writable; position writable; System Program |
| 3 | Settle | precipitation_tenth_mm `u16`; observed_at `i64` | configured oracle signer; config writable; market writable |
| 4 | Claim | none | bettor signer+writable; market writable; position writable |
| 5 | SetOracle | new oracle `pubkey[32]` | config authority signer; config writable |
| 6 | WithdrawFees | none | config authority signer+writable; config writable |
| 7 | SetAuthority | new authority `pubkey[32]` | current config authority signer; config writable |

PDA seeds: config `["config"]`; schedule `["schedule", latitude_e4_le, longitude_e4_le]`; market `["market", creator, market_id_le]`; position `["position", market, bettor]`.

Schedule data (16 bytes): discriminator 0 (`4`); bump 1; latest market resolve timestamp 8..16. Each city coordinate pair has an independent schedule. `CreateMarket` atomically rejects creation while the current Unix timestamp is earlier than that city's timestamp, so same-city market ranges cannot overlap while different cities can run concurrently.

Market data (200 bytes): discriminator 0; bump 1; outcome 2 (`0=open,1=YES,2=NO`); creator 8..40; id 40..48; close 48..56; resolve 56..64; latitude 64..68; longitude 68..72; threshold 72..74; YES pool 80..88; NO pool 88..96; observed precipitation 96..98; observed timestamp 104..112; platform fee 112..120; claimed winning stake 120..128; paid winning proceeds 128..136.

Errors are custom codes 1–13 in enum order: invalid accounts, PDA, state, authority, time, amount, side, overflow, already initialized, already claimed, no winnings, stale observation, market overlap.

`PlaceBet` requires `lamports >= 10_000_000` (0.01 SOL). The client may submit any exact lamport amount at or above this minimum.

`SetAuthority` atomically replaces the config authority and can only be signed by the current authority.

Settlement moves 1% of the total pool (integer division, rounded down) into the config PDA as platform revenue. Winners share all remaining proceeds proportionally; the final winning claim receives rounding dust. `WithdrawFees` lets only the config authority withdraw all revenue above the config rent reserve. If the winning side has zero stake, no fee is charged and every participant may reclaim their own stake.
