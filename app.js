// AuraBid Application Logic - Single Page Application Core

// 0. Text Sanitization Utilities (XSS Prevention)
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeInput(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}

// 1. Initial State Data
const PRESETS = {
  'gradient-1': 'linear-gradient(135deg, oklch(0.62 0.22 285) 0%, oklch(0.72 0.19 195) 100%)', // Violet to Cyan
  'gradient-2': 'linear-gradient(135deg, oklch(0.65 0.24 350) 0%, oklch(0.78 0.18 55) 100%)',  // Rose to Gold
  'gradient-3': 'linear-gradient(135deg, oklch(0.55 0.2 140) 0%, oklch(0.75 0.15 190) 100%)',  // Emerald to Teal
  'gradient-4': 'linear-gradient(135deg, oklch(0.6 0.22 20) 0%, oklch(0.5 0.2 300) 100%)'     // Coral to Magenta
};

const BOT_NAMES = ['PixelPioneer', 'CyberViper', 'BitSlayer', 'AdaCrypto', 'HackerMax', 'NeonQueen', 'AlphaByte', 'QuantumRider', 'Decentrol'];

let state = {
  walletBalance: 5000,
  heldEscrows: {}, // Holds escrowed bid amounts: { auctionId: amount }
  soundEnabled: true,
  activeCategory: 'all',
  searchQuery: '',
  // Web3 Wallet State
  web3: {
    connected: false,
    address: null,
    chainId: null,
    chainName: 'Unknown',
    balanceWei: '0',
    balanceEth: '0.0',
    balanceUsd: 0,
    ethPrice: 2500, // Simulated ETH/USD rate (updated on connect)
    provider: null,
    signer: null,
    contract: null, // AuctionHouse contract instance
    contractReady: false // Whether contract is initialized
  },
  auctions: [
    {
      id: 'auc-1',
      title: 'Cyberpunk Katana Node',
      description: 'Hand-crafted digital katana forged with custom luminescent subroutines. Legendary grade collectibles asset.',
      category: 'collectibles',
      gradientKey: 'gradient-1',
      currentBid: 450,
      minIncrement: 25,
      timeLeft: 80,
      duration: 120,
      owner: 'System',
      status: 'active',
      bids: [
        { bidder: 'CyberViper', amount: 450, time: '2 mins ago' },
        { bidder: 'BitSlayer', amount: 400, time: '5 mins ago' }
      ]
    },
    {
      id: 'auc-2',
      title: 'Quantum CPU Emulator v2.0',
      description: 'Fully responsive virtualized quantum simulator. Runs 128 virtual qubits locally inside your browser container.',
      category: 'tech',
      gradientKey: 'gradient-2',
      currentBid: 1200,
      minIncrement: 50,
      timeLeft: 145,
      duration: 180,
      owner: 'System',
      status: 'active',
      bids: [
        { bidder: 'PixelPioneer', amount: 1200, time: '1 min ago' },
        { bidder: 'AdaCrypto', amount: 1100, time: '3 mins ago' }
      ]
    },
    {
      id: 'auc-3',
      title: 'Neural Synth: Dreamscape',
      description: 'Dynamic neural network generated artwork. Self-modifying colors based on current market indices.',
      category: 'art',
      gradientKey: 'gradient-3',
      currentBid: 600,
      minIncrement: 20,
      timeLeft: 210,
      duration: 240,
      owner: 'System',
      status: 'active',
      bids: [
        { bidder: 'HackerMax', amount: 600, time: '30s ago' },
        { bidder: 'NeonQueen', amount: 550, time: '4 mins ago' }
      ]
    },
    {
      id: 'auc-4',
      title: 'Glow-Thread Cyber Kimono',
      description: 'Augmented reality physical/digital fashion garment. Includes light emission chips mapping to ambient bass.',
      category: 'fashion',
      gradientKey: 'gradient-4',
      currentBid: 320,
      minIncrement: 15,
      timeLeft: 40,
      duration: 90,
      owner: 'System',
      status: 'active',
      bids: [
        { bidder: 'AlphaByte', amount: 320, time: '10s ago' },
        { bidder: 'QuantumRider', amount: 300, time: '1 min ago' }
      ]
    }
  ]
};

// 2. Audio Synthesis Engine (Web Audio API)
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playTone(frequency, type, duration, delay = 0) {
  if (!state.soundEnabled) return;
  initAudio();

  setTimeout(() => {
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context playback failed", e);
    }
  }, delay);
}

// Custom synthesized notifications
function playSoundBidSuccess() {
  playTone(523.25, 'sine', 0.1); // C5
  playTone(659.25, 'sine', 0.15, 60); // E5
}

function playSoundOutbid() {
  playTone(392.00, 'triangle', 0.15); // G4
  playTone(311.13, 'triangle', 0.2, 80); // Eb4
}

function playSoundWin() {
  playTone(523.25, 'triangle', 0.1); // C5
  playTone(659.25, 'triangle', 0.1, 80); // E5
  playTone(783.99, 'triangle', 0.1, 160); // G5
  playTone(1046.50, 'sine', 0.45, 240); // C6
}

function playSoundError() {
  playTone(180, 'sawtooth', 0.25); // Low buzzing node
}

// 2.5 Web3 Blockchain Wallet Integration Module

// ===================== SMART CONTRACT CONFIGURATION =====================
// Deploy the contract first, then paste your contract address here.
// Run: npm run compile && npm run deploy:sepolia
const CONTRACT_ADDRESS = "0x873DB75eCeA244e29eCc0fdD1A916183E6dc7Fb2";

const CONTRACT_ABI = [
  { "type": "constructor", "inputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "createAuction", "inputs": [{ "name": "_title", "type": "string" }, { "name": "_description", "type": "string" }, { "name": "_startingBid", "type": "uint256" }, { "name": "_minimumIncrement", "type": "uint256" }, { "name": "_duration", "type": "uint256" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "nonpayable" },
  { "type": "function", "name": "placeBid", "inputs": [{ "name": "_auctionId", "type": "uint256" }], "outputs": [], "stateMutability": "payable" },
  { "type": "function", "name": "settleAuction", "inputs": [{ "name": "_auctionId", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "claimRefund", "inputs": [{ "name": "_auctionId", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "cancelAuction", "inputs": [{ "name": "_auctionId", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "getAuction", "inputs": [{ "name": "_auctionId", "type": "uint256" }], "outputs": [{ "name": "", "type": "tuple", "components": [{ "name": "id", "type": "uint256" }, { "name": "seller", "type": "address" }, { "name": "title", "type": "string" }, { "name": "description", "type": "string" }, { "name": "startingBid", "type": "uint256" }, { "name": "minimumIncrement", "type": "uint256" }, { "name": "startTime", "type": "uint256" }, { "name": "endTime", "type": "uint256" }, { "name": "highestBid", "type": "uint256" }, { "name": "highestBidder", "type": "address" }, { "name": "settled", "type": "bool" }, { "name": "cancelled", "type": "bool" }, { "name": "totalBids", "type": "uint256" }] }], "stateMutability": "view" },
  { "type": "function", "name": "getAuctionBidders", "inputs": [{ "name": "_auctionId", "type": "uint256" }], "outputs": [{ "name": "", "type": "address[]" }], "stateMutability": "view" },
  { "type": "function", "name": "getBidAmount", "inputs": [{ "name": "_auctionId", "type": "uint256" }, { "name": "_bidder", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "getAuctionCount", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "getContractBalance", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },

  { "type": "event", "name": "AuctionCreated", "inputs": [{ "name": "auctionId", "type": "uint256", "indexed": true }, { "name": "seller", "type": "address", "indexed": true }, { "name": "title", "type": "string", "indexed": false }, { "name": "startingBid", "type": "uint256", "indexed": false }, { "name": "minimumIncrement", "type": "uint256", "indexed": false }, { "name": "startTime", "type": "uint256", "indexed": false }, { "name": "endTime", "type": "uint256", "indexed": false }] },
  { "type": "event", "name": "BidPlaced", "inputs": [{ "name": "auctionId", "type": "uint256", "indexed": true }, { "name": "bidder", "type": "address", "indexed": true }, { "name": "amount", "type": "uint256", "indexed": false }, { "name": "newEndTime", "type": "uint256", "indexed": false }] },
  { "type": "event", "name": "AuctionExtended", "inputs": [{ "name": "auctionId", "type": "uint256", "indexed": true }, { "name": "newEndTime", "type": "uint256", "indexed": false }] },
  { "type": "event", "name": "AuctionSettled", "inputs": [{ "name": "auctionId", "type": "uint256", "indexed": true }, { "name": "winner", "type": "address", "indexed": true }, { "name": "winningBid", "type": "uint256", "indexed": false }] },
  { "type": "event", "name": "AuctionCancelled", "inputs": [{ "name": "auctionId", "type": "uint256", "indexed": true }] },
  { "type": "event", "name": "BidRefunded", "inputs": [{ "name": "auctionId", "type": "uint256", "indexed": true }, { "name": "bidder", "type": "address", "indexed": true }, { "name": "amount", "type": "uint256", "indexed": false }] },
  { "type": "error", "name": "InvalidDuration", "inputs": [] },
  { "type": "error", "name": "InvalidBidAmount", "inputs": [] },
  { "type": "error", "name": "AuctionNotActive", "inputs": [] },
  { "type": "error", "name": "AuctionAlreadySettled", "inputs": [] },
  { "type": "error", "name": "AuctionWasCancelled", "inputs": [] },
  { "type": "error", "name": "BidTooLow", "inputs": [] },
  { "type": "error", "name": "NoBidsToRefund", "inputs": [] },
  { "type": "error", "name": "AlreadyHighestBidder", "inputs": [] },
  { "type": "error", "name": "NotSeller", "inputs": [] },
  { "type": "error", "name": "AuctionStillActive", "inputs": [] },
  { "type": "error", "name": "TransferFailed", "inputs": [] }
];

const CHAIN_MAP = {
  '0x1': { name: 'Ethereum', symbol: 'ETH', color: '#627eea' },
  '0x89': { name: 'Polygon', symbol: 'MATIC', color: '#8247e5' },
  '0xa86a': { name: 'Avalanche', symbol: 'AVAX', color: '#e84142' },
  '0xa4b1': { name: 'Arbitrum', symbol: 'ETH', color: '#28a0f0' },
  '0xa': { name: 'Optimism', symbol: 'ETH', color: '#ff0420' },
  '0x38': { name: 'BSC', symbol: 'BNB', color: '#f3ba2f' },
  '0xaa36a7': { name: 'Sepolia', symbol: 'sETH', color: '#cfd8e3' },
  '0x5': { name: 'Goerli', symbol: 'gETH', color: '#f6c343' }
};

function truncateAddress(addr) {
  if (!addr) return '0x0000…0000';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

async function fetchEthPrice() {
  // Try to fetch a real ETH price; fall back to simulated value
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    if (res.ok) {
      const data = await res.json();
      if (data?.ethereum?.usd) {
        state.web3.ethPrice = data.ethereum.usd;
        return;
      }
    }
  } catch (e) {
    // Silently fall back to default
  }
  // Simulated fallback
  state.web3.ethPrice = 2500 + Math.floor(Math.random() * 200 - 100);
}

async function refreshWalletBalance() {
  if (!state.web3.connected || !state.web3.address) return;
  try {
    const provider = state.web3.provider;
    const balWei = await provider.getBalance(state.web3.address);
    state.web3.balanceWei = balWei.toString();
    state.web3.balanceEth = parseFloat(ethers.formatEther(balWei)).toFixed(4);
    state.web3.balanceUsd = Math.round(parseFloat(state.web3.balanceEth) * state.web3.ethPrice);
    state.walletBalance = state.web3.balanceUsd; // Sync for bidding system
    updateWalletUI();
  } catch (e) {
    console.warn('Balance fetch failed:', e);
  }
}

function detectChain(chainIdHex) {
  const info = CHAIN_MAP[chainIdHex] || { name: `Chain ${parseInt(chainIdHex, 16)}`, symbol: 'ETH', color: '#999' };
  state.web3.chainId = chainIdHex;
  state.web3.chainName = info.name;

  const networkBadge = document.getElementById('network-badge');
  const networkName = document.getElementById('network-name');
  if (networkName) networkName.textContent = info.name;
  if (networkBadge) {
    networkBadge.style.color = info.color;
    networkBadge.style.borderColor = info.color + '33';
    networkBadge.style.background = info.color + '18';
    const dot = networkBadge.querySelector('.network-dot');
    if (dot) {
      dot.style.background = info.color;
      dot.style.boxShadow = `0 0 6px ${info.color}`;
    }
  }
}

async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    showToast('No Wallet Detected', 'Install MetaMask or another Web3 wallet extension to connect.', 'warning');
    playSoundError();
    return;
  }

  try {
    const connectBtn = document.getElementById('connect-wallet-btn');
    const connectText = document.getElementById('connect-wallet-text');
    connectText.textContent = 'Connecting...';
    connectBtn.disabled = true;

    // Request account access
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned');
    }

    // Set up ethers.js provider
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const network = await provider.getNetwork();
    const chainIdHex = '0x' + network.chainId.toString(16);

    // Store in state
    state.web3.connected = true;
    state.web3.address = address;
    state.web3.provider = provider;
    state.web3.signer = signer;

    // Initialize smart contract instance
    if (CONTRACT_ADDRESS && CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
      try {
        state.web3.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        state.web3.contractReady = true;
        setupContractEventListeners();
        logActivity("📜 Smart contract connected. On-chain bidding enabled.", "general");
      } catch (e) {
        console.warn("Contract init failed:", e);
        state.web3.contractReady = false;
        logActivity("⚠️ Smart contract not available. Using demo mode.", "general");
      }
    } else {
      state.web3.contractReady = false;
      logActivity("⚠️ No contract address configured. Using demo bidding mode.", "general");
    }

    // Detect chain
    detectChain(chainIdHex);

    // Prompt switch to Sepolia if on wrong network (only when contract is deployed)
    const SEPOLIA_CHAIN_ID = '0xaa36a7';
    if (CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000" && chainIdHex !== SEPOLIA_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: SEPOLIA_CHAIN_ID }]
        });
        // Re-init provider after chain switch
        const newProvider = new ethers.BrowserProvider(window.ethereum);
        state.web3.provider = newProvider;
        state.web3.signer = await newProvider.getSigner();
        const newNetwork = await newProvider.getNetwork();
        detectChain('0x' + newNetwork.chainId.toString(16));
      } catch (switchErr) {
        // If chain not added, try to add it
        if (switchErr.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: SEPOLIA_CHAIN_ID,
                chainName: 'Sepolia Testnet',
                nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://rpc.sepolia.org'],
                blockExplorerUrls: ['https://sepolia.etherscan.io']
              }]
            });
          } catch (addErr) {
            showToast('Network Error', 'Could not add Sepolia network to MetaMask.', 'warning');
          }
        } else if (switchErr.code !== 4001) {
          showToast('Wrong Network', `Please switch to Sepolia testnet in MetaMask.`, 'warning');
        }
      }
    }

    // Fetch price & balance
    await fetchEthPrice();
    await refreshWalletBalance();

    // Update UI: Hide connect button, show HUD
    connectBtn.style.display = 'none';
    document.getElementById('wallet-hud').style.display = 'flex';
    const addrEl = document.getElementById('wallet-address');
    if (addrEl) {
      addrEl.textContent = truncateAddress(address);
      addrEl.title = address;
    }

    updateWalletUI();
    playSoundBidSuccess();
    showToast('Wallet Connected!', `Connected to ${truncateAddress(address)} on ${state.web3.chainName}`, 'success');
    logActivity(`🔗 Wallet connected: ${truncateAddress(address)} on ${state.web3.chainName}`, 'general');

    // Start balance polling every 15 seconds
    if (window._balancePollInterval) clearInterval(window._balancePollInterval);
    window._balancePollInterval = setInterval(refreshWalletBalance, 15000);

  } catch (err) {
    console.error('Wallet connection failed:', err);
    const connectBtn = document.getElementById('connect-wallet-btn');
    const connectText = document.getElementById('connect-wallet-text');
    connectText.textContent = 'Connect Wallet';
    connectBtn.disabled = false;

    if (err.code === 4001) {
      showToast('Connection Rejected', 'You rejected the wallet connection request.', 'warning');
    } else {
      showToast('Connection Failed', err.message || 'Could not connect to wallet.', 'warning');
    }
    playSoundError();
  }
}

function disconnectWallet() {
  // Remove contract event listeners
  if (state.web3.contract) {
    state.web3.contract.removeAllListeners();
  }

  state.web3.connected = false;
  state.web3.address = null;
  state.web3.provider = null;
  state.web3.signer = null;
  state.web3.contract = null;
  state.web3.contractReady = false;
  state.web3.balanceEth = '0.0';
  state.web3.balanceUsd = 0;
  state.walletBalance = 5000; // Revert to demo balance

  if (window._balancePollInterval) {
    clearInterval(window._balancePollInterval);
    window._balancePollInterval = null;
  }

  // UI: show connect button, hide HUD
  document.getElementById('connect-wallet-btn').style.display = 'inline-flex';
  document.getElementById('connect-wallet-btn').disabled = false;
  document.getElementById('connect-wallet-text').textContent = 'Connect Wallet';
  document.getElementById('wallet-hud').style.display = 'none';

  updateWalletUI();
  showToast('Wallet Disconnected', 'Reverted to demo mode with $5,000 credits.', 'info');
  logActivity('🔌 Wallet disconnected. Using demo balance.', 'general');
}

function setupEthereumListeners() {
  if (typeof window.ethereum === 'undefined') return;

  window.ethereum.on('accountsChanged', async (accounts) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else if (state.web3.connected) {
      state.web3.address = accounts[0];
      const provider = new ethers.BrowserProvider(window.ethereum);
      state.web3.provider = provider;
      state.web3.signer = await provider.getSigner();

      const addrEl = document.getElementById('wallet-address');
      if (addrEl) {
        addrEl.textContent = truncateAddress(accounts[0]);
        addrEl.title = accounts[0];
      }

      await refreshWalletBalance();
      showToast('Account Switched', `Now using ${truncateAddress(accounts[0])}`, 'info');
      logActivity(`🔄 Wallet account switched to ${truncateAddress(accounts[0])}`, 'general');
    }
  });

  window.ethereum.on('chainChanged', async (chainIdHex) => {
    if (!state.web3.connected) return;
    detectChain(chainIdHex);

    // Re-init provider for new chain
    const provider = new ethers.BrowserProvider(window.ethereum);
    state.web3.provider = provider;
    state.web3.signer = await provider.getSigner();

    await fetchEthPrice();
    await refreshWalletBalance();
    showToast('Network Changed', `Switched to ${state.web3.chainName}`, 'info');
    logActivity(`⛓️ Network changed to ${state.web3.chainName}`, 'general');
  });
}

function usdToEth(usdAmount) {
  if (!state.web3.ethPrice || state.web3.ethPrice === 0) return '0.0000';
  return (usdAmount / state.web3.ethPrice).toFixed(4);
}

// 3. Canvas Confetti Particle System
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
let confettiActive = false;
let confettiParticles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class ConfettiParticle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * -canvas.height - 20;
    this.size = Math.random() * 8 + 6;
    this.color = ['#2ec4b6', '#ff9f1c', '#e63946', '#9d4ede', '#e0aaff'][Math.floor(Math.random() * 5)];
    this.speedX = Math.random() * 4 - 2;
    this.speedY = Math.random() * 6 + 4;
    this.rotation = Math.random() * 360;
    this.spin = Math.random() * 4 - 2;
  }

  update() {
    this.x += this.x > canvas.width || this.x < 0 ? -this.speedX : this.speedX;
    this.y += this.speedY;
    this.rotation += this.spin;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * Math.PI / 180);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

function triggerConfetti() {
  confettiActive = true;
  confettiParticles = [];
  for (let i = 0; i < 150; i++) {
    confettiParticles.push(new ConfettiParticle());
  }

  function loop() {
    if (!confettiActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let activeParticles = 0;
    confettiParticles.forEach(p => {
      p.update();
      p.draw();
      if (p.y < canvas.height) activeParticles++;
    });

    if (activeParticles > 0) {
      requestAnimationFrame(loop);
    } else {
      confettiActive = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  loop();
}

// 4. Toast Notification Manager
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = '🔔';
  if (type === 'success') icon = '🏆';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-msg">${escapeHtml(message)}</div>
    </div>
    <span class="toast-close" role="button" aria-label="Close Toast">&times;</span>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  });

  container.appendChild(toast);

  // Limit visible toasts to 3
  const toasts = container.querySelectorAll('.toast');
  if (toasts.length > 3) {
    toasts[0].style.opacity = '0';
    toasts[0].style.transform = 'translateX(120%) scale(0.9)';
    setTimeout(() => toasts[0].remove(), 300);
  }

  // Auto remove toast
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(120%) scale(0.9)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4500);
}
  }, 4500);
}

// 5. Live Activity Feed Logger
function logActivity(text, type = 'general') {
  const feed = document.getElementById('activity-feed');
  const item = document.createElement('div');
  item.className = `activity-item ${type}-event`;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  item.innerHTML = `
    <span>${text}</span>
    <span class="activity-time">${escapeHtml(timeStr)}</span>
  `;

  feed.prepend(item);

  // Limit to 40 items for rendering performance
  if (feed.childNodes.length > 40) {
    feed.lastChild.remove();
  }
}

// 6. Wallet HUD Helper
function updateWalletUI(actionType) {
  const amountSpan = document.getElementById('wallet-amount');
  const hud = document.getElementById('wallet-hud');

  if (state.web3.connected) {
    // Web3 mode: show ETH balance + USD estimate
    if (amountSpan) amountSpan.textContent = `${state.web3.balanceEth} ETH`;
    const usdSpan = document.getElementById('wallet-usd');
    if (usdSpan) usdSpan.textContent = `≈ $${state.web3.balanceUsd.toLocaleString()}`;
  } else {
    // Demo mode: show USD
    if (amountSpan) amountSpan.textContent = `$${state.walletBalance.toLocaleString()}`;
    const usdSpan = document.getElementById('wallet-usd');
    if (usdSpan) usdSpan.textContent = '';
  }

  // Flash effect
  if (hud) {
    hud.classList.remove('flash-deduct', 'flash-refund');
    void hud.offsetWidth; // Trigger reflow

    if (actionType === 'deduct') {
      hud.classList.add('flash-deduct');
    } else if (actionType === 'refund') {
      hud.classList.add('flash-refund');
    }
  }
}

// 7. Core Bidding Logical Handler
async function placeBid(auctionId, bidAmount) {
  const item = state.auctions.find(a => a.id === auctionId);
  if (!item || item.status !== 'active') {
    showToast("Bid Failed", "This auction has ended or is unavailable.", "warning");
    playSoundError();
    return false;
  }

  const incrementedTarget = item.currentBid + item.minIncrement;
  if (bidAmount < incrementedTarget) {
    showToast("Invalid Bid", `Bid must be at least $${incrementedTarget.toLocaleString()}.`, "warning");
    playSoundError();
    return false;
  }

  // ========== ON-CHAIN BIDDING ==========
  if (item.onChainId !== undefined) {
    if (!state.web3.connected || !state.web3.contractReady) {
      showToast("Wallet Required", "Connect your Web3 wallet to place on-chain bids.", "warning");
      playSoundError();
      return false;
    }
    return await placeBidOnChain(item, bidAmount);
  }

  // ========== DEMO MODE BIDDING ==========
  return placeBidDemo(item, bidAmount);
}

// On-chain bid via smart contract
async function placeBidOnChain(item, bidAmount) {
  const contract = state.web3.contract;
  const bidWei = ethers.parseEther(usdToEth(bidAmount));

  // Estimate gas first
  let gasEstimate;
  try {
    gasEstimate = await contract.placeBid.estimateGas(item.onChainId, { value: bidWei });
  } catch (e) {
    const reason = parseContractError(e);
    showToast("Bid Rejected", reason, "warning");
    playSoundError();
    return false;
  }

  // Show pending state
  const pendingToastId = showPendingToast("Confirm in MetaMask", "Review the transaction in your wallet...");
  setCardTxOverlay(item.id, true, 'Waiting for wallet signature...');

  try {
    showTxPending(true);
    const tx = await contract.placeBid(item.onChainId, { value: bidWei });

    updatePendingToast(pendingToastId, "Transaction Submitted", "Waiting for blockchain confirmation...", 'info', tx.hash);
    setCardTxOverlay(item.id, true, `TX: ${tx.hash.slice(0, 10)}... Broadcast to network`);
    logActivity(`📡 TX sent: ${tx.hash.slice(0, 10)}...`, 'bid');

    const receipt = await tx.wait();

    // Check for auction extension
    const extendedEvent = receipt.logs.find(
      log => log.fragment && log.fragment.name === 'AuctionExtended'
    );

    updatePendingToast(pendingToastId, "Bid Placed on-chain!", `Confirmed in block ${receipt.blockNumber}`, 'success', tx.hash);
    updateTxStatusBar('confirmed', `Bid confirmed in block #${receipt.blockNumber}`, tx.hash);
    setCardTxOverlay(item.id, false);
    showTxPending(false);
    playSoundBidSuccess();

    const ethEquiv = usdToEth(bidAmount);
    showToast("Bid Placed!", `You are now the high bidder for "${item.title}" at $${bidAmount.toLocaleString()} (≈ ${ethEquiv} ETH)`, "success");
    logActivity(`👤 You bid $${bidAmount.toLocaleString()} (${ethEquiv} ETH) on "${item.title}"`, 'bid');

    if (extendedEvent) {
      showToast("Timer Extended!", "Anti-sniping protection activated!", "info");
      logActivity(`⏰ Auction extended for "${item.title}"`, 'listing');
    }

    // Update local state from contract
    await syncSingleAuction(item.onChainId);
    updateWalletUI('deduct');
    updateSingleAuctionCard(item);
    updateStatsSidebar();
    syncScreenReaderTable();
    return true;

  } catch (e) {
    showTxPending(false);
    removePendingToast(pendingToastId);
    setCardTxOverlay(item.id, false);
    const reason = parseContractError(e);

    if (e?.message?.includes('user rejected') || e?.code === 4001) {
      updateTxStatusBar('rejected', 'Transaction rejected by user');
      showToast("Bid Cancelled", "You rejected the transaction in MetaMask.", "warning");
    } else {
      updateTxStatusBar('failed', `Transaction failed: ${reason}`);
      showToast("Bid Failed", reason, "warning");
    }
    playSoundError();
    return false;
  }
}

// Demo mode bid (local simulation)
function placeBidDemo(item, bidAmount) {
  const userPreviousBid = state.heldEscrows[item.id] || 0;
  const netRequired = bidAmount - userPreviousBid;

  if (state.walletBalance < netRequired) {
    showToast("Insufficient Balance", `You need $${netRequired.toLocaleString()} more in your wallet to cover this bid.`, "warning");
    playSoundError();
    return false;
  }

  // Escrow Lock
  state.walletBalance -= netRequired;
  state.heldEscrows[item.id] = bidAmount;

  const wasUserWinning = item.bids.length > 0 && item.bids[0].bidder === 'You';

  item.currentBid = bidAmount;
  item.bids.unshift({
    bidder: 'You',
    amount: bidAmount,
    time: 'Just now'
  });

  if (item.timeLeft < 10) {
    item.timeLeft = 10;
    logActivity(`⏰ Auction timer extended for "${item.title}"! (Anti-Sniping)`, 'listing');
    showToast("Timer Extended!", "Sniping protection activated! 10 seconds added to the timer.", "info");
  }

  updateWalletUI('deduct');
  playSoundBidSuccess();
  showToast("Bid Placed!", `You are now the high bidder for "${item.title}" at $${bidAmount.toLocaleString()}`, "success");
  logActivity(`👤 You bid $${bidAmount.toLocaleString()} on "${item.title}"`, 'bid');

  updateSingleAuctionCard(item);
  updateStatsSidebar();
  syncScreenReaderTable();
  return true;
}

// ========== TRANSACTION HELPERS ==========

function parseContractError(e) {
  if (e?.reason) return e.reason;
  if (e?.data?.message) return e.data.message;
  if (e?.message?.includes('user rejected')) return "Transaction rejected by user.";
  if (e?.message?.includes('insufficient funds')) return "Insufficient ETH for this transaction.";
  const msg = e?.message || 'Unknown error';
  if (msg.length > 120) return msg.slice(0, 120) + '...';
  return msg;
}

let _pendingToastCounter = 0;

function etherscanTxLink(txHash) {
  if (!txHash) return '';
  const base = state.web3.chainId === '0xaa36a7'
    ? 'https://sepolia.etherscan.io'
    : 'https://etherscan.io';
  return `${base}/tx/${txHash}`;
}

function showPendingToast(title, message) {
  const id = `pending-toast-${++_pendingToastCounter}`;
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast info tx-pending-toast';
  toast.id = id;
  toast.innerHTML = `
    <span class="toast-icon"><span class="tx-spinner"></span></span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
  `;
  container.appendChild(toast);
  return id;
}

function updatePendingToast(id, title, message, type, txHash) {
  const toast = document.getElementById(id);
  if (!toast) return;
  if (type) toast.className = `toast ${type}`;
  const titleEl = toast.querySelector('.toast-title');
  const msgEl = toast.querySelector('.toast-msg');
  const iconEl = toast.querySelector('.toast-icon');

  if (titleEl) titleEl.textContent = escapeHtml(title);

  // Build message with TX hash + Etherscan link
  let msgHtml = message;
  if (txHash) {
    const shortHash = txHash.slice(0, 10) + '...' + txHash.slice(-6);
    const link = etherscanTxLink(txHash);
    msgHtml += `<br><a href="${link}" target="_blank" rel="noopener" class="tx-etherscan-link">${shortHash} ↗ View on Etherscan</a>`;
  }
  if (msgEl) msgEl.innerHTML = msgHtml;

  if (iconEl && type === 'success') iconEl.innerHTML = '✅';
  if (iconEl && type === 'warning') iconEl.innerHTML = '⚠️';
  if (iconEl && type === 'error') iconEl.innerHTML = '❌';

  // Success/warning toasts stay longer (8s) and are dismissible
  if (type === 'success' || type === 'warning' || type === 'error') {
    toast.classList.add('dismissible');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(120%) scale(0.9)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 8000);
  }
}

function removePendingToast(id) {
  const toast = document.getElementById(id);
  if (toast) {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }
}

function showTxPending(show, txHash) {
  const indicator = document.getElementById('tx-pending-indicator');
  if (indicator) {
    indicator.style.display = show ? 'flex' : 'none';
  }
  // Update the TX status bar
  const statusBar = document.getElementById('tx-status-bar');
  if (statusBar) {
    if (show) {
      statusBar.style.display = 'flex';
      statusBar.className = 'tx-status-bar pending';
      statusBar.innerHTML = `
        <span class="tx-status-spinner"></span>
        <span class="tx-status-text">Transaction pending...</span>
        ${txHash ? `<a href="${etherscanTxLink(txHash)}" target="_blank" rel="noopener" class="tx-status-link">View ↗</a>` : ''}
      `;
    } else {
      statusBar.style.display = 'none';
    }
  }
}

function updateTxStatusBar(status, message, txHash) {
  const statusBar = document.getElementById('tx-status-bar');
  if (!statusBar) return;
  statusBar.style.display = 'flex';

  if (status === 'confirmed') {
    statusBar.className = 'tx-status-bar confirmed';
    statusBar.innerHTML = `
      <span class="tx-status-icon">✅</span>
      <span class="tx-status-text">${message}</span>
      ${txHash ? `<a href="${etherscanTxLink(txHash)}" target="_blank" rel="noopener" class="tx-status-link">View on Etherscan ↗</a>` : ''}
    `;
    setTimeout(() => { statusBar.style.display = 'none'; }, 10000);
  } else if (status === 'failed') {
    statusBar.className = 'tx-status-bar failed';
    statusBar.innerHTML = `
      <span class="tx-status-icon">❌</span>
      <span class="tx-status-text">${message}</span>
    `;
    setTimeout(() => { statusBar.style.display = 'none'; }, 8000);
  } else if (status === 'rejected') {
    statusBar.className = 'tx-status-bar failed';
    statusBar.innerHTML = `
      <span class="tx-status-icon">🚫</span>
      <span class="tx-status-text">${message}</span>
    `;
    setTimeout(() => { statusBar.style.display = 'none'; }, 5000);
  }
}

function setCardTxOverlay(auctionId, show, message) {
  const card = document.getElementById(`card-${auctionId}`);
  if (!card) return;

  // Remove existing overlay
  const existing = card.querySelector('.card-tx-overlay');
  if (existing) existing.remove();

  if (show) {
    const overlay = document.createElement('div');
    overlay.className = 'card-tx-overlay';
    overlay.innerHTML = `
      <div class="card-tx-overlay-content">
        <span class="tx-spinner"></span>
        <span class="card-tx-message">${message || 'Processing transaction...'}</span>
      </div>
    `;
    card.appendChild(overlay);
    card.classList.add('tx-in-progress');
  } else {
    card.classList.remove('tx-in-progress');
  }
}

// ========== ON-CHAIN CANCEL ==========

async function cancelAuctionOnChain(auctionId) {
  if (!state.web3.contractReady) {
    showToast("Not Available", "Smart contract not connected.", "warning");
    return false;
  }

  const pendingId = showPendingToast("Cancelling Auction", "Confirm the cancellation transaction...");
  setCardTxOverlay(`onchain-${auctionId}`, true, 'Waiting for wallet signature...');

  try {
    showTxPending(true);
    const tx = await state.web3.contract.cancelAuction(auctionId);
    updatePendingToast(pendingId, "Cancel Submitted", "Waiting for confirmation...", 'info', tx.hash);
    setCardTxOverlay(`onchain-${auctionId}`, true, `TX: ${tx.hash.slice(0, 10)}... Broadcast to network`);
    const receipt = await tx.wait();
    updatePendingToast(pendingId, "Auction Cancelled!", `Confirmed in block ${receipt.blockNumber}`, 'success', tx.hash);
    updateTxStatusBar('confirmed', `Cancellation confirmed in block #${receipt.blockNumber}`, tx.hash);
    setCardTxOverlay(`onchain-${auctionId}`, false);
    showTxPending(false);
    showToast("Auction Cancelled", "All bidders have been refunded.", "success");
    logActivity(`🚫 Auction #${auctionId} cancelled by seller`, 'general');
    await syncSingleAuction(auctionId);
    return true;
  } catch (e) {
    showTxPending(false);
    removePendingToast(pendingId);
    setCardTxOverlay(`onchain-${auctionId}`, false);
    const reason = parseContractError(e);
    if (e?.message?.includes('user rejected') || e?.code === 4001) {
      updateTxStatusBar('rejected', 'Cancellation rejected by user');
    } else {
      updateTxStatusBar('failed', `Cancellation failed: ${reason}`);
    }
    showToast("Cancel Failed", reason, "warning");
    return false;
  }
}

// ========== ON-CHAIN SETTLEMENT ==========

async function settleAuctionOnChain(auctionId) {
  if (!state.web3.contractReady) {
    showToast("Not Available", "Smart contract not connected.", "warning");
    return false;
  }

  const pendingId = showPendingToast("Settling Auction", "Confirm the settlement transaction...");
  setCardTxOverlay(`onchain-${auctionId}`, true, 'Waiting for wallet signature...');

  try {
    showTxPending(true);
    const tx = await state.web3.contract.settleAuction(auctionId);
    updatePendingToast(pendingId, "Settlement Submitted", "Waiting for confirmation...", 'info', tx.hash);
    setCardTxOverlay(`onchain-${auctionId}`, true, `TX: ${tx.hash.slice(0, 10)}... Broadcast to network`);
    const receipt = await tx.wait();
    updatePendingToast(pendingId, "Auction Settled!", `Confirmed in block ${receipt.blockNumber}`, 'success', tx.hash);
    updateTxStatusBar('confirmed', `Settlement confirmed in block #${receipt.blockNumber}`, tx.hash);
    setCardTxOverlay(`onchain-${auctionId}`, false);
    showTxPending(false);
    playSoundWin();
    showToast("Auction Settled!", "Funds transferred to seller.", "success");
    logActivity(`🏁 Auction #${auctionId} settled on-chain`, 'win');
    return true;
  } catch (e) {
    showTxPending(false);
    removePendingToast(pendingId);
    setCardTxOverlay(`onchain-${auctionId}`, false);
    const reason = parseContractError(e);
    if (e?.message?.includes('user rejected') || e?.code === 4001) {
      updateTxStatusBar('rejected', 'Settlement rejected by user');
    } else {
      updateTxStatusBar('failed', `Settlement failed: ${reason}`);
    }
    showToast("Settlement Failed", reason, "warning");
    return false;
  }
}

async function claimRefundOnChain(auctionId) {
  if (!state.web3.contractReady) {
    showToast("Not Available", "Smart contract not connected.", "warning");
    return false;
  }

  const pendingId = showPendingToast("Claiming Refund", "Confirm the refund transaction...");
  setCardTxOverlay(`onchain-${auctionId}`, true, 'Waiting for wallet signature...');

  try {
    showTxPending(true);
    const tx = await state.web3.contract.claimRefund(auctionId);
    updatePendingToast(pendingId, "Refund Submitted", "Waiting for confirmation...", 'info', tx.hash);
    setCardTxOverlay(`onchain-${auctionId}`, true, `TX: ${tx.hash.slice(0, 10)}... Broadcast to network`);
    const receipt = await tx.wait();
    updatePendingToast(pendingId, "Refund Claimed!", `ETH returned in block ${receipt.blockNumber}`, 'success', tx.hash);
    updateTxStatusBar('confirmed', `Refund confirmed in block #${receipt.blockNumber}`, tx.hash);
    setCardTxOverlay(`onchain-${auctionId}`, false);
    showTxPending(false);
    playSoundBidSuccess();
    showToast("Refund Received!", "ETH has been returned to your wallet.", "success");
    logActivity(`💰 Refund claimed for auction #${auctionId}`, 'general');
    await refreshWalletBalance();
    return true;
  } catch (e) {
    showTxPending(false);
    removePendingToast(pendingId);
    setCardTxOverlay(`onchain-${auctionId}`, false);
    const reason = parseContractError(e);
    if (e?.message?.includes('user rejected') || e?.code === 4001) {
      updateTxStatusBar('rejected', 'Refund rejected by user');
    } else {
      updateTxStatusBar('failed', `Refund failed: ${reason}`);
    }
    showToast("Refund Failed", reason, "warning");
    return false;
  }
}

async function createAuctionOnChain(title, description, startingBid, minIncrement, duration) {
  if (!state.web3.contractReady) {
    showToast("Not Available", "Smart contract not connected. Auction created locally.", "warning");
    return null;
  }

  const startingBidWei = ethers.parseEther(usdToEth(startingBid));
  const minIncrementWei = ethers.parseEther(usdToEth(minIncrement));
  const durationBigInt = BigInt(Math.max(60, duration));

  const pendingId = showPendingToast("Creating Auction", "Confirm the auction creation transaction...");

  try {
    showTxPending(true);
    const tx = await state.web3.contract.createAuction(
      title, description, startingBidWei, minIncrementWei, durationBigInt
    );
    updatePendingToast(pendingId, "Auction Submitted", "Waiting for confirmation...", 'info', tx.hash);
    logActivity(`📡 TX sent: ${tx.hash.slice(0, 10)}...`, 'listing');
    const receipt = await tx.wait();

    const createdEvent = receipt.logs.find(
      log => log.fragment && log.fragment.name === 'AuctionCreated'
    );

    const onChainId = createdEvent ? Number(createdEvent.args.auctionId) : null;
    updatePendingToast(pendingId, "Auction Launched!", `Confirmed in block ${receipt.blockNumber}`, 'success', tx.hash);
    updateTxStatusBar('confirmed', `Auction created in block #${receipt.blockNumber}`, tx.hash);
    showTxPending(false);
    return onChainId;
  } catch (e) {
    showTxPending(false);
    removePendingToast(pendingId);
    const reason = parseContractError(e);
    if (e?.message?.includes('user rejected') || e?.code === 4001) {
      updateTxStatusBar('rejected', 'Auction creation rejected by user');
    } else {
      updateTxStatusBar('failed', `Auction creation failed: ${reason}`);
    }
    showToast("Auction Creation Failed", reason, "warning");
    return null;
  }
}

// ========== ON-CHAIN SYNC ==========

async function syncOnChainAuctions() {
  if (!state.web3.contractReady) return;

  try {
    const count = await state.web3.contract.getAuctionCount();

    for (let i = 0; i < count; i++) {
      await syncSingleAuction(i);
    }
  } catch (e) {
    console.warn('Sync on-chain auctions failed:', e);
  }
}

async function syncSingleAuction(onChainId) {
  if (!state.web3.contractReady) return;

  try {
    const auction = await state.web3.contract.getAuction(onChainId);
    if (auction.seller === ethers.ZeroAddress) return;

    const now = Math.floor(Date.now() / 1000);
    const isActive = !auction.settled && !auction.cancelled && now <= Number(auction.endTime);
    const isEnded = now > Number(auction.endTime) && !auction.settled && !auction.cancelled;

    const ethToUsd = (wei) => {
      const eth = parseFloat(ethers.formatEther(wei));
      return Math.round(eth * state.web3.ethPrice);
    };

    // Find matching local auction or create new one
    let localItem = state.auctions.find(a => a.onChainId === onChainId);

    if (!localItem) {
      localItem = {
        id: `onchain-${onChainId}`,
        onChainId: onChainId,
        title: auction.title,
        description: auction.description,
        category: 'collectibles',
        gradientKey: `gradient-${(onChainId % 4) + 1}`,
        currentBid: ethToUsd(auction.highestBid),
        currentBidWei: auction.highestBid.toString(),
        minIncrement: ethToUsd(auction.minimumIncrement),
        timeLeft: Math.max(0, Number(auction.endTime) - now),
        duration: Math.max(1, Number(auction.endTime) - Number(auction.startTime)),
        owner: auction.seller,
        status: isEnded ? 'ended' : (isActive ? 'active' : 'ended'),
        onChainSeller: auction.seller,
        onChainHighestBidder: auction.highestBidder,
        bids: []
      };
      state.auctions.push(localItem);
    } else {
      localItem.currentBid = ethToUsd(auction.highestBid);
      localItem.currentBidWei = auction.highestBid.toString();
      localItem.timeLeft = Math.max(0, Number(auction.endTime) - now);
      localItem.duration = Math.max(1, Number(auction.endTime) - Number(auction.startTime));
      localItem.status = isEnded ? 'ended' : (isActive ? 'active' : 'ended');
      localItem.onChainHighestBidder = auction.highestBidder;
    }

    // Populate bids from on-chain data
    if (auction.highestBidder !== ethers.ZeroAddress) {
      const bidderLabel = auction.highestBidder.toLowerCase() === state.web3.address?.toLowerCase()
        ? 'You' : truncateAddress(auction.highestBidder);
      const existingHighBid = localItem.bids.length > 0 ? localItem.bids[0] : null;

      if (!existingHighBid || existingHighBid.bidder !== bidderLabel) {
        localItem.bids = [{
          bidder: bidderLabel,
          amount: ethToUsd(auction.highestBid),
          time: 'On-chain'
        }];
      }
    }

    // Also fetch other bidders for richer history
    try {
      const bidders = await state.web3.contract.getAuctionBidders(onChainId);
      const biddersWithAmounts = [];
      for (const addr of bidders) {
        const bidAmount = await state.web3.contract.getBidAmount(onChainId, addr);
        if (bidAmount > 0n) {
          const bidderLabel = addr.toLowerCase() === state.web3.address?.toLowerCase()
            ? 'You' : truncateAddress(addr);
          biddersWithAmounts.push({
            bidder: bidderLabel,
            amount: Math.round(parseFloat(ethers.formatEther(bidAmount)) * state.web3.ethPrice),
            time: 'On-chain'
          });
        }
      }
      // Sort by amount descending
      biddersWithAmounts.sort((a, b) => b.amount - a.amount);
      if (biddersWithAmounts.length > 0) {
        localItem.bids = biddersWithAmounts;
      }
    } catch (e) {
      // Silently fail if bidder fetch fails (non-critical)
    }
  } catch (e) {
    console.warn(`Sync auction ${onChainId} failed:`, e);
  }
}

// ========== CONTRACT EVENT LISTENERS ==========

function setupContractEventListeners() {
  const contract = state.web3.contract;
  if (!contract) return;

  contract.on('BidPlaced', async (auctionId, bidder, amount, newEndTime) => {
    const bidderShort = truncateAddress(bidder);
    const amountUsd = Math.round(parseFloat(ethers.formatEther(amount)) * state.web3.ethPrice);
    const isUserBid = bidder.toLowerCase() === state.web3.address?.toLowerCase();

    logActivity(`🔔 On-chain bid: ${isUserBid ? 'You' : bidderShort} bid $${amountUsd.toLocaleString()} on auction #${auctionId}`, 'bid');

    // Add bid to local history immediately
    const item = state.auctions.find(a => a.onChainId === Number(auctionId));
    if (item) {
      const bidderLabel = isUserBid ? 'You' : bidderShort;
      item.bids.unshift({
        bidder: bidderLabel,
        amount: amountUsd,
        time: 'Just now'
      });
      // Keep only top 10 bids
      if (item.bids.length > 10) item.bids = item.bids.slice(0, 10);
    }

    // Sync the auction from chain
    await syncSingleAuction(Number(auctionId));

    if (item) {
      updateSingleAuctionCard(item);
      updateStatsSidebar();
      syncScreenReaderTable();
    }
  });

  contract.on('AuctionExtended', (auctionId, newEndTime) => {
    logActivity(`⏰ Auction #${auctionId} extended (anti-sniping)`, 'listing');
    const item = state.auctions.find(a => a.onChainId === Number(auctionId));
    if (item) {
      const now = Math.floor(Date.now() / 1000);
      item.timeLeft = Math.max(0, Number(newEndTime) - now);
      updateSingleAuctionCard(item);
    }
  });

  contract.on('AuctionSettled', (auctionId, winner, winningBid) => {
    const winnerShort = truncateAddress(winner);
    const amountUsd = Math.round(parseFloat(ethers.formatEther(winningBid)) * state.web3.ethPrice);
    const isUserWinner = winner.toLowerCase() === state.web3.address?.toLowerCase();

    logActivity(`🏆 Auction #${auctionId} settled! Winner: ${winnerShort} ($${amountUsd.toLocaleString()})`, 'win');

    const item = state.auctions.find(a => a.onChainId === Number(auctionId));
    if (item) {
      item.status = 'ended';
      item.currentBid = amountUsd;

      if (isUserWinner) {
        showToast("YOU WON!", `You won "${item.title}" for $${amountUsd.toLocaleString()}!`, "success");
        playSoundWin();
        triggerConfetti();
      } else {
        showToast("Auction Ended", `"${item.title}" won by ${winnerShort}`, "info");
      }

      updateSingleAuctionCard(item);
      updateStatsSidebar();
      syncScreenReaderTable();
    }
  });

  contract.on('BidRefunded', (auctionId, bidder, amount) => {
    const isUser = bidder.toLowerCase() === state.web3.address?.toLowerCase();
    if (isUser) {
      const amountUsd = Math.round(parseFloat(ethers.formatEther(amount)) * state.web3.ethPrice);
      logActivity(`💰 Refund received: $${amountUsd.toLocaleString()} from auction #${auctionId}`, 'general');
      refreshWalletBalance();
    }
  });

  contract.on('AuctionCancelled', async (auctionId) => {
    logActivity(`🚫 Auction #${auctionId} cancelled on-chain`, 'general');
    await syncSingleAuction(Number(auctionId));
    const item = state.auctions.find(a => a.onChainId === Number(auctionId));
    if (item) {
      item.status = 'ended';
      updateSingleAuctionCard(item);
      updateStatsSidebar();
      syncScreenReaderTable();
      showToast("Auction Cancelled", `"${item.title}" has been cancelled.`, "warning");
    }
  });
}

// 8. Dynamic DOM Card Generator
function createAuctionCardElement(item) {
  const wrapper = document.createElement('div');
  wrapper.className = 'auction-card-wrapper';
  wrapper.id = `card-wrap-${item.id}`;

  const card = document.createElement('article');
  card.className = 'auction-card';
  card.id = `card-${item.id}`;

  // Fetch gradient artwork
  const gradient = PRESETS[item.gradientKey] || PRESETS['gradient-1'];

  card.innerHTML = `
    <div class="card-media">
      <div class="procedural-art" style="background: ${gradient};">
        <!-- Procedural cyber grid overlay details -->
        <div style="position: absolute; inset: 0; background: linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 60%);"></div>
        <div style="position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 20px 20px;"></div>
      </div>
      <div class="card-badges">
        <span class="category-badge">${escapeHtml(item.category)}</span>
        ${item.onChainId !== undefined ? '<span class="onchain-badge">ON-CHAIN</span>' : ''}
        <span class="timer-badge" id="timer-badge-${item.id}">${formatTime(item.timeLeft)}</span>
      </div>
    </div>
    
    <div class="card-body">
      <h3 class="card-title">${escapeHtml(item.title)}</h3>
      <p class="card-desc">${escapeHtml(item.description)}</p>
      
      <div class="time-progressbar-container">
        <div class="time-progressbar" id="progress-${item.id}" style="transform: scaleX(${item.timeLeft / item.duration});"></div>
      </div>
      
      <div class="bid-summary">
        <div class="bid-data">
          <span class="bid-data-label">Min Next Bid</span>
          <span class="bid-data-val cyan" id="min-bid-${item.id}">$${(item.currentBid + item.minIncrement).toLocaleString()}</span>
        </div>
        <div class="bid-data">
          <span class="bid-data-label">Current Bid</span>
          <span class="bid-data-val" id="current-bid-${item.id}">$${item.currentBid.toLocaleString()}</span>
          <span class="current-bidder" id="current-bidder-${item.id}"></span>
        </div>
      </div>
      
      <div class="card-history">
        <div class="card-history-title">Bid History</div>
        <div class="card-history-list custom-scrollbar" id="history-list-${item.id}">
          <!-- Dynamic history item array -->
        </div>
      </div>
      
      <form class="bid-controls" id="bid-form-${item.id}">
        <div class="bid-input-container">
          <span class="bid-currency-symbol">$</span>
          <input type="number" class="bid-input" id="input-${item.id}" min="${item.currentBid + item.minIncrement}" value="${item.currentBid + item.minIncrement}" required aria-label="Enter bid amount in dollars">
          <button type="button" class="increment-btn" id="inc-btn-${item.id}" title="Increase bid by increment">+${item.minIncrement}</button>
        </div>
        ${item.onChainId !== undefined ? `<div class="gas-estimate" id="gas-est-${item.id}"></div>` : ''}
        <button type="submit" class="btn btn-primary" id="submit-btn-${item.id}">Place Bid</button>
      </form>
      
      <div class="card-action-area" id="action-area-${item.id}"></div>
    </div>
  `;

  wrapper.appendChild(card);

  // Wire controls events
  const form = card.querySelector(`#bid-form-${item.id}`);
  const input = card.querySelector(`#input-${item.id}`);
  const incBtn = card.querySelector(`#inc-btn-${item.id}`);

  incBtn.addEventListener('click', () => {
    const currentVal = sanitizeInput(input.value);
    input.value = currentVal + item.minIncrement;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = sanitizeInput(input.value);
    const submitBtnEl = card.querySelector(`#submit-btn-${item.id}`);

    // Confirmation dialog for on-chain bids
    if (item.onChainId !== undefined && state.web3.contractReady) {
      const ethEquiv = usdToEth(val);
      const confirmed = confirm(
        `Place bid of $${val.toLocaleString()} (≈ ${ethEquiv} ETH)?\n\nThis will open MetaMask to confirm the transaction. Gas fees will apply.`
      );
      if (!confirmed) return;
    }

    if (submitBtnEl) {
      submitBtnEl.disabled = true;
      submitBtnEl.textContent = 'Processing...';
    }
    await placeBid(item.id, val);
    if (submitBtnEl) {
      submitBtnEl.disabled = false;
      submitBtnEl.textContent = 'Place Bid';
    }
  });

  // Update gas estimate for on-chain auctions
  if (item.onChainId !== undefined && state.web3.contractReady) {
    updateGasEstimate(item);
  }

  // Initial card update for lists & badges
  updateCardState(card, item);
  return wrapper;
}

// 9. Card State Refresh Engine
function updateCardState(card, item) {
  const timerBadge = card.querySelector(`#timer-badge-${item.id}`);
  const progressBar = card.querySelector(`#progress-${item.id}`);
  const minBidVal = card.querySelector(`#min-bid-${item.id}`);
  const currentBidVal = card.querySelector(`#current-bid-${item.id}`);
  const bidderSpan = card.querySelector(`#current-bidder-${item.id}`);
  const historyList = card.querySelector(`#history-list-${item.id}`);
  const input = card.querySelector(`#input-${item.id}`);
  const submitBtn = card.querySelector(`#submit-btn-${item.id}`);
  const incBtn = card.querySelector(`#inc-btn-${item.id}`);
  const actionArea = card.querySelector(`#action-area-${item.id}`);

  // Active timer updates
  if (item.status === 'active') {
    timerBadge.textContent = formatTime(item.timeLeft);
    const timeRatio = Math.max(0, Math.min(1, item.timeLeft / item.duration));
    progressBar.style.transform = `scaleX(${timeRatio})`;

    if (item.timeLeft <= 10) {
      timerBadge.classList.add('ending-soon');
    } else {
      timerBadge.classList.remove('ending-soon');
    }
  } else {
    timerBadge.textContent = "ENDED";
    timerBadge.classList.remove('ending-soon');
    progressBar.style.transform = `scaleX(0)`;
    progressBar.style.background = 'var(--text-muted)';
  }

  // Bid state styling
  currentBidVal.textContent = `$${item.currentBid.toLocaleString()}`;
  minBidVal.textContent = `$${(item.currentBid + item.minIncrement).toLocaleString()}`;

  const isHighBidderUser = item.bids.length > 0 && item.bids[0].bidder === 'You';

  card.classList.remove('user-winning', 'user-outbid');

  if (item.status === 'active') {
    if (item.bids.length > 0) {
      const highestBidder = item.bids[0].bidder;
      bidderSpan.innerHTML = `<span class="bidder-dot ${isHighBidderUser ? 'you' : ''}"></span> ${escapeHtml(highestBidder)}`;

      const userHasBid = item.bids.some(b => b.bidder === 'You');
      if (userHasBid) {
        if (isHighBidderUser) {
          card.classList.add('user-winning');
          currentBidVal.className = "bid-data-val winning";
        } else {
          card.classList.add('user-outbid');
          currentBidVal.className = "bid-data-val outbid";
        }
      } else {
        currentBidVal.className = "bid-data-val cyan";
      }
    } else {
      bidderSpan.textContent = "No bids placed";
      currentBidVal.className = "bid-data-val cyan";
    }

    // Reset form limits
    input.min = item.currentBid + item.minIncrement;
    if (sanitizeInput(input.value) < sanitizeInput(input.min)) {
      input.value = input.min;
    }
    input.disabled = false;
    submitBtn.disabled = false;
    incBtn.disabled = false;
    submitBtn.textContent = "Place Bid";

    // Show cancel button for seller on active on-chain auctions
    if (actionArea && item.onChainId !== undefined && state.web3.connected) {
      const isSeller = item.owner?.toLowerCase() === state.web3.address?.toLowerCase()
        || item.onChainSeller?.toLowerCase() === state.web3.address?.toLowerCase();
      if (isSeller) {
        actionArea.innerHTML = `<button class="btn btn-secondary btn-cancel-auction" data-onchain-id="${item.onChainId}" style="width:100%; opacity:0.7; font-size:0.75rem;">Cancel Auction</button>`;
        const cancelBtn = actionArea.querySelector('.btn-cancel-auction');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', async () => {
            if (!confirm('Cancel this auction? All bidders will be refunded.')) return;
            cancelBtn.disabled = true;
            cancelBtn.textContent = 'Cancelling...';
            await cancelAuctionOnChain(item.onChainId);
          });
        }
      } else {
        actionArea.innerHTML = '';
      }
    } else if (actionArea) {
      actionArea.innerHTML = '';
    }
  } else {
    // Ended state styles
    const winner = item.bids.length > 0 ? item.bids[0].bidder : 'None';
    bidderSpan.innerHTML = `Won by <strong>${escapeHtml(winner)}</strong>`;
    currentBidVal.className = "bid-data-val";

    input.disabled = true;
    submitBtn.disabled = true;
    incBtn.disabled = true;
    submitBtn.textContent = "Completed";

    // Show action buttons for on-chain ended auctions
    if (actionArea && item.onChainId !== undefined && state.web3.connected) {
      const isSeller = item.owner?.toLowerCase() === state.web3.address?.toLowerCase();
      const isWinner = item.onChainHighestBidder?.toLowerCase() === state.web3.address?.toLowerCase();
      const userHadBid = item.bids.some(b => b.bidder === 'You');

      let actionHtml = '';
      if (isSeller && !isWinner) {
        actionHtml = `<button class="btn btn-primary btn-settle" data-onchain-id="${item.onChainId}">Settle Auction</button>`;
      } else if (isWinner) {
        actionHtml = `<div class="action-won-badge">You Won This Auction!</div>`;
      } else if (userHadBid) {
        actionHtml = `<button class="btn btn-secondary btn-refund" data-onchain-id="${item.onChainId}">Claim Refund</button>`;
      }
      actionArea.innerHTML = actionHtml;

      // Wire settle button
      const settleBtn = actionArea.querySelector('.btn-settle');
      if (settleBtn) {
        settleBtn.addEventListener('click', async () => {
          settleBtn.disabled = true;
          settleBtn.textContent = 'Settling...';
          await settleAuctionOnChain(item.onChainId);
          settleBtn.textContent = 'Settled';
        });
      }

      // Wire refund button
      const refundBtn = actionArea.querySelector('.btn-refund');
      if (refundBtn) {
        refundBtn.addEventListener('click', async () => {
          refundBtn.disabled = true;
          refundBtn.textContent = 'Claiming...';
          await claimRefundOnChain(item.onChainId);
          refundBtn.textContent = 'Claimed';
        });
      }
    } else if (actionArea) {
      actionArea.innerHTML = '';
    }
  }

  // Render history ticker inside card
  historyList.innerHTML = item.bids.map(b => `
    <div class="card-history-item">
      <span style="font-weight: 500; color: ${b.bidder === 'You' ? 'var(--status-success)' : 'var(--text-primary)'};">${escapeHtml(b.bidder)}</span>
      <span style="color: var(--text-secondary);">$${b.amount.toLocaleString()}</span>
    </div>
  `).join('');
}

async function updateGasEstimate(item) {
  if (!state.web3.contractReady || item.onChainId === undefined) return;
  const gasEl = document.getElementById(`gas-est-${item.id}`);

  if (!gasEl) return;

  try {
    const nextBid = item.currentBid + item.minIncrement;
    const bidWei = ethers.parseEther(usdToEth(nextBid));
    const gas = await state.web3.contract.placeBid.estimateGas(item.onChainId, { value: bidWei });
    const feeData = await state.web3.provider.getFeeData();
    const effectiveGasPrice = feeData.maxFeePerGas || feeData.gasPrice || 0n;
    const gasCost = gas * effectiveGasPrice;
    const gasEth = parseFloat(ethers.formatEther(gasCost)).toFixed(6);
    const gasUsd = Math.round(parseFloat(gasEth) * state.web3.ethPrice);
    gasEl.textContent = `~${gasEth} ETH ($${gasUsd}) gas`;
  } catch (e) {
    gasEl.textContent = '';
  }
}

function updateSingleAuctionCard(item) {
  const card = document.getElementById(`card-${item.id}`);
  if (card) {
    updateCardState(card, item);
  }
}

// 10. Sidebar Stats & Personal Lists Rendering
function updateStatsSidebar() {
  let winningCount = 0;
  let outbidCount = 0;
  let wonCount = 0;

  const targetMap = {};

  state.auctions.forEach(item => {
    const hasUserBid = item.bids.some(b => b.bidder === 'You');
    const isHighBidderUser = item.bids.length > 0 && item.bids[0].bidder === 'You';

    if (item.status === 'active') {
      if (hasUserBid) {
        if (isHighBidderUser) {
          winningCount++;
          targetMap[item.id] = { title: item.title, amount: item.currentBid, status: 'winning' };
        } else {
          outbidCount++;
          targetMap[item.id] = { title: item.title, amount: state.heldEscrows[item.id] || item.currentBid, status: 'outbid' };
        }
      }
    } else {
      if (hasUserBid && isHighBidderUser) {
        wonCount++;
        targetMap[item.id] = { title: item.title, amount: item.currentBid, status: 'won' };
      }
    }
  });

  // Update counts
  document.getElementById('winning-count').textContent = winningCount;
  document.getElementById('outbid-count').textContent = outbidCount;
  document.getElementById('wins-count').textContent = wonCount;

  // Render target lists
  const list = document.getElementById('portfolio-list');
  const targetIds = Object.keys(targetMap);

  if (targetIds.length === 0) {
    list.innerHTML = `
      <div class="portfolio-empty">
        No active bids yet. Bid on items in the arena to track them here!
      </div>
    `;
    return;
  }

  list.innerHTML = targetIds.map(id => {
    const t = targetMap[id];
    let badgeClass = 'winning';
    if (t.status === 'outbid') badgeClass = 'outbid';
    if (t.status === 'won') badgeClass = 'won';

    return `
      <div class="portfolio-item">
        <div>
          <div class="portfolio-item-title">${t.title}</div>
          <span class="portfolio-item-status ${badgeClass}">${t.status}</span>
        </div>
        <span class="portfolio-item-price">$${t.amount.toLocaleString()}</span>
      </div>
    `;
  }).join('');
}

// 11. Initial Main Auctions Setup
function renderAllAuctionsGrid() {
  const grid = document.getElementById('auctions-grid');
  grid.innerHTML = '';

  const query = state.searchQuery.toLowerCase();
  const category = state.activeCategory;

  let visibleCount = 0;

  state.auctions.forEach(item => {
    const matchesCategory = category === 'all' || item.category === category;
    const matchesSearch = item.title.toLowerCase().includes(query) || item.description.toLowerCase().includes(query);

    const cardEl = createAuctionCardElement(item);

    if (!matchesCategory || !matchesSearch) {
      cardEl.style.display = 'none';
    } else {
      visibleCount++;
    }

    grid.appendChild(cardEl);
  });

  if (visibleCount === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; color: var(--text-muted);">
        No matching live auctions found for current filters.
      </div>
    `;
  }
}

// Refresh display filters smoothly without resetting nodes
function applyFiltersAndSearch() {
  const grid = document.getElementById('auctions-grid');
  const query = state.searchQuery.toLowerCase();
  const category = state.activeCategory;

  let visibleCount = 0;

  state.auctions.forEach(item => {
    const cardWrap = document.getElementById(`card-wrap-${item.id}`);
    if (!cardWrap) return;

    const matchesCategory = category === 'all' || item.category === category;
    const matchesSearch = item.title.toLowerCase().includes(query) || item.description.toLowerCase().includes(query);

    if (!matchesCategory || !matchesSearch) {
      cardWrap.style.display = 'none';
    } else {
      cardWrap.style.display = 'block';
      visibleCount++;
    }
  });

  // Show empty feedback if necessary
  const emptyFeedbackId = 'filter-empty-feedback';
  let emptyFeedback = document.getElementById(emptyFeedbackId);

  if (visibleCount === 0) {
    if (!emptyFeedback) {
      emptyFeedback = document.createElement('div');
      emptyFeedback.id = emptyFeedbackId;
      emptyFeedback.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 4rem; color: var(--text-muted);';
      emptyFeedback.textContent = 'No matching live auctions found for current filters.';
      grid.appendChild(emptyFeedback);
    }
  } else {
    if (emptyFeedback) {
      emptyFeedback.remove();
    }
  }
}

// 12. Competitor Rival Bot Simulation Core
function executeBotSimulationTick() {
  // When user is connected to a real wallet, prevent bot simulation from mutating
  // demo walletBalance / heldEscrows and desyncing the UI.
  if (state.web3.connected) return;

  // Loop through active auctions and place random bids
  state.auctions.forEach(item => {
    if (item.status !== 'active') return;


    // Bot bid probability increases as time runs out
    // Under 15s: 18% chance/sec. Under 40s: 8% chance/sec. Else: 3% chance/sec
    let chance = 0.03;
    if (item.timeLeft < 15) {
      chance = 0.18;
    } else if (item.timeLeft < 40) {
      chance = 0.08;
    }

    // Do not trigger bot bids if bots are already competing and user has not bid (keep active loop reasonable)
    if (Math.random() > chance) return;

    // Determine high bidder
    const isUserWinning = item.bids.length > 0 && item.bids[0].bidder === 'You';

    // Bots only outbid the user or challenge other bots randomly
    // If user is winning, bot will prioritize outbidding them to sustain the simulation
    const selectBotBid = isUserWinning || Math.random() < 0.45;
    if (!selectBotBid) return;

    // Place a bot bid
    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const markupMultiplier = 1 + Math.random() * 1.5;
    const botBidAmount = item.currentBid + Math.ceil(item.minIncrement * markupMultiplier);

    // Handle Escrow Refund if bot outbids user
    if (isUserWinning) {
      const escrowedUserAmount = state.heldEscrows[item.id] || 0;
      state.walletBalance += escrowedUserAmount;
      delete state.heldEscrows[item.id];

      updateWalletUI('refund');
      playSoundOutbid();
      showToast("You've been outbid!", `"${botName}" outbid you on "${item.title}" with a bid of $${botBidAmount.toLocaleString()}. Refunded $${escrowedUserAmount.toLocaleString()} to wallet.`, "warning");
    }

    item.currentBid = botBidAmount;
    item.bids.unshift({
      bidder: botName,
      amount: botBidAmount,
      time: 'Just now'
    });

    // Snipe prevention for bot bids
    if (item.timeLeft < 10) {
      item.timeLeft = 10;
      logActivity(`⏰ Auction timer extended for "${item.title}"! (Anti-Sniping)`, 'listing');
    }

    logActivity(`🤖 ${botName} bid $${botBidAmount.toLocaleString()} on "${item.title}"`, 'bid');

    updateSingleAuctionCard(item);
    updateStatsSidebar();
    syncScreenReaderTable();
  });
}

// 13. Timer Tick Down Engine
function executeTimerTick() {
  state.auctions.forEach(item => {
    if (item.status !== 'active') return;

    item.timeLeft -= 1;

    // Update card timer badge directly for smooth rendering
    const badge = document.getElementById(`timer-badge-${item.id}`);
    const progress = document.getElementById(`progress-${item.id}`);
    if (badge) badge.textContent = formatTime(item.timeLeft);
    if (progress) {
      const timeRatio = Math.max(0, Math.min(1, item.timeLeft / item.duration));
      progress.style.transform = `scaleX(${timeRatio})`;
      if (item.timeLeft <= 10) {
        badge.classList.add('ending-soon');
        progress.style.background = 'var(--status-danger)';
      }
    }

    // Handle auction complete transition
    if (item.timeLeft <= 0) {
      item.status = 'ended';
      item.timeLeft = 0;

      // Determine final results
      const hasWinner = item.bids.length > 0;
      const winnerName = hasWinner ? item.bids[0].bidder : 'Nobody';
      const winningAmount = hasWinner ? item.bids[0].amount : 0;

      logActivity(`🏁 Auction ended: "${item.title}" won by ${winnerName} for $${winningAmount.toLocaleString()}`, 'win');

      if (winnerName === 'You') {
        // User Wins: clear escrow balance locks, they successfully purchase the item
        delete state.heldEscrows[item.id];
        showToast("CONGRATULATIONS!", `You won "${item.title}" for $${winningAmount.toLocaleString()}!`, "success");
        playSoundWin();
        triggerConfetti();
      } else {
        // Bots win: If user had an active bid in progress (but wasn't winning, which shouldn't happen because they're outbid and refunded, but safety check)
        if (state.heldEscrows[item.id]) {
          state.walletBalance += state.heldEscrows[item.id];
          delete state.heldEscrows[item.id];
          updateWalletUI('refund');
        }
        showToast("Auction Ended", `"${item.title}" won by ${winnerName} for $${winningAmount.toLocaleString()}`, "info");
        playTone(300, 'sine', 0.25);
      }

      updateSingleAuctionCard(item);
      updateStatsSidebar();
      syncScreenReaderTable();
    }
  });
}

// 14. Central Clock Engine Loop (1Hz updates)
let _syncCounter = 0;
setInterval(() => {
  executeTimerTick();
  executeBotSimulationTick();

  // Refresh standard timer labels in case of list view variations
  state.auctions.forEach(item => {
    const badge = document.getElementById(`timer-badge-${item.id}`);
    if (badge && item.status === 'active') {
      badge.textContent = formatTime(item.timeLeft);
    }
  });

  // Sync on-chain auctions every 30 seconds
  _syncCounter++;
  if (_syncCounter % 30 === 0 && state.web3.contractReady) {
    syncOnChainAuctions();
  }
}, 1000);

// Helper for digital clock padding
function formatTime(totalSeconds) {
  if (totalSeconds <= 0) return "00:00";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 15. Accessible Semantic Table Syncing
function syncScreenReaderTable() {
  const tbody = document.getElementById('screen-reader-table-body');
  tbody.innerHTML = state.auctions.map(item => `
    <tr>
      <td>${item.title}</td>
      <td>${item.category}</td>
      <td>$${item.currentBid.toLocaleString()}</td>
      <td>${item.status === 'active' ? formatTime(item.timeLeft) : 'Ended'}</td>
      <td>${item.status === 'active' ? 'Active Live Bidding' : 'Auction Finished'}</td>
    </tr>
  `).join('');
}

// 16. Event Interconnections and Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Initial displays
  renderAllAuctionsGrid();
  updateWalletUI();
  updateStatsSidebar();
  syncScreenReaderTable();
  logActivity("🌐 AuraBid connection established. Connect your Web3 wallet to begin bidding.", "general");
  if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    logActivity("📋 No contract address configured. Deploy contract and paste address in app.js.", "general");
  }

  // Web3: Setup Ethereum event listeners & connect/disconnect buttons
  setupEthereumListeners();

  const connectWalletBtn = document.getElementById('connect-wallet-btn');
  connectWalletBtn.addEventListener('click', connectWallet);

  const disconnectBtn = document.getElementById('disconnect-wallet-btn');
  disconnectBtn.addEventListener('click', disconnectWallet);

  // Audio control toggling
  const soundBtn = document.getElementById('sound-toggle');
  const soundHighIcon = document.getElementById('volume-high-icon');
  const soundMutedIcon = document.getElementById('volume-muted-icon');

  soundBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    if (state.soundEnabled) {
      soundHighIcon.style.display = 'block';
      soundMutedIcon.style.display = 'none';
      showToast("Sound On", "Audio indicators activated.", "info");
      playTone(600, 'sine', 0.08);
    } else {
      soundHighIcon.style.display = 'none';
      soundMutedIcon.style.display = 'block';
      showToast("Sound Muted", "Audio indicators deactivated.", "info");
    }
  });

  // Search box listener
  const searchBox = document.getElementById('search-input');
  searchBox.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    applyFiltersAndSearch();
  });

  // Category chip filters
  const chips = document.querySelectorAll('.chip');
  chips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      state.activeCategory = chip.dataset.category;
      applyFiltersAndSearch();
    });
  });

  // Modal creation display actions
  const createBtn = document.getElementById('create-listing-btn');
  const modalOverlay = document.getElementById('create-modal-overlay');
  const modalClose = document.getElementById('modal-close-btn');
  const formCancel = document.getElementById('form-cancel-btn');

  function openModal() {
    modalOverlay.classList.add('open');
    // Pre-populate dynamic variables in listing form
    document.getElementById('item-title').value = '';
    document.getElementById('item-desc').value = '';
    document.getElementById('item-starting-bid').value = 150;
    document.getElementById('item-duration').value = 90;
    document.getElementById('item-increment').value = 10;
    document.getElementById('selected-gradient').value = 'gradient-1';

    // Focus first input field
    setTimeout(() => {
      document.getElementById('item-title').focus();
    }, 100);
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
  }

  createBtn.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  formCancel.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Render presets buttons for gradient art selection
  const presetsContainer = document.getElementById('artwork-presets');
  presetsContainer.innerHTML = Object.keys(PRESETS).map((key, index) => `
    <button type="button" class="artwork-preset-btn ${index === 0 ? 'active' : ''}" data-key="${key}" style="background: ${PRESETS[key]};" aria-label="Select gradient artwork preset ${index + 1}">
    </button>
  `).join('');

  const presetBtns = presetsContainer.querySelectorAll('.artwork-preset-btn');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('selected-gradient').value = btn.dataset.key;
    });
  });

  // Modal Form Submission Handler
  const form = document.getElementById('create-listing-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('item-title').value.trim();
    const desc = document.getElementById('item-desc').value.trim();
    const startingBid = sanitizeInput(document.getElementById('item-starting-bid').value);
    const duration = sanitizeInput(document.getElementById('item-duration').value);
    const category = document.getElementById('item-category').value;
    const increment = sanitizeInput(document.getElementById('item-increment').value);
    const gradientKey = document.getElementById('selected-gradient').value;

    // Validate fields
    if (!title || !desc || startingBid <= 0 || duration < 30 || increment <= 0) {
      showToast("Invalid Details", "Please fill all listing form fields with valid values.", "warning");
      playSoundError();
      return;
    }

    let onChainId = null;

    // Try on-chain creation if wallet is connected and contract is ready
    if (state.web3.contractReady && state.web3.connected) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
      }
      onChainId = await createAuctionOnChain(title, desc, startingBid, increment, duration);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish Auction';
      }
      if (onChainId === null) return; // Failed or rejected
    }

    // Add item to active listings array
    const newItemId = onChainId !== null ? `onchain-${onChainId}` : `auc-${Date.now()}`;
    const newItem = {
      id: newItemId,
      onChainId: onChainId,
      title: title,
      description: desc,
      category: category,
      gradientKey: gradientKey,
      currentBid: startingBid,
      minIncrement: increment,
      timeLeft: duration,
      duration: duration,
      owner: state.web3.address || 'You',
      status: 'active',
      bids: []
    };

    state.auctions.unshift(newItem);

    // UI dynamic inserts
    const cardEl = createAuctionCardElement(newItem);
    const grid = document.getElementById('auctions-grid');

    // Clean empty listings state
    const filterEmpty = document.getElementById('filter-empty-feedback');
    if (filterEmpty) filterEmpty.remove();

    // Check search & filters compatibility on prepending
    const queryVal = state.searchQuery.toLowerCase();
    const catVal = state.activeCategory;
    const matchesCategory = catVal === 'all' || category === catVal;
    const matchesSearch = title.toLowerCase().includes(queryVal) || desc.toLowerCase().includes(queryVal);

    if (!matchesCategory || !matchesSearch) {
      cardEl.style.display = 'none';
    }

    grid.prepend(cardEl);

    // Log, notify, play chime
    const modeLabel = onChainId !== null ? 'on-chain' : 'local';
    logActivity(`🚀 You launched a ${modeLabel} auction for "${title}" starting at $${startingBid.toLocaleString()}`, 'listing');
    showToast("Auction Launched!", `"${title}" is now live in the bidding arena!${onChainId !== null ? ' (On-Chain)' : ''}`, "success");
    playSoundBidSuccess();

    closeModal();
    updateStatsSidebar();
    syncScreenReaderTable();
  });
});
