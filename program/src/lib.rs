#![no_std]
#![allow(unexpected_cfgs)]

use pinocchio::{
    account_info::AccountInfo,
    entrypoint,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    pubkey::{find_program_address, Pubkey},
    sysvars::{clock::Clock, rent::Rent, Sysvar},
    ProgramResult,
};
use pinocchio_system::instructions::{CreateAccount, Transfer};

entrypoint!(process_instruction);
pinocchio::nostd_panic_handler!();

pub const ID: Pubkey = [
    0x9d, 0x7b, 0x7c, 0x80, 0xf1, 0x57, 0xfa, 0x55, 0xc6, 0x7f, 0x2e, 0x2a, 0x09, 0x64, 0x21, 0x96,
    0x91, 0x34, 0x52, 0xe5, 0xbd, 0x6f, 0x55, 0x4e, 0xe0, 0xdb, 0xf3, 0xc0, 0x1a, 0xc5, 0xea, 0x98,
];

const CONFIG_LEN: usize = 72;
const MARKET_LEN: usize = 200;
const POSITION_LEN: usize = 96;
const SCHEDULE_LEN: usize = 16;
const CONFIG_DISC: u8 = 1;
const MARKET_DISC: u8 = 2;
const POSITION_DISC: u8 = 3;
const SCHEDULE_DISC: u8 = 4;
const MIN_BET: u64 = 100_000;
const MAX_OBSERVATION_DELAY: i64 = 48 * 60 * 60;

#[repr(u32)]
enum WeatherError {
    InvalidAccounts = 1,
    InvalidPda,
    InvalidState,
    InvalidAuthority,
    InvalidTime,
    InvalidAmount,
    InvalidSide,
    MathOverflow,
    AlreadyInitialized,
    AlreadyClaimed,
    NoWinnings,
    ObservationStale,
    MarketOverlap,
}
impl From<WeatherError> for ProgramError {
    fn from(value: WeatherError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    if program_id != &ID {
        return Err(ProgramError::IncorrectProgramId);
    }
    let (tag, rest) = data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;
    match tag {
        0 => initialize(accounts, rest),
        1 => create_market(accounts, rest),
        2 => place_bet(accounts, rest),
        3 => settle(accounts, rest),
        4 => claim(accounts, rest),
        5 => set_oracle(accounts, rest),
        6 => withdraw_fees(accounts, rest),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

// accounts: config authority signer, config writable; data: new oracle pubkey[32]
fn set_oracle(a: &[AccountInfo], d: &[u8]) -> ProgramResult {
    if a.len() != 2 || d.len() != 32 {
        return Err(WeatherError::InvalidAccounts.into());
    }
    let (authority, config) = (&a[0], &a[1]);
    if !authority.is_signer() || !config.is_writable() {
        return Err(WeatherError::InvalidAccounts.into());
    }
    validate_config(config)?;
    let mut cd = config.try_borrow_mut_data()?;
    if &cd[8..40] != authority.key() {
        return Err(WeatherError::InvalidAuthority.into());
    }
    cd[40..72].copy_from_slice(d);
    Ok(())
}

// accounts: authority(s,w), config(w), system_program; data: oracle[32]
fn initialize(a: &[AccountInfo], d: &[u8]) -> ProgramResult {
    if a.len() != 3 || d.len() != 32 {
        return Err(WeatherError::InvalidAccounts.into());
    }
    let (authority, config, system) = (&a[0], &a[1], &a[2]);
    signer_writable(authority)?;
    if !config.is_writable() || system.key() != &pinocchio_system::ID {
        return Err(WeatherError::InvalidAccounts.into());
    }
    if config.data_len() != 0 {
        return Err(WeatherError::AlreadyInitialized.into());
    }
    let (expected, bump) = find_program_address(&[b"config"], &ID);
    if config.key() != &expected {
        return Err(WeatherError::InvalidPda.into());
    }
    let bump_seed = [bump];
    CreateAccount {
        from: authority,
        to: config,
        lamports: rent(CONFIG_LEN)?,
        space: CONFIG_LEN as u64,
        owner: &ID,
    }
    .invoke_signed(&[Signer::from(&[
        Seed::from(b"config"),
        Seed::from(&bump_seed),
    ])])?;
    let mut out = config.try_borrow_mut_data()?;
    out[0] = CONFIG_DISC;
    out[1] = bump;
    out[8..40].copy_from_slice(authority.key());
    out[40..72].copy_from_slice(d);
    Ok(())
}

// accounts: creator(s,w), market(w), config, schedule(w), system_program
// data: market_id u64, close_ts i64, resolve_ts i64, lat_e4 i32, lon_e4 i32, threshold_tenth_mm u16
fn create_market(a: &[AccountInfo], d: &[u8]) -> ProgramResult {
    if a.len() != 5 || d.len() != 34 {
        return Err(WeatherError::InvalidAccounts.into());
    }
    let (creator, market, config, schedule, system) = (&a[0], &a[1], &a[2], &a[3], &a[4]);
    signer_writable(creator)?;
    if !market.is_writable()
        || !schedule.is_writable()
        || market.data_len() != 0
        || system.key() != &pinocchio_system::ID
    {
        return Err(WeatherError::InvalidAccounts.into());
    }
    validate_config(config)?;
    let id = u64_at(d, 0)?;
    let close_ts = i64_at(d, 8)?;
    let resolve_ts = i64_at(d, 16)?;
    let now = Clock::get()?.unix_timestamp;
    let (expected_schedule, schedule_bump) = find_program_address(&[b"schedule"], &ID);
    if schedule.key() != &expected_schedule {
        return Err(WeatherError::InvalidPda.into());
    }
    let last_resolve_ts = if schedule.data_len() == 0 {
        let bump_seed = [schedule_bump];
        CreateAccount {
            from: creator,
            to: schedule,
            lamports: rent(SCHEDULE_LEN)?,
            space: SCHEDULE_LEN as u64,
            owner: &ID,
        }
        .invoke_signed(&[Signer::from(&[
            Seed::from(b"schedule"),
            Seed::from(&bump_seed),
        ])])?;
        let mut sd = schedule.try_borrow_mut_data()?;
        sd[0] = SCHEDULE_DISC;
        sd[1] = schedule_bump;
        0
    } else {
        validate_schedule(schedule)?;
        let sd = schedule.try_borrow_data()?;
        i64_at(&sd, 8)?
    };
    validate_market_times(now, close_ts, resolve_ts, last_resolve_ts)?;
    let id_bytes = id.to_le_bytes();
    let (expected, bump) = find_program_address(&[b"market", creator.key(), &id_bytes], &ID);
    if market.key() != &expected {
        return Err(WeatherError::InvalidPda.into());
    }
    let bump_seed = [bump];
    let seeds = [
        Seed::from(b"market"),
        Seed::from(creator.key()),
        Seed::from(&id_bytes),
        Seed::from(&bump_seed),
    ];
    CreateAccount {
        from: creator,
        to: market,
        lamports: rent(MARKET_LEN)?,
        space: MARKET_LEN as u64,
        owner: &ID,
    }
    .invoke_signed(&[Signer::from(&seeds)])?;
    let mut out = market.try_borrow_mut_data()?;
    out[0] = MARKET_DISC;
    out[1] = bump;
    out[2] = 0;
    out[8..40].copy_from_slice(creator.key());
    out[40..48].copy_from_slice(&id_bytes);
    out[48..56].copy_from_slice(&close_ts.to_le_bytes());
    out[56..64].copy_from_slice(&resolve_ts.to_le_bytes());
    out[64..68].copy_from_slice(&d[24..28]);
    out[68..72].copy_from_slice(&d[28..32]);
    out[72..74].copy_from_slice(&d[32..34]);
    drop(out);
    schedule.try_borrow_mut_data()?[8..16].copy_from_slice(&resolve_ts.to_le_bytes());
    Ok(())
}

// accounts bettor(s,w), market(w), position(w), system; data side u8 + amount u64
fn place_bet(a: &[AccountInfo], d: &[u8]) -> ProgramResult {
    if a.len() != 4 || d.len() != 9 {
        return Err(WeatherError::InvalidAccounts.into());
    }
    let (bettor, market, position, system) = (&a[0], &a[1], &a[2], &a[3]);
    signer_writable(bettor)?;
    if !market.is_writable() || !position.is_writable() || system.key() != &pinocchio_system::ID {
        return Err(WeatherError::InvalidAccounts.into());
    }
    validate_market(market)?;
    let side = d[0];
    let amount = u64_at(d, 1)?;
    if side > 1 {
        return Err(WeatherError::InvalidSide.into());
    }
    if amount < MIN_BET {
        return Err(WeatherError::InvalidAmount.into());
    }
    let now = Clock::get()?.unix_timestamp;
    let close_ts = {
        let md = market.try_borrow_data()?;
        i64_at(&md, 48)?
    };
    if now >= close_ts {
        return Err(WeatherError::InvalidTime.into());
    }
    let (expected, bump) = find_program_address(&[b"position", market.key(), bettor.key()], &ID);
    if position.key() != &expected {
        return Err(WeatherError::InvalidPda.into());
    }
    if position.data_len() == 0 {
        let bump_seed = [bump];
        let seeds = [
            Seed::from(b"position"),
            Seed::from(market.key()),
            Seed::from(bettor.key()),
            Seed::from(&bump_seed),
        ];
        CreateAccount {
            from: bettor,
            to: position,
            lamports: rent(POSITION_LEN)?,
            space: POSITION_LEN as u64,
            owner: &ID,
        }
        .invoke_signed(&[Signer::from(&seeds)])?;
        let mut pd = position.try_borrow_mut_data()?;
        pd[0] = POSITION_DISC;
        pd[1] = bump;
        pd[2] = 0;
        pd[8..40].copy_from_slice(market.key());
        pd[40..72].copy_from_slice(bettor.key());
    } else {
        validate_position(position, market, bettor)?;
    }
    Transfer {
        from: bettor,
        to: market,
        lamports: amount,
    }
    .invoke()?;
    {
        let mut md = market.try_borrow_mut_data()?;
        let off = if side == 1 { 80 } else { 88 };
        let total = u64_at(&md, off)?
            .checked_add(amount)
            .ok_or(WeatherError::MathOverflow)?;
        md[off..off + 8].copy_from_slice(&total.to_le_bytes());
    }
    let mut pd = position.try_borrow_mut_data()?;
    let off = if side == 1 { 72 } else { 80 };
    let total = u64_at(&pd, off)?
        .checked_add(amount)
        .ok_or(WeatherError::MathOverflow)?;
    pd[off..off + 8].copy_from_slice(&total.to_le_bytes());
    Ok(())
}

// accounts oracle(s), config(w), market(w); data precipitation_tenth_mm u16 + observed_at i64
fn settle(a: &[AccountInfo], d: &[u8]) -> ProgramResult {
    if a.len() != 3 || d.len() != 10 {
        return Err(WeatherError::InvalidAccounts.into());
    }
    let (oracle, config, market) = (&a[0], &a[1], &a[2]);
    if !oracle.is_signer() || !config.is_writable() || !market.is_writable() {
        return Err(WeatherError::InvalidAccounts.into());
    }
    validate_config(config)?;
    validate_market(market)?;
    let cd = config.try_borrow_data()?;
    if &cd[40..72] != oracle.key() {
        return Err(WeatherError::InvalidAuthority.into());
    }
    let precipitation = u16_at(d, 0)?;
    let observed_at = i64_at(d, 2)?;
    let now = Clock::get()?.unix_timestamp;
    let mut md = market.try_borrow_mut_data()?;
    if md[2] != 0 {
        return Err(WeatherError::InvalidState.into());
    }
    let resolve_ts = i64_at(&md, 56)?;
    if now < resolve_ts
        || observed_at < resolve_ts
        || observed_at > now
        || now - observed_at > MAX_OBSERVATION_DELAY
    {
        return Err(WeatherError::ObservationStale.into());
    }
    let threshold = u16_at(&md, 72)?;
    let pool = u64_at(&md, 80)?
        .checked_add(u64_at(&md, 88)?)
        .ok_or(WeatherError::MathOverflow)?;
    let outcome = if precipitation >= threshold { 1 } else { 2 }; // 1 YES, 2 NO
    let winning_total = if outcome == 1 {
        u64_at(&md, 80)?
    } else {
        u64_at(&md, 88)?
    };
    // If nobody backed the winning side, all stakes are refunded and no fee is charged.
    let fee = if winning_total == 0 { 0 } else { pool / 100 };
    md[2] = outcome;
    md[96..98].copy_from_slice(&precipitation.to_le_bytes());
    md[104..112].copy_from_slice(&observed_at.to_le_bytes());
    md[112..120].copy_from_slice(&fee.to_le_bytes());
    drop(md);
    if fee != 0 {
        let config_balance = config.lamports();
        *market.try_borrow_mut_lamports()? = market
            .lamports()
            .checked_sub(fee)
            .ok_or(WeatherError::InvalidAmount)?;
        *config.try_borrow_mut_lamports()? = config_balance
            .checked_add(fee)
            .ok_or(WeatherError::MathOverflow)?;
    }
    Ok(())
}

// accounts bettor(s,w), market(w), position(w)
fn claim(a: &[AccountInfo], d: &[u8]) -> ProgramResult {
    if a.len() != 3 || !d.is_empty() {
        return Err(WeatherError::InvalidAccounts.into());
    }
    let (bettor, market, position) = (&a[0], &a[1], &a[2]);
    signer_writable(bettor)?;
    if !market.is_writable() || !position.is_writable() {
        return Err(WeatherError::InvalidAccounts.into());
    }
    validate_market(market)?;
    validate_position(position, market, bettor)?;
    let md = market.try_borrow_data()?;
    let outcome = md[2];
    if outcome == 0 {
        return Err(WeatherError::InvalidState.into());
    }
    let yes_total = u64_at(&md, 80)?;
    let no_total = u64_at(&md, 88)?;
    let fee = u64_at(&md, 112)?;
    let claimed_winning_stake = u64_at(&md, 120)?;
    let paid = u64_at(&md, 128)?;
    drop(md);
    let mut pd = position.try_borrow_mut_data()?;
    if pd[2] != 0 {
        return Err(WeatherError::AlreadyClaimed.into());
    }
    let yes = u64_at(&pd, 72)?;
    let no = u64_at(&pd, 80)?;
    let (winning_stake, winning_total) = if outcome == 1 {
        (yes, yes_total)
    } else {
        (no, no_total)
    };
    let stake = if winning_total == 0 {
        yes.checked_add(no).ok_or(WeatherError::MathOverflow)?
    } else {
        winning_stake
    };
    if stake == 0 {
        return Err(WeatherError::NoWinnings.into());
    }
    let pool = yes_total
        .checked_add(no_total)
        .ok_or(WeatherError::MathOverflow)?;
    let distributable = pool.checked_sub(fee).ok_or(WeatherError::MathOverflow)?;
    let new_claimed_stake = claimed_winning_stake
        .checked_add(stake)
        .ok_or(WeatherError::MathOverflow)?;
    if winning_total != 0 && new_claimed_stake > winning_total {
        return Err(WeatherError::InvalidState.into());
    }
    let payout = if winning_total == 0 {
        stake
    } else if new_claimed_stake == winning_total {
        distributable
            .checked_sub(paid)
            .ok_or(WeatherError::MathOverflow)?
    } else {
        (stake as u128)
            .checked_mul(distributable as u128)
            .ok_or(WeatherError::MathOverflow)?
            .checked_div(winning_total as u128)
            .ok_or(WeatherError::MathOverflow)? as u64
    };
    let rent_floor = rent(MARKET_LEN)?;
    if market.lamports().saturating_sub(rent_floor) < payout {
        return Err(WeatherError::InvalidAmount.into());
    }
    let bettor_balance = bettor.lamports();
    *market.try_borrow_mut_lamports()? -= payout;
    *bettor.try_borrow_mut_lamports()? = bettor_balance
        .checked_add(payout)
        .ok_or(WeatherError::MathOverflow)?;
    pd[2] = 1;
    pd[88..96].copy_from_slice(&payout.to_le_bytes());
    drop(pd);
    if winning_total != 0 {
        let mut md = market.try_borrow_mut_data()?;
        md[120..128].copy_from_slice(&new_claimed_stake.to_le_bytes());
        md[128..136].copy_from_slice(
            &paid
                .checked_add(payout)
                .ok_or(WeatherError::MathOverflow)?
                .to_le_bytes(),
        );
    }
    Ok(())
}

// accounts authority(s,w), config(w); withdraw all accrued fees above rent
fn withdraw_fees(a: &[AccountInfo], d: &[u8]) -> ProgramResult {
    if a.len() != 2 || !d.is_empty() {
        return Err(WeatherError::InvalidAccounts.into());
    }
    let (authority, config) = (&a[0], &a[1]);
    signer_writable(authority)?;
    if !config.is_writable() {
        return Err(WeatherError::InvalidAccounts.into());
    }
    validate_config(config)?;
    if &config.try_borrow_data()?[8..40] != authority.key() {
        return Err(WeatherError::InvalidAuthority.into());
    }
    let amount = config.lamports().saturating_sub(rent(CONFIG_LEN)?);
    if amount == 0 {
        return Err(WeatherError::InvalidAmount.into());
    }
    let balance = authority.lamports();
    *config.try_borrow_mut_lamports()? -= amount;
    *authority.try_borrow_mut_lamports()? = balance
        .checked_add(amount)
        .ok_or(WeatherError::MathOverflow)?;
    Ok(())
}

fn signer_writable(a: &AccountInfo) -> ProgramResult {
    if !a.is_signer() || !a.is_writable() {
        Err(WeatherError::InvalidAccounts.into())
    } else {
        Ok(())
    }
}
fn validate_config(a: &AccountInfo) -> ProgramResult {
    let (expected, _) = find_program_address(&[b"config"], &ID);
    if a.key() != &expected || a.owner() != &ID || a.data_len() != CONFIG_LEN {
        return Err(WeatherError::InvalidPda.into());
    }
    if a.try_borrow_data()?[0] != CONFIG_DISC {
        return Err(WeatherError::InvalidState.into());
    }
    Ok(())
}
fn validate_market(a: &AccountInfo) -> ProgramResult {
    if a.owner() != &ID || a.data_len() != MARKET_LEN || a.try_borrow_data()?[0] != MARKET_DISC {
        return Err(WeatherError::InvalidState.into());
    }
    Ok(())
}
fn validate_position(a: &AccountInfo, market: &AccountInfo, bettor: &AccountInfo) -> ProgramResult {
    if a.owner() != &ID || a.data_len() != POSITION_LEN {
        return Err(WeatherError::InvalidState.into());
    }
    let d = a.try_borrow_data()?;
    if d[0] != POSITION_DISC || &d[8..40] != market.key() || &d[40..72] != bettor.key() {
        return Err(WeatherError::InvalidState.into());
    }
    Ok(())
}
fn validate_schedule(a: &AccountInfo) -> ProgramResult {
    let (expected, _) = find_program_address(&[b"schedule"], &ID);
    if a.key() != &expected || a.owner() != &ID || a.data_len() != SCHEDULE_LEN {
        return Err(WeatherError::InvalidPda.into());
    }
    if a.try_borrow_data()?[0] != SCHEDULE_DISC {
        return Err(WeatherError::InvalidState.into());
    }
    Ok(())
}
fn validate_market_times(
    now: i64,
    close_ts: i64,
    resolve_ts: i64,
    last_resolve_ts: i64,
) -> ProgramResult {
    if close_ts <= now || resolve_ts <= close_ts {
        return Err(WeatherError::InvalidTime.into());
    }
    if now < last_resolve_ts {
        return Err(WeatherError::MarketOverlap.into());
    }
    Ok(())
}
fn rent(len: usize) -> Result<u64, ProgramError> {
    Ok(Rent::get()?.minimum_balance(len))
}
fn u64_at(d: &[u8], o: usize) -> Result<u64, ProgramError> {
    Ok(u64::from_le_bytes(
        d.get(o..o + 8)
            .ok_or(ProgramError::InvalidInstructionData)?
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    ))
}
fn i64_at(d: &[u8], o: usize) -> Result<i64, ProgramError> {
    Ok(i64::from_le_bytes(
        d.get(o..o + 8)
            .ok_or(ProgramError::InvalidInstructionData)?
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    ))
}
fn u16_at(d: &[u8], o: usize) -> Result<u16, ProgramError> {
    Ok(u16::from_le_bytes(
        d.get(o..o + 2)
            .ok_or(ProgramError::InvalidInstructionData)?
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_short_numbers() {
        assert!(u64_at(&[0; 7], 0).is_err());
    }
    #[test]
    fn parses_little_endian() {
        assert_eq!(u16_at(&[0x34, 0x12], 0).unwrap(), 0x1234);
    }
    #[test]
    fn program_id_is_not_system() {
        assert_ne!(ID, pinocchio_system::ID);
    }
    #[test]
    fn rejects_overlapping_market() {
        assert_eq!(
            validate_market_times(100, 200, 300, 301),
            Err(ProgramError::Custom(WeatherError::MarketOverlap as u32))
        );
    }
    #[test]
    fn accepts_market_after_previous_interval() {
        assert!(validate_market_times(301, 400, 500, 301).is_ok());
    }
}
