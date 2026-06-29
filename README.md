# AuraBid - Decentralized Real-Time Auction Platform

A fully decentralized, real-time bidding auction platform powered by Ethereum smart contracts. Users can create auctions, place bids, settle auctions, and make payments entirely on-chain via MetaMask on the Sepolia testnet. Includes an AI Bidding Agent that can autonomously bid on auctions using configurable strategies.

---

## Architecture

```
User Clicks Button
       |
       v
Frontend JavaScript (Vanilla JS + Ethers.js v6)
       |  (Translates click into a blockchain request)
       v
Wallet Provider (MetaMask Extension)
       |  (Asks user to review gas fees & signs with private key)
       v
Blockchain Network (Sepolia Testnet)
       (Executes AuctionHouse smart contract code)
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contract** | Solidity 0.8.20, OpenZeppelin Contracts v5 (ReentrancyGuard, Ownable) |
| **Contract Tooling** | Hardhat, Hardhat Toolbox |
| **Frontend** | Vanilla JavaScript (SPA), HTML5, CSS3 |
| **Web3 Integration** | Ethers.js v6 (loaded via CDN) |
| **Wallet** | MetaMask (Browser Extension) |
| **Testnet** | Sepolia (Ethereum Testnet) |
| **RPC Provider** | Alchemy |
| **Design** | Cyberpunk theme, CSS Cascade Layers, oklch() colors, Glassmorphism |

---

## Features

### Smart Contract (`AuctionHouse.sol`)
- **Create Auction** - Launch auctions with title, description, starting bid, minimum increment, and duration (1 min - 30 days)
- **Place Bid** - On-chain bidding with automatic refund to previous highest bidder
- **Pay for Auction** - Winner pays via `payForAuction()` to release funds to seller
- **Anti-Snipe Protection** - If a bid arrives within the last 5 minutes, the auction extends by 10 minutes
- **Settle Auction** - Seller claims funds after auction ends
- **Claim Refund** - Non-winners can claim ETH refunds after settlement
- **Cancel Auction** - Seller or contract owner can cancel (refunds all bidders)
- **Reentrancy Protection** - OpenZeppelin `ReentrancyGuard` on all state-changing functions

### Frontend - Auction Arena
- **Dual-Mode Operation** - Full on-chain mode (wallet connected) or demo mode (simulated $5,000 balance)
- **Real-Time Countdown** - 1-second interval timers with anti-snipe visual indicators
- **AI Bot Simulation** - Competitor bots bid realistically in demo mode (disabled when wallet is connected)
- **Wallet Integration** - MetaMask connect/disconnect, balance display, network detection, auto-switch to Sepolia
- **Gas Estimation** - Real-time gas cost display on bid cards
- **Live Activity Feed** - Scrolling event log with timestamps
- **Sound Synthesis** - Web Audio API tones for bid success, outbid, win, and error events
- **Confetti Celebration** - Canvas-based particle system on auction win
- **Toast Notifications** - Animated success/warning/info popups
- **Responsive Design** - Container queries, CSS Grid, dark cyberpunk theme
- **ON-CHAIN Badge** - Visual indicator for on-chain auctions vs demo
- **Bid Confirmation Dialog** - Review bid before MetaMask popup
- **Cancel Auction UI** - Sellers can cancel their auctions with confirmation

### Frontend - Payment Page (`payment.html`)
- **4-Step Progress Indicator** - Visual progress bar: Review → Sign → Broadcast → Confirmed
- **Wallet Balance Display** - Shows current ETH balance before and after payment
- **Gas Estimation** - Real-time gas cost preview before confirming
- **Deduction Summary** - Shows exactly what will be deducted (gas only, bid is already in contract)
- **Success Receipt** - Full receipt with TX hash, Etherscan link, confetti celebration
- **Auto-Redirect** - Winners are automatically redirected to payment page after auction ends

### Transaction History
- **Nav Tab Switching** - Switch between Live Arena and History views
- **Filter Chips** - Filter by: All, Bids, Wins, Refunds, Settlements
- **Summary Cards** - Total Bids, Total Spent, Auctions Won, Refunds Received
- **Transaction List** - Every bid, refund, settlement, and payment with TX hashes and Etherscan links
- **localStorage Persistence** - Transaction history persists across sessions

### AI Bidding Agent
- **5 Strategies** - Conservative, Balanced, Aggressive, Sniper, and Relentless Bot
- **Configurable Controls** - Max bid per auction, total budget, category filter
- **Relentless Bot Mode** - Constant bidding on ALL auctions every 1.5 seconds (100% bid chance)
- **Decision Engine** - Evaluates price, time remaining, competition, and category
- **On-Chain Execution** - Bids placed via MetaMask with gas estimation
- **Activity Log** - Real-time log of all AI decisions and outcomes
- **Budget Limits** - Per-auction max bid and total budget cap
- **Outbid Detection** - AI detects when outbid and considers re-bidding
- **Win Tracking** - Stats track bids placed, auctions won, and total spent
- **Auto-Disconnect** - AI stops when wallet disconnects

---

## Project Structure

```
aurabid/
  index.html              # Single-page HTML shell with nav tabs
  app.js                  # Application logic (2600+ lines)
  index.css               # Full stylesheet (1900+ lines)
  payment.html            # Payment page for auction winners
  payment.js              # Payment logic, MetaMask payForAuction
  hardhat.config.js       # Hardhat configuration with dotenv
  package.json            # NPM manifest
  .env                    # Environment variables (private key, RPC URL)
  .gitignore              # Git ignore rules
  README.md               # Project documentation
  contracts/
    AuctionHouse.sol      # Solidity smart contract
  scripts/
    deploy.js             # Hardhat deployment script
  artifacts/              # Compiled contract ABI + bytecode
```

---

## Setup & Deployment

### Prerequisites
- Node.js (v18+)
- MetaMask browser extension
- Sepolia test ETH ([faucet](https://sepoliafaucet.com))
- Alchemy or Infura account for RPC URL

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file in the project root:
```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_metamask_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### 3. Compile & Deploy
```bash
npm run compile
npm run deploy:sepolia
```

Copy the deployed contract address and paste it into `CONTRACT_ADDRESS` in `app.js`.

### 4. Run Frontend
Open `index.html` in your browser (or use a local server):
```bash
npx serve .
```

### 5. Connect & Bid
1. Open the app in your browser
2. Click **Connect Wallet** - MetaMask will prompt to switch to Sepolia
3. Place bids - MetaMask shows gas fees and asks for signature
4. Transaction executes on Sepolia testnet
5. Win an auction → auto-redirect to payment page → confirm payment → receipt

---

## Smart Contract Details

**Contract:** `AuctionHouse.sol`
**Deployed Address:** `0xa9BdA562AAa4cC8E73b7Cb7600A89fAAA584Effb`
**Network:** Sepolia Testnet (Chain ID: 11155111)
**Compiler:** Solidity 0.8.20 (Optimizer enabled, 200 runs)

### Key Functions
| Function | Description |
|----------|-------------|
| `createAuction()` | Create a new auction (on-chain) |
| `placeBid(auctionId)` | Place a payable bid (auto-refunds previous bidder) |
| `payForAuction(auctionId)` | Winner pays to release funds to seller |
| `settleAuction(auctionId)` | Settle ended auction, transfer funds to seller |
| `claimRefund(auctionId)` | Claim refund for non-winning bids |
| `cancelAuction(auctionId)` | Cancel auction, refund all bidders |
| `getAuction(auctionId)` | View auction details |
| `getAuctionCount()` | Get total number of auctions |
| `getAuctionBidders(auctionId)` | Get list of bidders for an auction |
| `getBidAmount(auctionId, bidder)` | Get bid amount for a specific bidder |

### Events
| Event | Description |
|-------|-------------|
| `AuctionCreated` | New auction created |
| `BidPlaced` | Bid placed on auction |
| `AuctionExtended` | Anti-snipe timer extension |
| `AuctionSettled` | Auction settled, winner determined |
| `AuctionCancelled` | Auction cancelled |
| `BidRefunded` | ETH refunded to bidder |

---

## How It Works

1. **Create Auction** - User fills the listing form, MetaMask signs the `createAuction` transaction
2. **Browse & Bid** - Users see live auctions with countdown timers. Clicking "Place Bid" triggers MetaMask
3. **MetaMask Review** - Wallet shows gas estimate, transaction details, and asks for signature
4. **On-Chain Execution** - Transaction is broadcast to Sepolia, the smart contract validates and executes
5. **Real-Time Updates** - Frontend polls contract state every 30 seconds and listens for events
6. **AI Bidding** - Toggle AI agent to automatically bid on auctions using configured strategy
7. **Win & Pay** - After winning, auto-redirect to payment page, confirm payment, receive receipt
8. **Settlement** - After auction ends, seller calls `settleAuction` to claim funds

---

## AI Bidding Strategies

| Strategy | Tick Rate | Bid Chance | Behavior |
|----------|-----------|------------|----------|
| Conservative | 5s | 15% | Low risk, targets undervalued items, low competition |
| Balanced | 4s | 35% | Moderate risk/reward, balanced frequency |
| Aggressive | 3s | 60% | High risk, bids often, pays premium |
| Sniper | 2s | 80% | Waits until last 30 seconds, strikes fast |
| **Relentless Bot** | **1.5s** | **100%** | **Constant bidding on ALL auctions. Maximum aggression.** |

### Using the AI Agent
1. Connect wallet (required for on-chain bidding)
2. Set **Max Bid per Auction** (default: $500)
3. Set **Total Budget** (default: $2,000)
4. Select strategy from dropdown
5. Toggle **Agent Status** ON
6. Monitor activity log for real-time decisions

---

## License

MIT
