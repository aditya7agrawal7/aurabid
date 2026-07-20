#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    symbol_short, Address, Env, Symbol,
};

#[derive(Clone)]
#[contracttype]
pub struct Auction {
    pub id: u64,
    pub seller: Address,
    pub title: Symbol,
    pub starting_bid: i128,
    pub minimum_increment: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub highest_bid: i128,
    pub highest_bidder: Option<Address>,
    pub settled: bool,
    pub cancelled: bool,
    pub total_bids: u64,
}

#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum AuctionError {
    InvalidDuration = 1,
    InvalidBidAmount = 2,
    AuctionNotFound = 3,
    AuctionNotActive = 4,
    AuctionAlreadySettled = 5,
    AuctionWasCancelled = 6,
    BidTooLow = 7,
    AlreadyHighestBidder = 8,
    NotSeller = 9,
    AuctionStillActive = 10,
}

const ANTI_SNIPE_EXTENSION: u64 = 600;
const ANTI_SNIPE_THRESHOLD: u64 = 300;
const MIN_DURATION: u64 = 60;
const MAX_DURATION: u64 = 2_592_000;

const KEY_NEXT_ID: Symbol = symbol_short!("next_id");

#[contract]
pub struct AuctionHouse;

#[contractimpl]
impl AuctionHouse {
    pub fn create_auction(
        env: Env,
        seller: Address,
        title: Symbol,
        starting_bid: i128,
        minimum_increment: i128,
        duration: u64,
    ) -> u64 {
        seller.require_auth();

        if duration < MIN_DURATION || duration > MAX_DURATION {
            panic!("invalid duration");
        }
        if starting_bid <= 0 {
            panic!("invalid starting bid");
        }
        if minimum_increment <= 0 {
            panic!("invalid minimum increment");
        }

        let auction_id: u64 = env.storage().instance().get(&KEY_NEXT_ID).unwrap_or(0);
        let start_time = env.ledger().timestamp();
        let end_time = start_time + duration;

        let auction = Auction {
            id: auction_id,
            seller: seller.clone(),
            title: title.clone(),
            starting_bid,
            minimum_increment,
            start_time,
            end_time,
            highest_bid: 0,
            highest_bidder: None,
            settled: false,
            cancelled: false,
            total_bids: 0,
        };

        env.storage().persistent().set(&auction_id, &auction);
        env.storage().instance().set(&KEY_NEXT_ID, &(auction_id + 1));

        auction_id
    }

    pub fn place_bid(
        env: Env,
        bidder: Address,
        auction_id: u64,
        amount: i128,
    ) {
        bidder.require_auth();

        let mut auction: Auction = env.storage().persistent().get(&auction_id)
            .unwrap_or_else(|| panic!("auction not found"));

        if auction.settled {
            panic!("auction already settled");
        }
        if auction.cancelled {
            panic!("auction was cancelled");
        }

        let now = env.ledger().timestamp();
        if now < auction.start_time || now > auction.end_time {
            panic!("auction not active");
        }

        let min_bid = if auction.highest_bid == 0 {
            auction.starting_bid
        } else {
            auction.highest_bid + auction.minimum_increment
        };

        if amount < min_bid {
            panic!("bid too low");
        }

        if let Some(ref current) = auction.highest_bidder {
            if *current == bidder {
                panic!("already highest bidder");
            }
        }

        let mut new_end_time = auction.end_time;
        if auction.end_time - now < ANTI_SNIPE_THRESHOLD {
            new_end_time = now + ANTI_SNIPE_EXTENSION;
        }

        auction.highest_bid = amount;
        auction.highest_bidder = Some(bidder.clone());
        auction.total_bids += 1;
        auction.end_time = new_end_time;

        env.storage().persistent().set(&auction_id, &auction);
    }

    pub fn settle_auction(env: Env, auction_id: u64) {
        let mut auction: Auction = env.storage().persistent().get(&auction_id)
            .unwrap_or_else(|| panic!("auction not found"));

        if auction.settled {
            panic!("auction already settled");
        }
        if auction.cancelled {
            panic!("auction was cancelled");
        }

        let now = env.ledger().timestamp();
        if now < auction.end_time {
            panic!("auction still active");
        }

        auction.settled = true;
        env.storage().persistent().set(&auction_id, &auction);
    }

    pub fn cancel_auction(env: Env, seller: Address, auction_id: u64) {
        seller.require_auth();

        let mut auction: Auction = env.storage().persistent().get(&auction_id)
            .unwrap_or_else(|| panic!("auction not found"));

        if auction.seller != seller {
            panic!("not seller");
        }
        if auction.settled {
            panic!("auction already settled");
        }

        auction.cancelled = true;
        env.storage().persistent().set(&auction_id, &auction);
    }

    pub fn get_auction(env: Env, auction_id: u64) -> Auction {
        env.storage().persistent().get(&auction_id)
            .unwrap_or_else(|| panic!("auction not found"))
    }

    pub fn get_auction_count(env: Env) -> u64 {
        env.storage().instance().get(&KEY_NEXT_ID).unwrap_or(0)
    }
}

#[cfg(test)]
mod tests;
