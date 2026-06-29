// AuraBid Payment Page - Full Transaction Flow

const CONTRACT_ADDRESS = "0xa9BdA562AAa4cC8E73b7Cb7600A89fAAA584Effb";
const CONTRACT_ABI = [
  { "type": "function", "name": "payForAuction", "inputs": [{ "name": "_auctionId", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "getAuction", "inputs": [{ "name": "_auctionId", "type": "uint256" }], "outputs": [{ "name": "", "type": "tuple", "components": [{ "name": "id", "type": "uint256" }, { "name": "seller", "type": "address" }, { "name": "title", "type": "string" }, { "name": "description", "type": "string" }, { "name": "startingBid", "type": "uint256" }, { "name": "minimumIncrement", "type": "uint256" }, { "name": "startTime", "type": "uint256" }, { "name": "endTime", "type": "uint256" }, { "name": "highestBid", "type": "uint256" }, { "name": "highestBidder", "type": "address" }, { "name": "settled", "type": "bool" }, { "name": "cancelled", "type": "bool" }, { "name": "totalBids", "type": "uint256" }] }], "stateMutability": "view" },
  { "type": "event", "name": "AuctionSettled", "inputs": [{ "name": "auctionId", "type": "uint256", "indexed": true }, { "name": "winner", "type": "address", "indexed": true }, { "name": "winningBid", "type": "uint256", "indexed": false }] }
];

let provider, signer, contract, userAddress, auctionData, ethPrice = 2500;
let balanceBeforeWei = 0n;
const SEPOLIA_CHAIN_ID = '0xaa36a7';

// ---- Utilities ----
function escapeHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function truncateAddress(a) { return a ? a.slice(0,6)+'…'+a.slice(-4) : '0x0000…0000'; }
function etherscanTxLink(h) { return `https://sepolia.etherscan.io/tx/${h}`; }
function etherscanAddrLink(a) { return `https://sepolia.etherscan.io/address/${a}`; }
function getAuctionId() { return new URLSearchParams(window.location.search).get('id'); }

function showToast(title, msg, type='info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type==='success'?'🏆':type==='warning'?'⚠️':'🔔';
  t.innerHTML = `<span class="toast-icon">${icon}</span><div class="toast-content"><div class="toast-title">${escapeHtml(title)}</div><div class="toast-msg">${escapeHtml(msg)}</div></div><span class="toast-close">&times;</span>`;
  t.querySelector('.toast-close').onclick = () => t.remove();
  c.appendChild(t);
  setTimeout(() => { if(t.parentNode) t.remove(); }, 5000);
}

async function fetchEthPrice() {
  try { const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'); if(r.ok){const d=await r.json(); if(d?.ethereum?.usd){ethPrice=d.ethereum.usd; return;}}} catch(e){}
  ethPrice = 2500;
}

function ethToUsd(wei) { return Math.round(parseFloat(ethers.formatEther(wei)) * ethPrice); }
function usdToEth(usd) { return (usd / ethPrice).toFixed(6); }
function formatEth(wei) { return parseFloat(ethers.formatEther(wei)).toFixed(6); }

// ---- UI Helpers ----
function setStep(n) {
  for (let i=1; i<=4; i++) {
    const el = document.getElementById(`step-${i}`);
    el.className = 'step' + (i < n ? ' done' : i === n ? ' active' : '');
  }
}

function showView(id) {
  ['content-connect','content-review','content-success','content-error'].forEach(v => {
    document.getElementById(v).style.display = 'none';
  });
  document.getElementById(id).style.display = '';
}

function showOverlay(show, cls) {
  const o = document.getElementById('status-overlay');
  o.className = 'status-overlay' + (show ? ` show ${cls||''}` : '');
}

function updateStatus(title, msg, details) {
  document.getElementById('status-title').textContent = title;
  document.getElementById('status-msg').innerHTML = msg;
  const det = document.getElementById('status-details');
  if (details && details.length) {
    det.innerHTML = details.map(d => `<div class="status-detail-row"><span class="label">${escapeHtml(d.label)}</span><span class="value">${d.value}</span></div>`).join('');
    det.style.display = '';
  } else { det.style.display = 'none'; }
}

function storeTransaction(tx) {
  const h = JSON.parse(localStorage.getItem('aurabid_history') || '[]');
  h.unshift(tx);
  localStorage.setItem('aurabid_history', JSON.stringify(h.slice(0,200)));
}

// ---- Wallet ----
async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    showToast('No Wallet', 'Install MetaMask to continue.', 'warning');
    return;
  }

  try {
    document.getElementById('btn-connect').textContent = 'Connecting...';
    document.getElementById('btn-connect').disabled = true;

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts.length) throw new Error('No accounts');

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // Switch to Sepolia
    const net = await provider.getNetwork();
    if ('0x' + net.chainId.toString(16) !== SEPOLIA_CHAIN_ID) {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_CHAIN_ID }] });
      } catch(e) {
        if (e.code === 4902) {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: SEPOLIA_CHAIN_ID, chainName: 'Sepolia Testnet', nativeCurrency: { name:'Sepolia ETH', symbol:'ETH', decimals:18 }, rpcUrls:['https://rpc.sepolia.org'], blockExplorerUrls:['https://sepolia.etherscan.io'] }] });
        }
      }
      // Re-init after switch
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }

    // Show wallet bar
    document.getElementById('wallet-bar').style.display = 'flex';
    document.getElementById('wallet-addr').textContent = truncateAddress(userAddress);
    document.getElementById('wallet-addr').title = userAddress;

    await fetchEthPrice();
    await updateBalance();
    await loadAuction();
  } catch(err) {
    showToast('Connection Failed', err.message || 'Could not connect.', 'warning');
    document.getElementById('btn-connect').textContent = 'Connect Wallet';
    document.getElementById('btn-connect').disabled = false;
  }
}

async function updateBalance() {
  if (!provider || !userAddress) return;
  const bal = await provider.getBalance(userAddress);
  balanceBeforeWei = bal;
  const eth = parseFloat(ethers.formatEther(bal)).toFixed(4);
  const usd = Math.round(parseFloat(eth) * ethPrice);
  document.getElementById('wallet-balance').innerHTML = `${eth} ETH<small>≈ $${usd.toLocaleString()}</small>`;
  return bal;
}

// ---- Auction Loading ----
async function loadAuction() {
  const auctionId = getAuctionId();
  if (!auctionId) { showError('No auction specified.'); return; }

  try {
    auctionData = await contract.getAuction(auctionId);
    if (auctionData.seller === ethers.ZeroAddress) { showError('Auction not found.'); return; }
    if (auctionData.settled) { showError('This auction has already been settled.'); return; }
    if (auctionData.cancelled) { showError('This auction has been cancelled.'); return; }
    if (auctionData.highestBidder.toLowerCase() !== userAddress.toLowerCase()) { showError('You are not the winner of this auction.'); return; }
    const now = Math.floor(Date.now() / 1000);
    if (now <= Number(auctionData.endTime)) { showError('This auction has not ended yet.'); return; }

    // Populate review
    showView('content-review');
    setStep(1);

    document.getElementById('d-title').textContent = auctionData.title;
    document.getElementById('d-id').textContent = `#${auctionId}`;
    document.getElementById('d-seller').innerHTML = `<a href="${etherscanAddrLink(auctionData.seller)}" target="_blank" style="color:#8fa8f8; text-decoration:none;">${truncateAddress(auctionData.seller)}</a>`;

    const winBidUsd = ethToUsd(auctionData.highestBid);
    const winBidEth = usdToEth(winBidUsd);
    document.getElementById('d-bid').textContent = `$${winBidUsd.toLocaleString()} (≈ ${winBidEth} ETH)`;
    document.getElementById('pay-usd').textContent = `$${winBidUsd.toLocaleString()}`;
    document.getElementById('pay-eth').textContent = `≈ ${winBidEth} ETH`;

    // Estimate gas
    await estimateGas(winBidUsd);

  } catch(e) {
    showError('Failed to load auction: ' + (e.message || e));
  }
}

async function estimateGas(winBidUsd) {
  const gasEl = document.getElementById('gas-est');
  const dedGas = document.getElementById('ded-gas');
  const dedAuction = document.getElementById('ded-auction');
  const dedTotal = document.getElementById('ded-total');
  const balAfter = document.getElementById('balance-after');

  try {
    const auctionId = getAuctionId();
    const gas = await contract.payForAuction.estimateGas(auctionId);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || 0n;
    const gasCost = gas * gasPrice;
    const gasEth = parseFloat(ethers.formatEther(gasCost)).toFixed(6);
    const gasUsd = Math.round(parseFloat(gasEth) * ethPrice);

    gasEl.textContent = `${gasEth} ETH ($${gasUsd})`;
    dedGas.textContent = `~${gasEth} ETH ($${gasUsd})`;

    // The bid amount was already sent when placing the bid, so payForAuction doesn't require msg.value
    // Only gas is deducted from wallet
    dedAuction.textContent = `$0 (already escrowed)`;
    dedTotal.textContent = `~${gasEth} ETH ($${gasUsd}) gas only`;

    const balEth = parseFloat(ethers.formatEther(balanceBeforeWei));
    const newBal = Math.max(0, balEth - parseFloat(gasEth));
    const newBalUsd = Math.round(newBal * ethPrice);
    balAfter.textContent = `${newBal.toFixed(4)} ETH (≈ $${newBalUsd.toLocaleString()})`;

  } catch(e) {
    gasEl.textContent = 'Could not estimate';
    dedGas.textContent = '~0.001 ETH';
    dedAuction.textContent = `$0 (already escrowed)`;
    dedTotal.textContent = '~0.001 ETH gas only';
    const balEth = parseFloat(ethers.formatEther(balanceBeforeWei));
    const newBal = Math.max(0, balEth - 0.001);
    balAfter.textContent = `${newBal.toFixed(4)} ETH`;
  }
}

// ---- Payment ----
async function payForAuction() {
  if (!contract || !auctionData) return;

  const btn = document.getElementById('btn-pay');
  const auctionId = getAuctionId();
  const winBidUsd = ethToUsd(auctionData.highestBid);
  const winBidEth = usdToEth(winBidUsd);

  // Step 1 → 2: Signing
  setStep(2);
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Waiting for MetaMask...';

  showOverlay(true, '');
  updateStatus(
    'Step 1: Awaiting Wallet Signature',
    'MetaMask has opened. Please review the transaction and click <strong>Confirm</strong> to sign.',
    [
      { label: 'Action', value: 'payForAuction()' },
      { label: 'Auction', value: `#${auctionId} — ${auctionData.title}` },
      { label: 'Seller', value: truncateAddress(auctionData.seller) },
      { label: 'Payment', value: `$${winBidUsd.toLocaleString()} (already in contract)` },
      { label: 'Gas Fee', value: 'Shown in MetaMask' },
      { label: 'What happens', value: 'Escrowed bid released to seller' }
    ]
  );

  let tx;
  try {
    tx = await contract.payForAuction(auctionId);

    // Step 2 → 3: Broadcast
    setStep(3);
    updateStatus(
      'Step 2: Transaction Broadcast',
      `Your transaction has been sent to the Sepolia network. Waiting for miners to include it in a block...`,
      [
        { label: 'TX Hash', value: `<a href="${etherscanTxLink(tx.hash)}" target="_blank">${tx.hash.slice(0,16)}... ↗</a>` },
        { label: 'Status', value: '⏳ Pending' },
        { label: 'Network', value: 'Sepolia Testnet' },
        { label: 'From', value: truncateAddress(userAddress) },
        { label: 'To', value: truncateAddress(CONTRACT_ADDRESS) }
      ]
    );
    showToast('TX Sent', `Transaction ${tx.hash.slice(0,10)}... broadcast. Waiting for confirmation.`, 'info');

    // Step 3 → 4: Confirmed
    const receipt = await tx.wait();

    setStep(4);
    updateStatus(
      'Step 3: Confirmed on-chain!',
      `Transaction included in block <strong>#${receipt.blockNumber}</strong>. Payment complete!`,
      [
        { label: 'TX Hash', value: `<a href="${etherscanTxLink(tx.hash)}" target="_blank">${tx.hash} ↗</a>` },
        { label: 'Block', value: `#${receipt.blockNumber}` },
        { label: 'Status', value: '✅ Confirmed' },
        { label: 'Gas Used', value: receipt.gasUsed.toString() },
        { label: 'From', value: truncateAddress(userAddress) },
        { label: 'To Contract', value: truncateAddress(CONTRACT_ADDRESS) }
      ]
    );

    // Update wallet balance
    await updateBalance();
    const newBalEth = parseFloat(ethers.formatEther(balanceBeforeWei)).toFixed(4);

    // Store transaction
    storeTransaction({
      type: 'payment',
      auctionId: Number(auctionId),
      title: auctionData.title,
      amount: winBidUsd,
      ethAmount: winBidEth,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      timestamp: Date.now(),
      from: userAddress,
      to: auctionData.seller
    });

    // Show success after 1.5s
    setTimeout(() => {
      showOverlay(false);
      showView('content-success');
      document.getElementById('receipt-box').innerHTML = `
        <div class="receipt-row"><span class="label">Auction</span><span class="value">#${auctionId} — ${escapeHtml(auctionData.title)}</span></div>
        <div class="receipt-row"><span class="label">Seller</span><span class="value"><a href="${etherscanAddrLink(auctionData.seller)}" target="_blank">${truncateAddress(auctionData.seller)} ↗</a></span></div>
        <div class="receipt-row"><span class="label">Winning Bid</span><span class="value">$${winBidUsd.toLocaleString()} (≈ ${winBidEth} ETH)</span></div>
        <div class="receipt-row"><span class="label">Gas Used</span><span class="value">${receipt.gasUsed.toString()} units</span></div>
        <div class="receipt-row"><span class="label">TX Hash</span><span class="value"><a href="${etherscanTxLink(tx.hash)}" target="_blank">${tx.hash} ↗</a></span></div>
        <div class="receipt-row"><span class="label">Block</span><span class="value">#${receipt.blockNumber}</span></div>
        <div class="receipt-row"><span class="label">Your Balance</span><span class="value">${newBalEth} ETH</span></div>
      `;
      triggerConfetti();
      showToast('Payment Complete!', `You paid $${winBidUsd.toLocaleString()} for "${auctionData.title}"`, 'success');
    }, 1500);

  } catch(err) {
    showOverlay(false);
    setStep(2);

    const reason = err?.message?.includes('user rejected') ? 'You rejected the transaction in MetaMask.' : (err?.reason || err?.message || 'Unknown error');
    showError(reason);

    btn.disabled = false;
    btn.innerHTML = '💳 Pay Now';
    showToast('Payment Failed', reason, 'warning');

    storeTransaction({
      type: 'payment',
      auctionId: Number(auctionId),
      title: auctionData.title,
      amount: winBidUsd,
      txHash: tx?.hash || '',
      timestamp: Date.now(),
      from: userAddress,
      error: reason
    });
  }
}

function showError(msg) {
  showView('content-error');
  document.getElementById('error-msg').textContent = msg;
}

// ---- Confetti ----
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
let particles = [], active = false;
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();
class P { constructor(){this.x=Math.random()*canvas.width;this.y=Math.random()*-canvas.height-20;this.s=Math.random()*8+6;this.c=['#2ec4b6','#ff9f1c','#e63946','#9d4ede','#e0aaff'][Math.floor(Math.random()*5)];this.vx=Math.random()*4-2;this.vy=Math.random()*6+4;this.r=Math.random()*360;this.sp=Math.random()*4-2;} update(){this.x+=this.vx;this.y+=this.vy;this.r+=this.sp;} draw(){ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.r*Math.PI/180);ctx.fillStyle=this.c;ctx.fillRect(-this.s/2,-this.s/2,this.s,this.s);ctx.restore();} }
function triggerConfetti(){active=true;particles=[];for(let i=0;i<150;i++)particles.push(new P);(function loop(){if(!active)return;ctx.clearRect(0,0,canvas.width,canvas.height);let n=0;particles.forEach(p=>{p.update();p.draw();if(p.y<canvas.height)n++;});if(n>0)requestAnimationFrame(loop);else{active=false;ctx.clearRect(0,0,canvas.width,canvas.height);}})();}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-connect').addEventListener('click', connectWallet);
  document.getElementById('btn-pay').addEventListener('click', payForAuction);
  document.getElementById('btn-retry').addEventListener('click', () => {
    showView('content-review');
    setStep(1);
    document.getElementById('btn-pay').disabled = false;
    document.getElementById('btn-pay').innerHTML = '💳 Pay Now';
  });

  // Auto-connect
  if (typeof window.ethereum !== 'undefined') {
    window.ethereum.request({ method: 'eth_accounts' }).then(a => { if(a.length) connectWallet(); }).catch(()=>{});
  }
});
