#![cfg(test)]

use soroban_sdk::{symbol_short, Env};
use soroban_sdk::testutils::{Address as _, Ledger as _};
use crate::{AuctionHouse, AuctionHouseClient};

fn setup() -> (Env, AuctionHouseClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, AuctionHouse);
    let client = AuctionHouseClient::new(&env, &contract_id);
    (env, client)
}

#[test]
fn test_create_auction() {
    let (env, client) = setup();
    let seller = soroban_sdk::Address::generate(&env);

    let auction_id = client.create_auction(
        &seller,
        &symbol_short!("Item"),
        &100,
        &10,
        &3600,
    );

    assert_eq!(auction_id, 0);

    let auction = client.get_auction(&auction_id);
    assert_eq!(auction.seller, seller);
    assert_eq!(auction.title, symbol_short!("Item"));
    assert_eq!(auction.starting_bid, 100);
    assert_eq!(auction.minimum_increment, 10);
    assert_eq!(auction.highest_bid, 0);
    assert_eq!(auction.settled, false);
    assert_eq!(auction.cancelled, false);
    assert_eq!(client.get_auction_count(), 1);
}

#[test]
fn test_place_bid() {
    let (env, client) = setup();
    let seller = soroban_sdk::Address::generate(&env);

    let auction_id = client.create_auction(
        &seller,
        &symbol_short!("Item"),
        &100,
        &10,
        &3600,
    );

    let bidder = soroban_sdk::Address::generate(&env);
    client.place_bid(&bidder, &auction_id, &100);

    let auction = client.get_auction(&auction_id);
    assert_eq!(auction.highest_bid, 100);
    assert_eq!(auction.highest_bidder, Some(bidder));
    assert_eq!(auction.total_bids, 1);
}

#[test]
fn test_place_bid_too_low() {
    let (env, client) = setup();
    let seller = soroban_sdk::Address::generate(&env);

    let auction_id = client.create_auction(
        &seller,
        &symbol_short!("Item"),
        &100,
        &10,
        &3600,
    );

    let bidder = soroban_sdk::Address::generate(&env);
    let result = client.try_place_bid(&bidder, &auction_id, &50);
    assert!(result.is_err());
}

#[test]
fn test_settle_auction() {
    let (env, client) = setup();
    let seller = soroban_sdk::Address::generate(&env);

    let auction_id = client.create_auction(
        &seller,
        &symbol_short!("Item"),
        &100,
        &10,
        &3600,
    );

    let bidder = soroban_sdk::Address::generate(&env);
    client.place_bid(&bidder, &auction_id, &100);

    env.ledger().set_timestamp(env.ledger().timestamp() + 3601);

    client.settle_auction(&auction_id);

    let auction = client.get_auction(&auction_id);
    assert_eq!(auction.settled, true);
    assert_eq!(auction.highest_bidder, Some(bidder));
}

#[test]
fn test_cancel_auction() {
    let (env, client) = setup();
    let seller = soroban_sdk::Address::generate(&env);

    let auction_id = client.create_auction(
        &seller,
        &symbol_short!("Item"),
        &100,
        &10,
        &3600,
    );

    client.cancel_auction(&seller, &auction_id);

    let auction = client.get_auction(&auction_id);
    assert_eq!(auction.cancelled, true);
}

#[test]
fn test_invalid_duration() {
    let (env, client) = setup();
    let seller = soroban_sdk::Address::generate(&env);

    let result = client.try_create_auction(
        &seller,
        &symbol_short!("Item"),
        &100,
        &10,
        &10,
    );
    assert!(result.is_err());
}
