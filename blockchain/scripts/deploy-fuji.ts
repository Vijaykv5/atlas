import hre from "hardhat";

async function main() {
  if (hre.network.name !== "fuji") {
    throw new Error("Use the fuji network: bun run deploy:fuji");
  }

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const Atlas = await hre.ethers.getContractFactory("Atlas");
  const atlas = await Atlas.deploy();
  const address = await atlas.getAddress();
  const deploymentTransaction = atlas.deploymentTransaction();
  await atlas.waitForDeployment();

  console.log("Atlas deployed and confirmed");
  console.log(`Contract address: ${address}`);
  console.log(`Network name: ${hre.network.name}`);
  console.log(`Chain ID: ${network.chainId.toString()}`);
  console.log(`Deployer address: ${deployer.address}`);
  if (deploymentTransaction) {
    console.log(`Deployment transaction: ${deploymentTransaction.hash}`);
  }
  console.log(`Fuji explorer URL: https://testnet.snowtrace.io/address/${address}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
