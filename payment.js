// AuraBid Payment Page Logic

const CONTRACT_ADDRESS = "0xa9BdA562AAa4cC8E73b7Cb7600A89fAAA584Effb";
const CONTRACT_ABI = [
  { "type": "function", "name": "payForAuction", "inputs": [{ "name": "_auctionId", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "getAuction", "inputs": [{ "name": "_auctionId", "type": "uint256" }], "outputs": [{ "name": "", "type": "tuple", "components": [{ "name": "id", "type": "uint256" }, { "name": "seller", "type": "address" }, { "name": "title", "type": "string" }, { "name": "description", "type": "string" }, { "name": "startingBid", "type": "uint256" }, { "name": "minimumIncrement", "type": "uint256" }, { "name": "startTime", "type": "uint256" }, { "name": "endTime", "type": "uint256" }, { "name": "highestBid", "type": "uint256" }, { "name": "highestBidder", "type": "address" }, { "name": "settled", "type": "bool" }, { "name": "cancelled", "type": "bool" }, { "name": "totalBids", "type": "uint256" }] }], "stateMutability": "view" },
  { "type": "event", "name": "AuctionSettled", "inputs": [{ "name": "auctionId", "type": "uint256", "indexed": true }, { "name": "winner", "type": "address", "indexed": true }, { "name": "winningBid", "type": "uint256", "indexed": false }] }
];

let provider = null;
let signer = null;
let contract = null;
let userAddress = null;
let auctionData = null;
let ethPrice = 2500;

function truncateAddress(addr) {
  if (!addr) return '0x0000…0000';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
    <span class="toast-close" role="button">&times;</span>
  `;
  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
}

function etherscanTxLink(txHash) {
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

function getAuctionIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function fetchEthPrice() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    if (res.ok) {
      const data = await res.json();
      if (data?.ethereum?.usd) { ethPrice = data.ethereum.usd; return; }
    }
  } catch (e) {}
  ethPrice = 2500;
}

function ethToUsd(wei) {
  const eth = parseFloat(ethers.formatEther(wei));
  return Math.round(eth * ethPrice);
}

function usdToEth(usd) {
  return (usd / ethPrice).toFixed(4);
}

async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    showToast('No Wallet Detected', 'Install MetaMask to continue.', 'warning');
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) throw new Error('No accounts');

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();

    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // Check Sepolia
    const network = await provider.getNetwork();
    const chainId = '0x' + network.chainId.toString(16);
    if (chainId !== '0xaa36a7') {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      } catch (e) {
        if (e.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{ chainId: '0xaa36a7', chainName: 'Sepolia Testnet', nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.sepolia.org'], blockExplorerUrls: ['https://sepolia.etherscan.io'] }]
          });
        }
      }
    }

    await loadAuction();
  } catch (err) {
    showToast('Connection Failed', err.message || 'Could not connect.', 'warning');
  }
}

async function loadAuction() {
  const auctionId = getAuctionIdFromURL();
  if (!auctionId) {
    showError('No auction specified. Return to the arena and try again.');
    return;
  }

  try {
    await fetchEthPrice();
    auctionData = await contract.getAuction(auctionId);

    if (auctionData.seller === ethers.ZeroAddress) {
      showError('Auction not found.');
      return;
    }

    if (auctionData.settled) {
      showError('This auction has already been settled.');
      return;
    }

    if (auctionData.cancelled) {
      showError('This auction has been cancelled.');
      return;
    }

    if (auctionData.highestBidder.toLowerCase() !== userAddress.toLowerCase()) {
      showError('You are not the winner of this auction.');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now <= Number(auctionData.endTime)) {
      showError('This auction has not ended yet.');
      return;
    }

    // Show payment details
    document.getElementById('payment-content').style.display = 'none';
    document.getElementById('payment-details').style.display = 'block';
    document.getElementById('pay-title').textContent = auctionData.title;
    document.getElementById('pay-auction-id').textContent = `#${auctionId}`;
    document.getElementById('pay-seller').innerHTML = `${truncateAddress(auctionData.seller)}<small>${auctionData.seller}</small>`;
    document.getElementById('pay-seller').style.fontSize = '0.85rem';
    document.getElementById('pay-amount').innerHTML = `$${ethToUsd(auctionData.highestBid).toLocaleString()}<small>≈ ${usdToEth(ethToUsd(auctionData.highestBid))} ETH</small>`;

  } catch (e) {
    showError('Failed to load auction data: ' + (e.message || e));
  }
}

async function payForAuction() {
  if (!contract || !auctionData) return;

  const payBtn = document.getElementById('pay-btn');
  const txStatus = document.getElementById('tx-status');
  const txSpinner = document.getElementById('tx-spinner');
  const txText = document.getElementById('tx-status-text');

  payBtn.disabled = true;
  payBtn.textContent = 'Confirm in MetaMask...';
  payBtn.classList.add('processing');

  txStatus.className = 'tx-status-section pending';
  txStatus.style.display = 'block';
  txSpinner.style.display = 'block';
  txText.textContent = 'Waiting for wallet signature...';

  try {
    const auctionId = getAuctionIdFromURL();
    const tx = await contract.payForAuction(auctionId);

    txText.textContent = `TX sent: ${tx.hash.slice(0, 10)}... Waiting for confirmation...`;
    payBtn.textContent = 'Processing on-chain...';

    const receipt = await tx.wait();

    txSpinner.style.display = 'none';
    txStatus.className = 'tx-status-section success';
    txText.innerHTML = `✅ Confirmed in block #${receipt.blockNumber}<br><a href="${etherscanTxLink(tx.hash)}" target="_blank" rel="noopener">View on Etherscan ↗</a>`;

    // Show success
    setTimeout(() => {
      document.getElementById('payment-details').style.display = 'none';
      document.getElementById('tx-status').style.display = 'none';
      document.getElementById('payment-success').style.display = 'block';
      document.getElementById('success-details').innerHTML = `
        <div style="margin-bottom:1rem;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Transaction Hash</div>
          <a href="${etherscanTxLink(tx.hash)}" target="_blank" style="color:#8fa8f8; font-size:0.85rem; word-break:break-all;">${tx.hash}</a>
        </div>
        <div style="margin-bottom:1rem;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Block Number</div>
          <div style="font-size:0.9rem;">#${receipt.blockNumber}</div>
        </div>
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Amount Paid</div>
          <div style="font-size:1.1rem; font-weight:700; color:#2ec4b6;">$${ethToUsd(auctionData.highestBid).toLocaleString()}</div>
        </div>
      `;
      triggerConfetti();
    }, 1500);

    // Store in localStorage history
    storeTransaction({
      type: 'payment',
      auctionId: Number(auctionId),
      title: auctionData.title,
      amount: ethToUsd(auctionData.highestBid),
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      timestamp: Date.now(),
      from: userAddress,
      to: auctionData.seller
    });

  } catch (e) {
    txSpinner.style.display = 'none';
    payBtn.disabled = false;
    payBtn.textContent = 'Pay Now';
    payBtn.classList.remove('processing');

    const reason = e?.message?.includes('user rejected') ? 'Transaction rejected by user.' : (e?.reason || e?.message || 'Unknown error');
    txStatus.className = 'tx-status-section error';
    txText.textContent = reason;

    document.getElementById('payment-error').style.display = 'block';
    document.getElementById('payment-details').style.display = 'none';
    document.getElementById('error-message').textContent = reason;
  }
}

function showError(msg) {
  document.getElementById('payment-content').style.display = 'none';
  document.getElementById('payment-details').style.display = 'none';
  document.getElementById('payment-error').style.display = 'block';
  document.getElementById('error-message').textContent = msg;
}

function storeTransaction(tx) {
  const history = JSON.parse(localStorage.getItem('aurabid_history') || '[]');
  history.unshift(tx);
  localStorage.setItem('aurabid_history', JSON.stringify(history.slice(0, 100)));
}

// Confetti
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
let confettiParticles = [];
let confettiActive = false;

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
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
  update() { this.x += this.speedX; this.y += this.speedY; this.rotation += this.spin; }
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
  for (let i = 0; i < 150; i++) confettiParticles.push(new ConfettiParticle());
  function loop() {
    if (!confettiActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = 0;
    confettiParticles.forEach(p => { p.update(); p.draw(); if (p.y < canvas.height) active++; });
    if (active > 0) requestAnimationFrame(loop);
    else { confettiActive = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }
  loop();
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('connect-wallet-btn').addEventListener('click', connectWallet);
  document.getElementById('pay-btn').addEventListener('click', payForAuction);
  document.getElementById('retry-btn').addEventListener('click', () => {
    document.getElementById('payment-error').style.display = 'none';
    document.getElementById('payment-details').style.display = 'block';
    document.getElementById('pay-btn').disabled = false;
    document.getElementById('pay-btn').textContent = 'Pay Now';
    document.getElementById('tx-status').style.display = 'none';
  });

  // Auto-connect if wallet is already connected
  if (typeof window.ethereum !== 'undefined') {
    window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
      if (accounts.length > 0) connectWallet();
    }).catch(() => {});
  }
});
