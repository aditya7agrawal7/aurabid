const hre = require("hardhat");

async function main() {
  console.log("Deploying AuctionHouse contract...");

  const AuctionHouse = await hre.ethers.getContractFactory("AuctionHouse");
  const auctionHouse = await AuctionHouse.deploy();

  await auctionHouse.waitForDeployment();

  const address = await auctionHouse.getAddress();

  console.log("===========================================");
  console.log("AuctionHouse deployed successfully!");
  console.log("===========================================");
  console.log(`Contract Address: ${address}`);
  console.log(`Network: ${hre.network.name}`);
  console.log(`View on Explorer: https://${hre.network.name === "sepolia" ? "sepolia." : ""}etherscan.io/address/${address}`);
  console.log("===========================================");
  console.log("");
  console.log("Next steps:");
  console.log("1. Copy the contract address above");
  console.log("2. Paste it into app.js as CONTRACT_ADDRESS");
  console.log("3. Open index.html in your browser");
  console.log("4. Connect MetaMask to the same network");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
