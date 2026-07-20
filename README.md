# AuraBid - Soroban Auction Contract

A decentralized auction smart contract built on Stellar using Soroban. Users can create auctions, place bids with anti-snipe protection, and settle auctions entirely on-chain.

------------------------------------------------------------------------------------------------------------------------------------------------
deployed live on-https://6a429c12cf79694da05091a3--serene-fudge-e96cca.netlify.app/
------------------------------------------------------------------------------------------------------------------------------------------------

## Architecture

```
User Interaction
       |
       v
Stellar CLI / Freighter Wallet
       |  (Signs and submits transaction)
       v
Stellar Network (Testnet)
       (Executes Soroban smart contract)
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contract** | Rust, Soroban SDK v27 |
| **Target** | wasm32-unknown-unknown |
| **Network** | Stellar Testnet |
| **Wallet** | Freighter (Browser Extension) |
| **CLI** | Stellar CLI |

---

## Features

### Smart Contract (`AuctionHouse`)
- **Create Auction** - Launch auctions with title, starting bid, minimum increment, and duration (1 min - 30 days)
- **Place Bid** - On-chain bidding with automatic highest bidder tracking
- **Anti-Snipe Protection** - If a bid arrives within the last 5 minutes, the auction extends by 10 minutes
- **Settle Auction** - After auction ends, settle to determine winner
- **Cancel Auction** - Seller can cancel their auction
- **View Auction** - Get full auction details on-chain

---

## Project Structure

```
contracts/auction/
├── Cargo.toml          # Soroban contract dependencies
└── src/
    ├── lib.rs          # Contract implementation
    └── tests.rs        # Unit tests (6 tests)
```

---

## Setup & Deployment

### Prerequisites
- Rust (via [rustup.rs](https://rustup.rs/))
- Stellar CLI (`cargo install --locked stellar-cli`)
- Freighter Wallet (browser extension, set to Testnet)

### 1. Install WASM Target
```bash
rustup target add wasm32v1-none
```

### 2. Build Contract
```bash
cargo build --target wasm32v1-none --release
```

Or using Make:
```bash
make build
```

### 3. Run Tests
```bash
cargo test
```

Or using Make:
```bash
make test
```

### 4. Deploy to Testnet

**Create identity (first time only):**
```bash
stellar keys generate --global my-key --network testnet
stellar keys address my-key
```

**Fund your account:**
```bash
stellar keys fund my-key --network testnet
```

**Deploy contract:**
```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/soroban_auction_contract.wasm \
  --source my-key \
  --network testnet
```

Copy the **Contract ID** (starts with `C...`) from the output.

### 5. Verify on Stellar Expert
```
https://stellar.expert/explorer/testnet/contract/<YOUR_CONTRACT_ID>
```

---

## Smart Contract Functions

| Function | Description |
|----------|-------------|
| `create_auction()` | Create a new auction with title, starting bid, and duration |
| `place_bid()` | Place a bid on an active auction |
| `settle_auction()` | Settle an ended auction |
| `cancel_auction()` | Cancel an auction (seller only) |
| `get_auction()` | Get auction details |
| `get_auction_count()` | Get total number of auctions |
| `get_bid_amount()` | Get bid amount for a specific bidder |

---

## Error Codes

| Error | Code | Description |
|-------|------|-------------|
| `InvalidDuration` | 1 | Duration must be 1 min - 30 days |
| `InvalidBidAmount` | 2 | Starting bid and increment must be > 0 |
| `AuctionNotFound` | 3 | Auction does not exist |
| `AuctionNotActive` | 4 | Auction is not currently active |
| `AuctionAlreadySettled` | 5 | Auction has already been settled |
| `AuctionWasCancelled` | 6 | Auction was cancelled |
| `BidTooLow` | 7 | Bid is below minimum required |
| `AlreadyHighestBidder` | 8 | You are already the highest bidder |
| `NotSeller` | 9 | Only seller can perform this action |
| `AuctionStillActive` | 10 | Auction has not ended yet |

---

## Test Results
<img width="1464" height="882" alt="Screenshot 2026-07-20 at 10 29 39 AM" src="https://github.com/user-attachments/assets/4fcd09e1-1bbe-47ff-9408-45a5a4af6c8d" />
<img width="1454" height="915" alt="Screenshot 2026-07-20 at 10 29 55 AM" src="https://github.com/user-attachments/assets/0fdda541-93fa-45ac-ae8a-7a57dd6ae770" />


```
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

### Test Coverage
| Test | Description |
|------|-------------|
| `test_create_auction` | Creates auction and verifies all fields |
| `test_place_bid` | Places bid and verifies highest bidder |
| `test_place_bid_too_low` | Verifies bid below minimum is rejected |
| `test_settle_auction` | Settles auction after end time |
| `test_cancel_auction` | Seller cancels auction |
| `test_invalid_duration` | Verifies invalid duration is rejected |



---

## License

MIT
